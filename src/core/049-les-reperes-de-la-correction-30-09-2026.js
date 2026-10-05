// ══ LES REPERES DE LA CORRECTION (30/09/2026) ════════════════════════════════
// Ils vivent dans videos[].feedbackTimestamps, donc dans le dossier de
// l'athlete, qui peut les reecrire. `ts` etait colle DANS un onclick
// (tsToSecs('…')) : un apostrophe, et le reste s'executait chez le coach. Le
// saut passe desormais par data-sec et un gestionnaire delegue, sans aucune
// donnee dans le code ; l'audio n'est lu que depuis Cloudinary.
function srcAudioSure(u){
  const v=String(u==null?'':u).trim();
  return /^https:\/\/res\.cloudinary\.com\//i.test(v)?escapeHtml(v):'';
}
document.addEventListener('click',e=>{
  const el=e.target&&e.target.closest?e.target.closest('.ts-saut'):null;
  if(!el) return;
  const v=document.getElementById(el.dataset.vid||'vc-video');
  if(v) v.currentTime=Number(el.dataset.sec)||0;
});
function tsToSecs(ts){
  const p=String(ts==null?'':ts).split(':').map(Number);
  return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+(p[1]||0);
}
function _renderTsAnnotations(annotations,opts={}){
  const{readonly=false,videoId='vc-video'}=opts;
  // `sec` porte le dixieme de seconde que le ralenti fait gagner ; `ts` reste
  // le libelle m:ss. Les annotations d avant ce lot n ont pas `sec` et se
  // trient exactement comme avant.
  const _tsSec=x=>(x&&isFinite(Number(x.sec)))?Number(x.sec):tsToSecs(x.ts);
  const sorted=[...(annotations!=null?annotations:(window._tsAnnotations||[]))].sort((a,b)=>_tsSec(a)-_tsSec(b));
  const html=sorted.length
    ?sorted.map((t,i)=>{
        const isAudio=!!t.audioUrl;
        return `<div style="display:flex;align-items:${isAudio?'flex-start':'center'};gap:8px;padding:6px 0;border-bottom:1px solid var(--surface-2)">
          <span class="ts-saut" data-vid="${escapeHtml(videoId)}" data-sec="${Number(_tsSec(t))||0}" style="font-family:var(--pile-titre);font-size:var(--fs-md);color:var(--red-text);flex-shrink:0;min-width:36px;margin-top:${isAudio?'3px':'0'};cursor:pointer" title="${escapeHtml(t.ts)}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">${escapeHtml(t.ts)}</span>
          ${isAudio
            ?`<div style="flex:1"><audio src="${srcAudioSure(t.audioUrl)}" controls style="height:32px;width:100%;margin-bottom:2px"></audio><div style="font-size:var(--fs-xs);color:var(--sub);display:flex;align-items:center;gap:4px">${icon('mic',12)} message audio</div></div>`
            :`<span style="flex:1;font-size:var(--fs-sm)">${escapeHtml(t.note)}</span>`}
          ${readonly?'':`<button onclick="removeTsAnnotation(${i})" style="background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:var(--fs-xl);line-height:1;padding:0;flex-shrink:0;margin-top:${isAudio?'3px':'0'}">×</button>`}
        </div>`;
      }).join('')
    :readonly?'':`<div class="sub" style="font-size:var(--fs-xs);padding:6px 0">Aucun repère : ajoute des annotations ci-dessous.</div>`;
  if(readonly) return html;
  const el=document.getElementById('vc-ts-list');if(!el)return;
  el.innerHTML=html;
}
function addTsAnnotation(){
  const ts=(document.getElementById('vc-ts-time')?.value||'').trim();
  const note=(document.getElementById('vc-ts-note')?.value||'').trim();
  if(!ts||!note) return toast('Renseigne le repère et la note','var(--orange)');
  if(!/^\d+:\d{2}$/.test(ts)) return toast('Format invalide : utilise m:ss (ex: 0:45 ou 1:30)','var(--orange)');
  if(!window._tsAnnotations) window._tsAnnotations=[];
  // `sec` n existe que si le timecode vient de « Annoter ici » : saisi a la
  // main, le champ m:ss ne porte pas de dixieme, et on n en invente pas.
  const _brut=document.getElementById('vc-ts-time');
  const _sec=_brut&&_brut.dataset?Number(_brut.dataset.sec):NaN;
  const _e={ts,note};
  if(isFinite(_sec)&&Math.abs(_sec-tsToSecs(ts))<1) _e.sec=_sec;
  window._tsAnnotations.push(_e);
  if(_brut&&_brut.dataset) delete _brut.dataset.sec;
  document.getElementById('vc-ts-time').value='';
  document.getElementById('vc-ts-note').value='';
  _renderTsAnnotations();
}
function removeTsAnnotation(sortedIdx){
  const sorted=[...(window._tsAnnotations||[])].sort((a,b)=>tsToSecs(a.ts)-tsToSecs(b.ts));
  const item=sorted[sortedIdx];if(!item)return;
  const i=window._tsAnnotations.findIndex(x=>x.ts===item.ts&&x.note===item.note);
  if(i>=0) window._tsAnnotations.splice(i,1);
  _renderTsAnnotations();
}
function _vcCorpsHtml(email,videoId){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||c.coachId!==currentUser?.id){toast('Élève introuvable ou non autorisé','var(--orange)');return null;}
  const v=(c.videos||[]).find(x=>x.id===videoId);if(!v)return null;
  window._vcEmail=email;window._vcVideoId=videoId;
  // Le nom de la vidéo EST le nom de l’exercice : c’est ce que porte `name`,
  // et c’est lui que consommerDemandeVideo compare aux demandes du coach.
  // `seance` et `charge` ne figurent nulle part dans une vidéo : les laisser
  // vides est exact, et tplVerifierAvantEnvoi refusera l’envoi si un modèle
  // les réclame — mieux vaut demander que deviner.
  tplContexte({prenom:c.fname,exercice:v.name},'vc-general');
  window._tsAnnotations=v.feedbackTimestamps?JSON.parse(JSON.stringify(v.feedbackTimestamps)):[];
  const _vcReste=(()=>{ try{ return _fileVideosSuivantes(email,videoId).length; }catch(e){ return 0; } })();
  // LA MAQUETTE DE KEVIN, 21/09/2026 : trois colonnes sur grand ecran — la
  // video et son lecteur a gauche, l'image au centre, la correction a droite —,
  // une seule sur telephone, la video d'abord. Tous les identifiants d'avant
  // sont gardes : brouillon, modeles, repères, audio et enchainement de file
  // les retrouvent tels quels.
  const fichier=/\.(mp4|mov|webm|mkv)(\?|$)/i.test(v.url||'');
  const nSeg=fichier?segmentsVideo(v).length:0;
  const quand=dateLocaleDeCle(v.date).toLocaleDateString('fr-FR');
  const S=_VCX_SVG, P=_VCX_P;
  // LE LOGO DU COACH, a droite de la devise. Kevin : « oui mets le logo ». C'est
  // celui de SON profil (le champ Logo, qui signe deja les images de seance et
  // la boutique) : chaque coach voit le sien, et rien ne s'affiche sans logo.
  // La signature n'y va pas — elle est faite pour le bas d'une vitrine.
  const logo=String((currentUser||{}).logo||'').trim();
  return `<div class="vcx">
    <header class="vcx-tete">
      <button type="button" class="vcx-retour" onclick="closeModal()" title="Annuler" aria-label="Annuler et fermer">${S(P.retour,22)}</button>
      <div class="vcx-tt">
        <h2 class="vcx-titre">Corriger <em>la vidéo</em></h2>
        <!-- LE RESTE DE LA FILE, quand il y en a une. Des modales qui
             s’enchaînent sans dire combien il en reste sont désorientantes ; hors
             file, _fileVideosSuivantes rend un tableau vide et rien ne s’affiche. -->
        <p class="vcx-sous">${escapeHtml(v.name)} · ${quand}${_vcReste?` · <span id="vc-reste" style="display:inline-block">${_vcReste} restante${_vcReste>1?'s':''}</span>`:''}</p>
      </div>
      <div class="vcx-devise" aria-hidden="true"><i></i><span>Discipline, travail et résultats</span></div>
      ${logo?`<img class="vcx-logo" src="${escapeHtml(logo)}" alt="" onerror="this.remove()">`:''}
    </header>
    <div class="vcx-grille">
      <div class="vcx-g">
        <section class="vcx-carte vcx-carte-r vcx-info">
          <div class="vcx-ct" role="heading" aria-level="3">${S(P.camera,22)}Vidéo à corriger</div>
          <div class="vcx-champ">${S(P.reglages,24)}<div><span>Exercice</span><b>${escapeHtml(v.name)}</b></div></div>
          <div class="vcx-champ">${S(P.agenda,24)}<div><span>Date</span><b>${quand}</b></div></div>
        </section>
        ${fichier?`<section class="vcx-carte vcx-fmt">
          <div class="vcx-ct" role="heading" aria-level="3">Format vidéo</div>
          <div class="vcx-champ">${S(P.format,24)}<div><b id="vcx-format">Lu au lancement</b><span id="vcx-dims">Dimensions réelles de la vidéo</span></div></div>
        </section>`:''}
        ${fichier?htmlLecteurCorrection('vc-video',v):''}
      </div>
      <div class="vcx-c">
        <div class="vcx-cadre">
          ${fichier?`<span class="vcx-badge" id="vcx-badge" hidden></span>
          <button type="button" class="vcx-plein" onclick="rcPleinEcran('vc-video')" title="Plein écran" aria-label="Plein écran">${S(P.plein,20)}</button>`:''}
          ${_videoEmbed(v.url)}
        </div>
      </div>
      <div class="vcx-d">
        <!-- MOTION LAB : SEULEMENT POUR UNE VIDEO DEPOSEE. Un lien YouTube ou Drive
             ne donne acces ni a un element <video> ni a ses images. -->
        ${fichier?`<button type="button" class="vcx-ml" onclick="ouvrirMotionLab(window._vcEmail,window._vcVideoId)"
          aria-label="Motion Lab : découper, tracer, corriger${nSeg?' ('+nSeg+')':''}">
          <span class="vcx-ml-ico">${S(P.ciseaux,34)}</span>
          <span class="vcx-ml-t"><b>Motion Lab</b><span>Découper, tracer, corriger ta vidéo${nSeg?' · '+nSeg+' répétition'+(nSeg>1?'s':''):''}</span></span>
          <span class="vcx-ml-fl">${S(P.fleche,24)}</span></button>`
          +((motionCorrectionValide(v.motion)||annotAMontrer(v.annot))?`<button type="button" class="vcx-revoir" onclick="ouvrirCorrectionMotion(window._vcEmail,window._vcVideoId)">Revoir la correction envoyée${(()=>{ const d=(v.motion&&v.motion.envoyeLe)||(v.annot&&v.annot.majLe); return d?' le '+new Date(d).toLocaleDateString('fr-FR'):''; })()}</button>`:''):''}
        <section class="vcx-carte vcx-com">
          <div class="vcx-ct" role="heading" aria-level="3"><label for="vc-general">${S(P.bulle,22)}Commentaire général</label></div>
          <div id="qc-chips" class="vcx-chips" style="display:flex;gap:8px"></div>
          <textarea id="vc-general" rows="3" placeholder="Impression globale sur l'exécution..." oninput="_vcxCompte()">${escapeHtml(v.feedback||'')}</textarea>
          <div id="vcx-compte" class="vcx-compte" aria-live="off"></div>
        </section>
        <section class="vcx-carte vcx-rep">
          <div class="vcx-ct" role="heading" aria-level="3">${S(P.horloge,22)}Repères par timestamp <span class="vcx-opt">optionnel</span></div>
          <div id="vc-ts-list" class="vcx-ts-list"></div>
          <div class="vcx-ts">
            <input id="vc-ts-time" placeholder="0:45" aria-label="Moment du repère (m:ss)" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('vc-ts-note').focus();}">
            <input id="vc-ts-note" placeholder="Ex : genoux qui rentrent" aria-label="Ce que tu vois à ce moment" onkeydown="if(event.key==='Enter'){event.preventDefault();addTsAnnotation();}">
            <button type="button" class="vcx-plus" onclick="addTsAnnotation()" title="Ajouter le repère" aria-label="Ajouter le repère">+</button>
          </div>
          <div class="vcx-ts-pied"><span>Format m:ss : ex: 0:15 · 1:30 · 12:05</span>
            ${/* « ANNOTER ICI » quitte la barre pour la carte des repères : c'est
                 elle qu'il remplit. data-rc-hors le rattache au lecteur, qui
                 l'active avec le reste quand les metadonnees arrivent. */
              fichier?`<button type="button" class="vcx-annoter" data-rc-hors="vc-video" disabled onclick="rcAnnoterIci('vc-video')"
              title="Créer une annotation au temps exact affiché" aria-label="Créer une annotation au temps exact affiché">${S(P.horloge,16)} Annoter ici</button>`:''}
          </div>
        </section>
      </div>
    </div>
    <footer class="vcx-pied">
      <div class="vcx-audio">
        <div class="vcx-audio-l">
          <span class="vcx-audio-t">${S(P.micro,20)}Message audio</span>
          <input id="vc-audio-ts" placeholder="0:45" aria-label="Moment du message audio (m:ss)">
          <button id="vc-audio-btn" type="button" class="vcx-rec" onclick="toggleAudioRec()">${icon('mic',14)} Démarrer l'enregistrement</button>
          <label class="vcx-import">
            <input type="file" accept="audio/*" style="display:none" onchange="uploadAudioFile(this)">
            ${S(P.dossier,18)}<span>Ou importe un mémo vocal existant</span>
          </label>
        </div>
        <div id="vc-audio-preview" style="display:none">
          <audio id="vc-audio-player" controls style="width:100%;height:36px;margin-bottom:8px"></audio>
          <div style="display:flex;gap:6px">
            <button class="btn btn-red btn-sm" style="flex:1" onclick="confirmAudioAnnotation()">${icon('coche',14)} Ajouter ce message</button>
            <button class="btn btn-outline btn-sm" style="flex:1" onclick="cancelAudioAnnotation()">${icon('croix',14)} Recommencer</button>
          </div>
        </div>
        <div id="vc-audio-status" class="vcx-audio-s"></div>
      </div>
      <button type="button" class="btn btn-red vcx-save" onclick="saveVideoCorrection()">Enregistrer la correction ${S(P.fleche,20)}</button>
    </footer>
  </div>`;
}
// Ce qui doit tourner APRES l'insertion du gabarit, que la feuille vienne
// d'etre creee ou que son contenu ait ete remplace sur place.
function _vcApres(){
  _renderTsAnnotations();
  _renderQuickCommentChips();
  // Le compteur suit aussi les puces, qui ecrivent dans le champ sans evenement.
  _vcxCompte();
  const qc=document.getElementById('qc-chips');
  if(qc) qc.addEventListener('click',()=>setTimeout(_vcxCompte,0));
  // La barre de correction n'existe que pour un vrai <video> : sur une video
  // YouTube, htmlLecteurCorrection n'a rien produit et rcInitLecteur sort.
  try{ rcInitLecteur('vc-video'); }catch(e){}
}
function openVideoCorrection(email,videoId){
  const corps=_vcCorpsHtml(email,videoId);
  if(corps==null) return;
  const html=`<div id="modal-overlay" onclick="closeModal()" style="position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:flex-end;justify-content:center">
  <div class="mdl-large mdl-video" onclick="event.stopPropagation()" style="background:var(--surface-2);border-radius:var(--r-4) var(--r-4) 0 0;padding:16px 20px 24px;width:100%;max-width:480px;max-height:92vh;overflow-y:auto">${corps}</div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  _vcApres();
  // La correction d'une vidéo compte dans le temps passé sur cet athlète.
  try{ setTimeout(_chronoTick,0); }catch(e){}
}
// ── UNE SEULE FEUILLE QUI RESTE ────────────────────────────────────────────
// saveVideoCorrection appelait closeModal(), qui LAISSE LE NOEUD A L'ECRAN
// 140 ms, puis appelait synchroniquement l'enchainement, qui inserait un
// SECOND #modal-overlay : pendant 140 ms deux voiles plein ecran se
// superposaient, le fond doublait de densite puis s'eclaircissait, et la
// nouvelle feuille montait a travers l'ancienne. Le coach voyait un
// clignotement, pas une passation.
// Ici la feuille RESTE, son contenu glisse lateralement, et le compteur de file
// encaisse une decharge. Le geste dit « suivante », il ne redemarre pas.
function _vcRemplacer(x){
  const sheet=document.querySelector('#modal-overlay>div');
  if(!sheet||arcReduit()){ closeModal(); return _allerVideoSuivante(x); }
  // closeModal() annule un enregistrement audio en cours : on doit le faire
  // aussi ici, aux memes conditions.
  try{ if(typeof cancelAudioAnnotation==='function') cancelAudioAnnotation(); }catch(e){}
  sheet.classList.add('vc-part');
  setTimeout(()=>{
    try{
      if(x&&x.cid) currentClientId=x.cid;
      const corps=_vcCorpsHtml(x.email,x.id);
      if(corps==null){ closeModal(); return; }
      sheet.innerHTML=corps;
      sheet.scrollTop=0;
      _vcApres();
      sheet.classList.remove('vc-part');
      sheet.classList.add('vc-arrive');
      sheet.addEventListener('animationend',e=>{
        if(e.target===sheet) sheet.classList.remove('vc-arrive');
      },{once:true});
      const r=document.getElementById('vc-reste');
      if(r) arcDecharge(r,{flash:false,halo:false,impact:1.14});
    }catch(e){ try{ closeModal(); }catch(e2){} }
  },120);
  return true;
}
function saveVideoCorrection(){
  // Le garde-fou EN PREMIER : une variable non remplie ne doit pas atteindre
  // l’athlète. Il surligne le champ et le dit, il ne se contente pas de
  // refuser en silence.
  if(!tplVerifierAvantEnvoi('vc-general')) return;
  const general=(document.getElementById('vc-general')?.value||'').trim();
  const tss=window._tsAnnotations||[];
  if(!general&&!tss.length) return toast('Ajoute un commentaire ou au moins un repère','var(--orange)');
  const users=DB.get('users')||{};
  const c=users[window._vcEmail];
  if(!c||c.coachId!==currentUser?.id){toast('Élève introuvable ou non autorisé','var(--orange)');return;}
  const idx=(c.videos||[]).findIndex(v=>v.id===window._vcVideoId);if(idx<0)return;
  c.videos[idx].feedback=general;
  c.videos[idx].feedbackTimestamps=tss;
  c.videos[idx].feedbackDate=Date.now();
  // Point de départ de la boucle de retour : tant que l'athlète n'a pas ouvert
  // sa liste de vidéos, ce retour compte comme non vu — d'où la notification
  // verte sur l'accueil et la pastille sur l'onglet Vidéos.
  // false STRICT, jamais undefined : les corrections antérieures à cette
  // fonctionnalité restent à undefined et ne déclenchent donc rien
  // rétroactivement. Un athlète avec dix anciennes corrections ne se réveille
  // pas avec dix notifications.
  c.videos[idx].feedbackSeen=false;
  c.updatedAt=Date.now();users[window._vcEmail]=c;
  const ok=DB.set('users',users);
  const envoi=CLOUD.pushOne(window._vcEmail,c);
  noterContact(c.id);
  // LA FILE EST LUE AVANT DE FERMER. closeModal() laisse le noeud a l'ecran
  // 140 ms : ferme ici, il se superposait a la feuille suivante, inseree
  // synchroniquement juste apres. On ne ferme donc que s'il n'y a pas de suite.
  let _rest=[];
  try{ _rest=_fileVideosSuivantes(window._vcEmail,window._vcVideoId); }catch(e){ _rest=[]; }
  if(!_rest.length) closeModal();
  // La modale vient de se fermer : le coach ne peut plus rien récupérer si
  // l'écriture a échoué, il faut donc le lui dire au lieu d'un « ✓ ».
  toastSync(ok,envoi,'Correction enregistrée !','la correction est');
  // ENCHAÎNEMENT. Quand le coach est entré par le compteur de la bande C, on
  // ouvre la vidéo suivante plutôt que de le renvoyer sur une fiche qu’il
  // devrait quitter aussitôt.
  //
  // File vide, vidéo hors file, ou ouverture qui échoue : on retombe sur le
  // retour à la fiche, c’est-à-dire exactement le comportement d’avant.
  try{
    if(_rest.length&&_vcRemplacer(_rest[0])) return;
  }catch(e){}
  // Le repli — file vide, video hors file, ou remplacement qui echoue — passe
  // par la fermeture, exactement comme avant.
  try{ if(document.getElementById('modal-overlay')) closeModal(); }catch(e){}
  // LE TABLEAU DE BORD SE RAFRAÎCHIT QUAND C EST LUI QUI EST À L ÉCRAN.
  //
  // La chaîne s’ouvre en modale par-dessus s-coach-home et s’y termine :
  // openClientDetail(_,true) supprime la navigation et ne rejoue jamais
  // renderPilotage, appelée seulement par renderClientList. Le compteur
  // « N vidéos en attente de correction » restait donc sur son ancien
  // chiffre après qu’on venait d’en corriger N.
  //
  // MÊME TEST DE GARDE que _rafraichirCodesEleves : sur l’écran réellement
  // affiché, jamais sur une intention. Entré par la fiche athlète, on
  // retombe sur openClientDetail — le comportement d’avant, intact.
  if(document.getElementById('s-coach-home')?.classList.contains('active')){
    try{ loadCoachHome(); }catch(e){}
    return;
  }
  openClientDetail(currentClientId,true);
}

// ══ MOTION LAB — LOT 1 : LES RÉPÉTITIONS D'UNE VIDÉO ═══════════════════════
//
// DES BORNES, JAMAIS UNE COPIE. Une répétition est un intervalle en
// millisecondes sur la vidéo déposée : rien n'est réencodé, rien n'est
// téléversé, la vidéo source ne bouge pas. Les répétitions vivent dans
// l'entrée de la vidéo, chez l'athlète — quelques dizaines d'octets chacune,
// écrites comme `feedback` :
//
//   videos[i].segments = [{id, label, debutMs, finMs}]
//
// LE MODÈLE VIT ICI, L'ÉDITEUR DANS app/motion-lab.js. Le lecteur de
// correction lit les répétitions sans avoir à charger le module.
//
// ⚠ DIX SECONDES AU PLUS (décision D7). La lecture en boucle est plafonnée à
// VID_BOUCLE_MAX_S pour ne pas retélécharger le média à chaque tour ; une
// répétition dure bien moins, et une borne plus large ne se lirait pas en
// boucle.
const SEG_MAX=20, SEG_MIN_MS=100, SEG_LIBELLE_MAX=24;
function segMaxMs(){ return VID_BOUCLE_MAX_S*1000; }
// ── LA TRAJECTOIRE DE LA BARRE, COMPACTÉE (lot 3) ─────────────────────────────
//
// ⚠ ELLE VIT DANS LA RÉPÉTITION, ET NON DANS UN NŒUD À PART — écart assumé avec
// la décision D5 de l'audit. Les règles de la base ne partent pas avec le
// déploiement automatique (firebase.yml : hosting seul ; deploie.sh envoie
// database à la main) : un nœud neuf serait REFUSÉ en production jusqu'au
// prochain déploiement manuel, et la trajectoire se perdrait sans un mot. Le
// dossier de l'athlète a déjà les bons droits : le coach désigné écrit,
// l'athlète lit.
//
// LE PRIX EST BORNÉ, parce que ce dossier est poussé EN ENTIER à chaque
// synchronisation : 150 points au plus par répétition — assez pour dessiner le
// tracé et la courbe de vitesse —, soit ≈ 1,6 Ko. Le suivi image par image, lui,
// reste sur l'appareil du coach : il se recalcule, il ne se stocke pas.
//
//   barre = {v:1, debutMs, finMs, disqueM, sens, vw, vh, rayonPx, fps, n, t0Ms, pasMs,
//            xy (Int16 base64, x et y normés), c (Uint8 base64, confiance),
//            vy (Int16 base64, cm/s), m {métriques}, ph [[nom,tMs,conf%]], av [...]}
//
// UNE TRAJECTOIRE NE SURVIT PAS À SES BORNES : elle porte le début et la fin
// sur lesquels elle a été calculée, et segmentsVideo la retire si la
// répétition a bougé depuis. Un tracé qui ne correspondrait plus à la vidéo
// mentirait.
const SEG_BARRE_POINTS_MAX=150;
const SEG_BARRE_PHASES=Object.freeze(['depart','pic_vitesse','point_haut','reception','point_bas']);
const SEG_BARRE_ALERTES=Object.freeze(['fps_bas','disque_petit','perte_suivi','disque_bord','doutes']);
// LES ARTICULATIONS : quatorze points du corps, soixante-douze échantillons
// au plus. À douze par seconde, une répétition de trois secondes en compte
// trente-six ; une de dix — le maximum — descend à sept par seconde. Bornes
// hautes, car tout ceci part dans l'enregistrement complet de l'athlète à
// chaque sauvegarde : sept kilo-octets par répétition analysée, l'ordre de
// grandeur de la trajectoire de barre.
const SEG_POSE_PTS=14, SEG_POSE_MAX=72;
// L'APLOMB : l'angle du téléphone sur la verticale, en degrés, gardé AVEC
// l'analyse qui s'en est servie. Au-delà de quinze degrés ce n'est plus un
// téléphone de travers, c'est un cadrage à refaire : on borne, on ne corrige
// pas l'impossible.
const SEG_APLOMB_MAX=15;
// LES SEPT ANGLES, nommés ici parce que le journal d'une correction les cite :
// motion-lab.js les redéfinit avec leurs trois points, mais il n'est chargé
// que dans le laboratoire, et une correction se valide à l'ouverture de
// l'application. Un test vérifie que les deux listes ne divergent pas.
const SEG_POSE_ANGLES=Object.freeze(['coude','epaule','hanche','genou','cheville','tronc','avantBras']);
// PURE. Une chaîne base64 qui décode EXACTEMENT le nombre d'octets attendu.
// Partagé par la trajectoire et les articulations : c'est la première chose
// qu'on vérifie sur une donnée venue du réseau, et elle doit l'être pareil.
function _segB64(s,octets){
  return typeof s==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(s)
    &&Math.floor(s.length*3/4)-(s.endsWith('==')?2:s.endsWith('=')?1:0)===octets;
}
// PURE. La trajectoire compactée d'une répétition si elle est lisible et
// correspond à ses bornes, null sinon. Tout est revérifié : la donnée vient du
// réseau, et un tracé à moitié lisible ne s'affiche pas à moitié.
function segBarreValide(b,debutMs,finMs){
  if(!b||typeof b!=='object'||b.v!==1) return null;
  if(Math.round(Number(b.debutMs))!==debutMs||Math.round(Number(b.finMs))!==finMs) return null;
  const n=Math.round(Number(b.n));
  if(!(n>=2&&n<=SEG_BARRE_POINTS_MAX)) return null;
  if(!_segB64(b.xy,n*4)||!_segB64(b.c,n)||!_segB64(b.vy,n*2)) return null;
  const num=(x,min,max)=>{ const v=Number(x); return isFinite(v)&&v>=min&&v<=max?v:null; };
  const disqueM=num(b.disqueM,0.1,1), vw=num(b.vw,16,8192), vh=num(b.vh,16,8192),
    rayonPx=num(b.rayonPx,1,4096), fps=num(b.fps,1,1000), pasMs=num(b.pasMs,1,1000),
    t0Ms=num(b.t0Ms,debutMs,finMs);
  if([disqueM,vw,vh,rayonPx,fps,pasMs,t0Ms].some(x=>x===null)) return null;
  const m={};
  // « vert » est la part VERTICALE du chemin, entre 0 et 1 : c'est elle qui
  // dit si les phases ont été lues sur la vitesse verticale ou le long du
  // chemin. Absente des analyses d'avant le lot 9, qui étaient toutes
  // verticales — d'où le repli silencieux.
  for(const k of ['vMax','tVMax','hMax','depVert','devPlus','devMoins','vert','vTanMax']){
    const v=num(b.m&&b.m[k],-100,100000);
    if(v!==null) m[k]=Math.round(v*1000)/1000;
  }
  const ph=_tabBloc(b.ph).filter(p=>Array.isArray(p)&&SEG_BARRE_PHASES.includes(p[0])
      &&num(p[1],debutMs,finMs)!==null&&num(p[2],0,100)!==null)
    .map(p=>[p[0],Math.round(Number(p[1])),Math.round(Number(p[2]))]).slice(0,SEG_BARRE_PHASES.length);
  const av=_tabBloc(b.av).filter(a=>SEG_BARRE_ALERTES.includes(a)).slice(0,SEG_BARRE_ALERTES.length);
  const thB=num(b.theta,-SEG_APLOMB_MAX,SEG_APLOMB_MAX);
  // L'ÉTALON : la longueur connue sur laquelle l'échelle a été prise, quand ce
  // n'est pas le disque. Il ne sert qu'à DIRE d'où vient l'échelle — les
  // mesures, elles, sont déjà en mètres dans ce qui est stocké.
  // LA LIGNE D'ACTION, quand la charge n'est pas libre : deux points en
  // pixels de l'image. Sans elle, c'est la gravité — et c'est le cas de
  // toutes les analyses d'avant le lot 10.
  const ac=b.act&&typeof b.act==='object'&&b.act.mode==='cable'?b.act:null;
  const acX1=ac?num(ac.x1,0,8192):null, acY1=ac?num(ac.y1,0,8192):null,
    acX2=ac?num(ac.x2,0,8192):null, acY2=ac?num(ac.y2,0,8192):null;
  // DEUX POINTS CONFONDUS NE FONT PAS UNE DIRECTION : on ne garde pas une
  // ligne d'action qui se réduirait à un point, elle rendrait tous les
  // bras de levier nuls sans que rien ne le dise.
  const act=([acX1,acY1,acX2,acY2].every(x=>x!==null)
    &&Math.hypot(Number(acX1)-Number(acX2),Number(acY1)-Number(acY2))>=4)
    ?{mode:'cable',x1:Math.round(Number(acX1)*10)/10,y1:Math.round(Number(acY1)*10)/10,
      x2:Math.round(Number(acX2)*10)/10,y2:Math.round(Number(acY2)*10)/10}:null;
  const et=b.etalon&&typeof b.etalon==='object'?b.etalon:null;
  const etCm=et?num(et.cm,1,1000):null, etPx=et?num(et.px,1,8192):null;
  const etalon=(etCm!==null&&etPx!==null)
    ?{cm:Math.round(etCm*10)/10,px:Math.round(etPx*10)/10,
      type:String(et.type==null?'':et.type).slice(0,24)}:null;
  return {v:1,debutMs,finMs,disqueM,sens:(b.sens==='gauche'||b.sens==='droite')?b.sens:'',
    // LOT T5 : l'aplomb a été estimé (sinon, un tilt à 0 ne dit rien).
    ...(b.ae===1?{ae:1}:{}),
    // LE SENS CONCENTRIQUE (05/10/2026) : -1 quand le concentrique descend
    // (poulie haute, tirage vertical) ou s'éloigne en excentrique (presse).
    // Absent = 1 : les analyses d'avant ne bougent pas.
    ...(b.sc===-1?{sc:-1}:{}),
    theta:thB===null?0:Math.round(thB*10)/10,...(etalon?{etalon}:{}),...(act?{act}:{}),
    vw:Math.round(vw),vh:Math.round(vh),rayonPx:Math.round(rayonPx*10)/10,fps:Math.round(fps*100)/100,
    n,t0Ms:Math.round(t0Ms),pasMs:Math.round(pasMs*1000)/1000,xy:b.xy,c:b.c,vy:b.vy,m,ph,av};
}
// PURE. Les articulations d'une répétition si elles sont lisibles et
// correspondent à ses bornes, null sinon. Même exigence que pour la
// trajectoire : la donnée vient du réseau, et une pose à moitié lisible ne
// s'affiche pas à moitié.
function segPoseValide(p,debutMs,finMs){
  if(!p||typeof p!=='object'||p.v!==1) return null;
  if(Math.round(Number(p.debutMs))!==debutMs||Math.round(Number(p.finMs))!==finMs) return null;
  if(p.cote!=='G'&&p.cote!=='D') return null;
  const n=Math.round(Number(p.n));
  if(!(n>=2&&n<=SEG_POSE_MAX)) return null;
  // QUATRE OCTETS PAR POINT pour la position, un pour la visibilité : si les
  // longueurs ne tombent pas juste, le reste ne se lira pas non plus.
  if(!_segB64(p.xy,n*SEG_POSE_PTS*4)||!_segB64(p.vis,n*SEG_POSE_PTS)) return null;
  const num=(x,min,max)=>{ const v=Number(x); return isFinite(v)&&v>=min&&v<=max?v:null; };
  const vw=num(p.vw,16,8192), vh=num(p.vh,16,8192), pasMs=num(p.pasMs,1,5000), t0Ms=num(p.t0Ms,debutMs,finMs);
  if([vw,vh,pasMs,t0Ms].some(x=>x===null)) return null;
  // L'APLOMB EST FACULTATIF : les analyses d'avant le lot 8 n'en ont pas, et
  // valent zéro — elles ont été calculées dans le repère de l'image.
  const th=num(p.theta,-SEG_APLOMB_MAX,SEG_APLOMB_MAX);
  // LE HORS-PLAN de la prise de vue, quand il a été estimé : c'est lui qui dit
  // si la correction du biais de projection est dans son domaine.
  const hp=num(p.hp,0,90);
  return {v:1,debutMs,finMs,vw:Math.round(vw),vh:Math.round(vh),cote:p.cote,n,
    t0Ms:Math.round(t0Ms),pasMs:Math.round(pasMs*1000)/1000,xy:p.xy,vis:p.vis,
    theta:th===null?0:Math.round(th*10)/10,...(hp===null?{}:{hp:Math.round(hp)})};
}
// ── LES POINTS SUIVIS NOMMÉS ─────────────────────────────────────────────────
//
// Le coach touche un endroit de l'image, lui donne un nom — « trajectoire », «
// genou », « coude » —, et ce point est suivi image par image sur la
// répétition : son déplacement se dessine, sous son nom.
//
// ⚠ UNE SEULE BASE DE TEMPS POUR TOUS LES POINTS, et c'est ce qui autorise ce
//   format compact : ils sont suivis dans LE MÊME parcours de la vidéo, donc
//   échantillonnés aux mêmes instants. `t0Ms` et `pasMs` sont communs ; chaque
//   point n'apporte que ses positions et ses confiances.
//
//   reperes = {v:1, debutMs, finMs, vw, vh, n, t0Ms, pasMs,
//              pts:[{nom, c (0|1|2, la couleur du trait), r (rayon px),
//                    sx, sy (la graine, en pixels de l'image),
//                    xy (Int16 base64, x et y normés), cf (Uint8 base64)}]}
//
// LA GRAINE EST GARDÉE, et ce n'est pas du luxe : ajouter un septième point
// relance le suivi des six premiers dans le même parcours, et sans leur graine
// il faudrait les reposer un par un.
//
// LE PRIX EST BORNÉ pour la raison de toujours — ce dossier part EN ENTIER à
// chaque synchronisation : six points, cent cinquante échantillons, cinq octets
// par échantillon, soit ≈ 4,5 Ko par répétition. L'ordre de grandeur des
// articulations.
//
// COMME LA TRAJECTOIRE, ILS NE SURVIVENT PAS À LEURS BORNES : segmentsVideo les
// retire si la répétition a bougé depuis. Un tracé qui ne correspondrait plus à
// la vidéo mentirait, et il mentirait sous un nom que le coach a écrit.
const SEG_REP_MAX=6, SEG_REP_PTS_MAX=150, SEG_REP_NOM_MAX=18;
// PURE. Les points suivis d'une répétition s'ils sont lisibles et correspondent
// à ses bornes, null sinon. Un point illisible TOMBE SEUL : les autres restent,
// parce que rien dans le lot ne dépend de lui.
function segReperesValide(r,debutMs,finMs){
  if(!r||typeof r!=='object'||r.v!==1) return null;
  if(Math.round(Number(r.debutMs))!==debutMs||Math.round(Number(r.finMs))!==finMs) return null;
  const n=Math.round(Number(r.n));
  if(!(n>=2&&n<=SEG_REP_PTS_MAX)) return null;
  const num=(x,min,max)=>{ const v=Number(x); return isFinite(v)&&v>=min&&v<=max?v:null; };
  const vw=num(r.vw,16,8192), vh=num(r.vh,16,8192),
    pasMs=num(r.pasMs,1,1000), t0Ms=num(r.t0Ms,debutMs,finMs);
  if([vw,vh,pasMs,t0Ms].some(x=>x===null)) return null;
  const vus=new Set(), pts=[];
  for(const p of _tabBloc(r.pts)){
    if(!p||typeof p!=='object'||pts.length>=SEG_REP_MAX) continue;
    // UN NOM VIDE NE FAIT PAS UNE LÉGENDE, et deux points du même nom en font
    // une ambiguë : on ne garde que le premier.
    const nom=String(p.nom==null?'':p.nom).trim().slice(0,SEG_REP_NOM_MAX);
    const cle=nom.toLowerCase();
    if(!nom||vus.has(cle)) continue;
    if(!_segB64(p.xy,n*4)||!_segB64(p.cf,n)) continue;
    const rp=num(p.r,1,4096), sx=num(p.sx,0,8192), sy=num(p.sy,0,8192);
    if([rp,sx,sy].some(x=>x===null)) continue;
    const ci=Math.round(Number(p.c));
    vus.add(cle);
    pts.push({nom,c:(ci>=0&&ci<=2)?ci:0,r:Math.round(rp*10)/10,
      sx:Math.round(sx*10)/10,sy:Math.round(sy*10)/10,xy:p.xy,cf:p.cf});
  }
  if(!pts.length) return null;
  return {v:1,debutMs,finMs,vw:Math.round(vw),vh:Math.round(vh),n,
    t0Ms:Math.round(t0Ms),pasMs:Math.round(pasMs*1000)/1000,pts};
}
// PURE. Les répétitions lisibles d'une vidéo, triées par début. Ce qui ne peut
// pas se lire TOMBE — bornes absentes, inversées, trop courtes, trop longues —
// plutôt que d'être « réparé » en une répétition que le coach n'a pas posée.
// Firebase rend une liste à trous en objet : _tabBloc l'aplatit.
function segmentsVideo(v){
  const vus=new Set(), l=[];
  for(const s of _tabBloc(v&&v.segments)){
    if(typeof s!=='object') continue;
    const d=Math.round(Number(s.debutMs)), f=Math.round(Number(s.finMs));
    if(!isFinite(d)||!isFinite(f)||d<0||f-d<SEG_MIN_MS||f-d>segMaxMs()) continue;
    let id=String(s.id==null?'':s.id).trim().slice(0,40);
    if(!id||vus.has(id)) id='s'+d.toString(36)+'-'+f.toString(36);
    if(vus.has(id)) continue;
    vus.add(id);
    const seg={id,label:String(s.label==null?'':s.label).trim().slice(0,SEG_LIBELLE_MAX),debutMs:d,finMs:f};
    const barre=segBarreValide(s.barre,d,f);
    if(barre) seg.barre=barre;
    const pose=segPoseValide(s.pose,d,f);
    if(pose) seg.pose=pose;
    const reperes=segReperesValide(s.reperes,d,f);
    if(reperes) seg.reperes=reperes;
    l.push(seg);
  }
  l.sort((a,b)=>a.debutMs-b.debutMs||a.finMs-b.finMs);
  const out=l.slice(0,SEG_MAX);
  out.forEach((s,i)=>{ if(!s.label) s.label='Rép '+(i+1); });
  return out;
}
// L'ÉCRITURE. Le même chemin que saveVideoCorrection — le dossier de
// l'athlète, DB puis CLOUD.pushOne — et la même garde : le coach désigné.
// RIEN D'AUTRE NE BOUGE, ni `feedback` ni `feedbackSeen` : découper n'est pas
// corriger, et l'athlète n'a pas à être prévenu d'un réglage de lecture.
// Une liste vide RETIRE la clé : on n'écrit pas de tableau vide dans un dossier
// poussé en entier à chaque synchronisation.
function enregistrerSegmentsVideo(email,videoId,segments){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||c.coachId!==currentUser?.id) return {ok:false,raison:'Élève introuvable ou non autorisé'};
  const idx=(Array.isArray(c.videos)?c.videos:[]).findIndex(v=>v&&v.id===videoId);
  if(idx<0) return {ok:false,raison:'Vidéo introuvable'};
  const propres=segmentsVideo({segments});
  if(propres.length) c.videos[idx].segments=propres;
  else delete c.videos[idx].segments;
  c.updatedAt=Date.now(); users[email]=c;
  const ok=DB.set('users',users);
  return {ok,envoi:CLOUD.pushOne(email,c),segments:propres};
}
// ── LA CORRECTION VIDÉO (lots 5 et 6) ──────────────────────────────────────────
//
// UNE SÉQUENCE REJOUÉE, PAS UN MP4 (décision D1, option A). Le coach enregistre
// sa voix pendant qu'il lit, fige, ralentit, avance image par image et dessine ;
// l'application garde le JOURNAL de ces gestes, horodaté sur l'horloge de la
// session. L'athlète revoit la séquence : sa vidéo d'origine, pilotée par le
// journal, sous la voix du coach — le même code dessine chez l'un et chez
// l'autre, donc le même rendu.
//
//   videos[i].motion = {v:1, id, creeLe, envoyeLe, dureeMs, voix:{url}|null,
//     debut:{s, r}, ev:[[t,'lecture'] | [t,'pause'] | [t,'effacer']
//       | [t,'aller',sMs] | [t,'vitesse',r] | [t,'trait',couleur,'x,y x,y…']
//       | [t,'calque',nom,idRépétition,0|1]], cartes:[{id,aMs,dureeMs,texte}]}
//       nom : 'trajectoire' ou l'un des SEG_POSE_ANGLES.
//       epingles:[{id,aMs,art,val}] : un angle figé sur une image de la vidéo.
//       st:[{t,x}] : les sous-titres, datés sur l'horloge de la session.
//
// ⚠ DANS LE DOSSIER DE L'ATHLÈTE, pour la même raison que la trajectoire (voir
// segBarreValide) — et BORNÉE pour la même raison : 3 minutes, 600 gestes,
// 60 traits de 40 points, 20 cartes, 40 Ko au plus. La voix, elle, part chez
// l'hébergeur vidéo du coach, comme les messages audio existants.
//
// VALIDÉE ENTIÈRE, OU REFUSÉE ENTIÈRE. Une séquence dont un geste est illisible
// ne se rejoue pas « à peu près » : un seek manquant décale tout ce qui suit.
const CORR_DUREE_MAX_MS=180000, CORR_EV_MAX=600, CORR_TRAITS_MAX=60, CORR_POINTS_MAX=40,
  CORR_CARTES_MAX=20, CORR_CARTE_MAX=140, CORR_TAILLE_MAX=40000,
  // LES ÉPINGLES et LES SOUS-TITRES, ajoutés au même plafond de 40 ko : une
  // correction entière part dans l'enregistrement complet de l'athlète à
  // chaque sauvegarde. Quatre-vingts lignes de quatre-vingt-dix signes
  // couvrent trois minutes de parole ; au-delà, ce n'est plus une correction.
  CORR_EPINGLES_MAX=20, CORR_ST_MAX=80, CORR_ST_CHARS=90;
const CORR_COULEURS=3;
function motionCorrectionValide(m){
  if(!m||typeof m!=='object'||m.v!==1) return null;
  const num=(x,min,max)=>{ const v=Number(x); return isFinite(v)&&v>=min&&v<=max?v:null; };
  const dureeMs=num(m.dureeMs,300,CORR_DUREE_MAX_MS);
  const id=String(m.id==null?'':m.id).slice(0,40);
  if(dureeMs===null||!id) return null;
  let voix=null;
  if(m.voix){
    const u=String(m.voix.url||'');
    if(u.length>600||!/^https:\/\/[^\s"'<>]+$/.test(u)) return null;
    voix={url:u};
  }
  const r0=Number(m.debut&&m.debut.r);
  const debut={s:Math.round(num(m.debut&&m.debut.s,0,86400000)||0),r:VID_RATES.includes(r0)?r0:1};
  const ev=[];
  let tPrec=0, traits=0;
  for(const e of _tabBloc(m.ev)){
    if(!Array.isArray(e)) return null;
    const t=num(e[0],0,dureeMs), k=e[1];
    if(t===null||t<tPrec) return null;
    tPrec=t;
    const tt=Math.round(t);
    if(k==='lecture'||k==='pause'||k==='effacer') ev.push([tt,k]);
    else if(k==='aller'){ const s=num(e[2],0,86400000); if(s===null) return null; ev.push([tt,k,Math.round(s)]); }
    else if(k==='vitesse'){ const r=Number(e[2]); if(!VID_RATES.includes(r)) return null; ev.push([tt,k,r]); }
    else if(k==='trait'){
      const c=Number(e[2]), p=String(e[3]==null?'':e[3]);
      if(!(Number.isInteger(c)&&c>=0&&c<CORR_COULEURS)) return null;
      const pts=p.split(' ');
      if(pts.length<2||pts.length>CORR_POINTS_MAX||!pts.every(q=>/^\d{1,4},\d{1,4}$/.test(q)
        &&q.split(',').every(n=>Number(n)<=1000))) return null;
      if(++traits>CORR_TRAITS_MAX) return null;
      ev.push([tt,k,c,p]);
    }
    else if(k==='calque'){
      // DEUX SORTES DE CALQUES : la trajectoire de la barre, et un angle.
      // Le nom est repris tel quel — mais seulement s'il est dans la liste,
      // car c'est lui qui décidera de ce qui se dessine chez l'athlète.
      const nom=String(e[2]==null?'':e[2]);
      const seg=String(e[3]==null?'':e[3]).slice(0,40), on=Number(e[4]);
      if((nom!=='trajectoire'&&!SEG_POSE_ANGLES.includes(nom))||!seg||(on!==0&&on!==1)) return null;
      ev.push([tt,k,nom,seg,on]);
    }
    else return null;
  }
  if(ev.length>CORR_EV_MAX) return null;
  const cartes=_tabBloc(m.cartes).map(c=>{
    if(!c||typeof c!=='object') return null;
    const texte=String(c.texte==null?'':c.texte).trim().slice(0,CORR_CARTE_MAX);
    const aMs=num(c.aMs,0,86400000), d=num(c.dureeMs,500,10000);
    const cid=String(c.id==null?'':c.id).slice(0,40);
    return (texte&&aMs!==null&&d!==null&&cid)?{id:cid,aMs:Math.round(aMs),dureeMs:Math.round(d),texte}:null;
  }).filter(Boolean).sort((a,b)=>a.aMs-b.aMs).slice(0,CORR_CARTES_MAX);
  // LES ÉPINGLES : un angle connu, un instant de la vidéo, une valeur entre 0
  // et 180 degrés. La valeur est celle que le coach a VUE : on la reprend
  // telle quelle, sans la recalculer sur des articulations qui ont pu être
  // refaites depuis.
  const epingles=_tabBloc(m.epingles).map(p=>{
    if(!p||typeof p!=='object') return null;
    const art=String(p.art==null?'':p.art);
    const aMs=num(p.aMs,0,86400000), val=num(p.val,0,180), tol=num(p.tol,0,90);
    const pid=String(p.id==null?'':p.id).slice(0,40);
    return (SEG_POSE_ANGLES.includes(art)&&aMs!==null&&val!==null&&pid)
      // LA VALEUR ÉPINGLÉE EST CELLE QUI A ÉTÉ MONTRÉE : une flexion corrigée,
      // au degré entier, avec la tolérance qui l'accompagnait.
      ?{id:pid,aMs:Math.round(aMs),art,val:Math.round(val),tol:tol===null?11:Math.round(tol)}:null;
  }).filter(Boolean).sort((a,b)=>a.aMs-b.aMs).slice(0,CORR_EPINGLES_MAX);
  // LES SOUS-TITRES sont datés sur l'horloge de la SESSION, comme les gestes :
  // c'est la voix qu'ils accompagnent, pas l'image.
  const st=_tabBloc(m.st).map(x=>{
    if(!x||typeof x!=='object') return null;
    const texte=String(x.x==null?'':x.x).trim().slice(0,CORR_ST_CHARS);
    const t=num(x.t,0,CORR_DUREE_MAX_MS);
    return (texte&&t!==null)?{t:Math.round(t),x:texte}:null;
  }).filter(Boolean).sort((a,b)=>a.t-b.t).slice(0,CORR_ST_MAX);
  let out={v:1,id,creeLe:Math.round(num(m.creeLe,0,1e14)||0),envoyeLe:Math.round(num(m.envoyeLe,0,1e14)||0),
    dureeMs:Math.round(dureeMs),voix,debut,ev,cartes,epingles,st};
  // ⚠ LE PLAFOND NE DOIT PAS ÊTRE UNE SURPRISE À L'ENVOI. Tout au maximum —
  // six cents gestes, vingt cartes pleines, vingt épingles et trois minutes
  // de parole — dépasse les quarante kilo-octets, et refuser le tout ferait
  // perdre au coach une correction qu'il vient d'enregistrer. Quelque chose
  // tombe donc : les sous-titres d'abord, qui sont un confort que la voix
  // elle-même porte déjà ; les épingles ensuite, posées à la main mais
  // lisibles à l'écran. Le journal et les cartes SONT la correction : s'ils
  // ne tiennent pas, rien ne tient, et là on refuse.
  if(JSON.stringify(out).length>CORR_TAILLE_MAX) out={...out,st:[]};
  if(JSON.stringify(out).length>CORR_TAILLE_MAX) out={...out,epingles:[]};
  return JSON.stringify(out).length<=CORR_TAILLE_MAX?out:null;
}
// L'ENVOI. Le chemin de la correction écrite : le dossier de l'athlète, la même
// garde, et `feedbackSeen=false` + `feedbackDate` — la pastille de l'onglet
// Corrections et la notification existantes font le reste.
function enregistrerCorrectionMotion(email,videoId,motion){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||c.coachId!==currentUser?.id) return {ok:false,raison:'Élève introuvable ou non autorisé'};
  const idx=(Array.isArray(c.videos)?c.videos:[]).findIndex(v=>v&&v.id===videoId);
  if(idx<0) return {ok:false,raison:'Vidéo introuvable'};
  const m=motionCorrectionValide(motion);
  if(!m) return {ok:false,raison:'La correction est illisible : elle n’a pas été envoyée.'};
  c.videos[idx].motion=m;
  c.videos[idx].feedbackDate=Date.now();
  c.videos[idx].feedbackSeen=false;
  c.updatedAt=Date.now(); users[email]=c;
  const ok=DB.set('users',users);
  return {ok,envoi:CLOUD.pushOne(email,c),motion:m};
}
// ══ MOTION LAB — LES ANNOTATIONS (refonte du 21/09/2026) ═════════════════════
//
// Kevin : « Motion Lab doit devenir le véritable laboratoire d'analyse
// technique ». Le coach trace sur la vidéo — trajectoires, lignes, flèches,
// angles, repères anatomiques, textes, zones — chaque tracé avec son nom, sa
// couleur, son épaisseur et sa durée d'apparition, et une légende posée sur
// l'image. L'athlète revoit sa vidéo avec ces tracés, à leurs instants.
//
// ⚠ DANS L'ENTRÉE DE LA VIDÉO, ET NON DANS UN NŒUD À PART — même raison que
// les répétitions : les règles de la base ne partent pas avec le déploiement
// automatique, un nœud neuf serait refusé en production sans un mot. Le
// dossier de l'athlète a déjà les bons droits : le coach désigné écrit,
// l'athlète lit.
//
// ⚠ NON DESTRUCTIF. La vidéo n'est jamais touchée : un tracé est une donnée de
// quelques dizaines d'octets, posée PAR-DESSUS l'image au moment de la lire.
//
//   videos[i].annot = {v:1, majLe, leg:{on, titre, pos, taille, fond, op},
//     a:[{id, n (nom), t (type), c (#rrggbb), e (épaisseur px), d, f (ms),
//         p ("x,y x,y" normés 0-1000), k ([[ms,"x,y …"]…] images clés),
//         x (texte), ts (taille du texte), tf (fond), tc (contour),
//         cb (angle cible), lb ([étiquettes des points]), rel (points reliés),
//         et (nom affiché sur l'image), lg (dans la légende), h (masquée),
//         seg (la séquence), eo / mo (étiquette / mesure déplacées)}],
//     ech:{p ("x,y x,y" : haut et bas d'un disque), mm (son diamètre),
//          src (d'où vient la cote), ok (enregistrée)}}
//
// LE PRIX EST BORNÉ pour la raison de toujours — ce dossier part EN ENTIER à
// chaque synchronisation : trente tracés, soixante-quatre points chacun, cent
// images clés, et vingt-quatre kilo-octets au plus pour le tout.
//
// ⚠ CENT IMAGES CLÉS, ET PLUS VINGT-QUATRE (build 1390). Vingt-quatre suffisaient
//   à un suivi posé à la main ; pas au suivi automatique d'un angle sur une
//   série. Kevin, 22/09/2026 : « l'angle arrête de bouger à un certain temps ».
//   Huit répétitions en vingt-cinq secondes demandent au moins un bas et un
//   haut par répétition : sous ce plafond, la tolérance montait jusqu'à faire
//   de répétitions entières une ligne droite. Cent clés tiennent un angle
//   suivi en ~3,6 Ko ; le plafond de taille, lui, ne bouge pas — c'est
//   l'allègement d'annotValide qui fait la place quand il faut.
const ANNOT_MAX=30, ANNOT_PTS_MAX=64, ANNOT_CLES_MAX=100, ANNOT_NOM_MAX=40, ANNOT_TEXTE_MAX=80,
  ANNOT_ETIQ_MAX=14, ANNOT_TAILLE_MAX=24000;
// PURE. Des images clés ramenées à `max` au plus, réparties régulièrement dans
// le TEMPS de la liste : la première et la dernière restent toujours. Couper
// la fin — ce que faisait la relecture — figeait le tracé à la dernière clé
// gardée : le mouvement s'arrêtait net au milieu de la vidéo.
function _annotAmincir(k,max){
  const n=k.length, m=Math.max(2,Math.floor(max));
  if(n<=m) return k;
  const garde=new Set();
  for(let i=0;i<m;i++) garde.add(Math.round(i*(n-1)/(m-1)));
  return k.filter((_,i)=>garde.has(i));
}
// LES TYPES, et ce que chacun demande de points : [minimum, maximum].
const ANNOT_TYPES=Object.freeze({ligne:[2,2],fleche:[2,2],libre:[2,ANNOT_PTS_MAX],courbe:[2,24],
  cercle:[2,2],rect:[2,2],angle:[3,3],point:[1,12],texte:[1,1],zone:[2,2]});
const ANNOT_LEG_POS=Object.freeze(['hg','hd','bg','bd']);
// PURE. Un tracé de points normés, relu : null s'il n'a pas le bon nombre de
// points ou un point hors de l'image.
function _annotPoints(s,min,max){
  const pts=String(s==null?'':s).trim().split(' ');
  if(pts.length<min||pts.length>max) return null;
  if(!pts.every(q=>/^\d{1,4},\d{1,4}$/.test(q)&&q.split(',').every(n=>Number(n)<=1000))) return null;
  return pts.join(' ');
}
// PURE. Les annotations d'une vidéo si elles sont lisibles, null sinon. Tout
// est revérifié, et un tracé illisible TOMBE SEUL : les autres restent, parce
// que rien ne dépend de lui. La donnée vient du réseau et se dessine chez
// l'athlète — une couleur, un nom ou un nombre non contrôlé n'y entre pas.
function annotValide(doc){
  if(!doc||typeof doc!=='object'||doc.v!==1) return null;
  const num=(x,min,max)=>{ const v=Number(x); return isFinite(v)&&v>=min&&v<=max?v:null; };
  const txt=(x,max)=>String(x==null?'':x).replace(/[\u0000-\u001f]/g,' ').trim().slice(0,max);
  const couleur=x=>/^#[0-9a-f]{6}$/i.test(String(x||''))?String(x).toLowerCase():null;
  const L=doc.leg&&typeof doc.leg==='object'?doc.leg:{};
  const leg={on:L.on?1:0,titre:txt(L.titre,40)||'Analyse technique',
    pos:ANNOT_LEG_POS.includes(L.pos)?L.pos:'hg',
    taille:['s','m','l'].includes(L.taille)?L.taille:'m',
    fond:['sombre','clair','aucun'].includes(L.fond)?L.fond:'sombre',
    op:Math.round((num(L.op,0.3,1)||0.85)*100)/100};
  // LA LÉGENDE DÉPLACÉE AU DOUBLE-CLIC (build 1384) : son coin, en millièmes
  // de l'image. Les deux ou aucun.
  const lx=num(L.x,0,1000), ly=num(L.y,0,1000);
  if(lx!==null&&ly!==null){ leg.x=Math.round(lx); leg.y=Math.round(ly); }
  const vus=new Set();
  const a=_tabBloc(doc.a).map(x=>{
    if(!x||typeof x!=='object') return null;
    const id=txt(x.id,40);
    const bornes=ANNOT_TYPES[x.t];
    const c=couleur(x.c);
    const d=num(x.d,0,86400000), f=num(x.f,0,86400000);
    if(!id||vus.has(id)||!bornes||!c||d===null||f===null||f<=d) return null;
    const p=_annotPoints(x.p,bornes[0],bornes[1]);
    if(!p) return null;
    vus.add(id);
    const n=p.split(' ').length;
    const o={id,n:txt(x.n,ANNOT_NOM_MAX)||'Annotation',t:x.t,c,e:Math.round(num(x.e,1,12)||4),
      d:Math.round(d),f:Math.round(f),p};
    // LES IMAGES CLÉS : même nombre de points que le tracé, instants croissants
    // et distincts. Une clé fautive tombe ; le suivi garde les autres.
    // ⚠ AU-DELÀ DU PLAFOND, ON ALLÈGE, ON NE COUPE PLUS LA FIN (build 1390) :
    //   garder les ANNOT_CLES_MAX premières figeait le tracé au milieu de la
    //   vidéo. La lecture reste bornée — dix fois le plafond, pas davantage :
    //   la donnée vient du réseau.
    let k=[];
    for(const q of _tabBloc(x.k)){
      if(!Array.isArray(q)) continue;
      const t=num(q[0],0,86400000), pk=_annotPoints(q[1],n,n);
      if(t===null||!pk||(k.length&&Math.round(t)<=k[k.length-1][0])) continue;
      k.push([Math.round(t),pk]);
      if(k.length>=ANNOT_CLES_MAX*10) break;
    }
    k=_annotAmincir(k,ANNOT_CLES_MAX);
    if(k.length) o.k=k;
    if(x.t==='texte'){
      o.x=txt(x.x,ANNOT_TEXTE_MAX);
      if(!o.x) return null;
      o.ts=['s','m','l'].includes(x.ts)?x.ts:'m';
      o.tf=[0,1,2].includes(Number(x.tf))?Number(x.tf):1;
      if(x.tc) o.tc=1;
    }
    if(x.t==='angle'){ const cb=num(x.cb,0,180); if(cb!==null) o.cb=Math.round(cb); }
    if(x.t==='point'){
      const lb=_tabBloc(x.lb).slice(0,n).map(l=>txt(l,ANNOT_ETIQ_MAX));
      if(lb.some(Boolean)) o.lb=lb;
      if(x.rel&&n>1) o.rel=1;
    }
    // LES BASCULES : on n'écrit que ce qui s'écarte du défaut, pour garder la
    // donnée courte. Nom affiché et légende sont ALLUMÉS par défaut.
    // L'HORAIRE D'UNE TRAJECTOIRE SUIVIE (build 1385) : un instant par point,
    // croissants. Sinon il tombe, et la trajectoire redevient un trait fixe.
    if(x.t==='libre'&&typeof x.tp==='string'){
      const tl=x.tp.trim().split(/\s+/).map(Number);
      if(tl.length===n&&tl.every((v,i)=>Number.isInteger(v)&&v>=0&&v<=86400000&&(!i||v>=tl[i-1]))) o.tp=tl.join(' ');
    }
    // L'ÉTIQUETTE DÉPLACÉE (build 1384) : son décalage, en millièmes de
    // l'image ; absent tant qu'elle est à sa place. Un texte n'en a pas.
    if(x.t!=='texte'&&Array.isArray(x.eo)&&x.eo.length===2){
      const ex=num(x.eo[0],-1000,1000), ey=num(x.eo[1],-1000,1000);
      if(ex!==null&&ey!==null&&(Math.round(ex)||Math.round(ey))) o.eo=[Math.round(ex),Math.round(ey)];
    }
    // SA MESURE DÉPLACÉE (build 1391) : même règle que l'étiquette.
    if(x.t!=='texte'&&Array.isArray(x.mo)&&x.mo.length===2){
      const mx=num(x.mo[0],-1000,1000), my=num(x.mo[1],-1000,1000);
      if(mx!==null&&my!==null&&(Math.round(mx)||Math.round(my))) o.mo=[Math.round(mx),Math.round(my)];
    }
    if(x.et===0) o.et=0;
    if(x.lg===0) o.lg=0;
    if(x.h) o.h=1;
    // LE STYLE DU TRAIT (build 1382) : tirets ('t') ou pointillé ('p'). Plein
    // est le défaut, donc absent ; un texte n'a pas de trait.
    if(x.t!=='texte'&&(x.st==='t'||x.st==='p')) o.st=x.st;
    const seg=txt(x.seg,40); if(seg) o.seg=seg;
    return o;
  }).filter(Boolean).slice(0,ANNOT_MAX);
  let out={v:1,majLe:Math.round(num(doc.majLe,0,1e14)||0),leg,a};
  // L'ÉCHELLE (build 1391) : le haut et le bas d'un disque, son diamètre réel
  // en millimètres, d'où vient la cote, et `ok` une fois enregistrée. Sans
  // ses deux points elle tombe ; un diamètre hors de 10 à 60 cm n'est pas un
  // disque — il tombe seul, et l'échelle reste à compléter.
  // SES DEUX POINTS SONT AU DIXIÈME (build 1393) : le bord trouvé seul l'est au
  // dixième de pixel, et des millièmes entiers de l'image en perdraient la
  // moitié. Les tracés, eux, restent en millièmes entiers.
  const E=doc.ech&&typeof doc.ech==='object'?doc.ech:null;
  const EP=/^\d{1,4}(\.\d)?,\d{1,4}(\.\d)? \d{1,4}(\.\d)?,\d{1,4}(\.\d)?$/;
  const ep=E&&typeof E.p==='string'&&EP.test(E.p.trim())&&E.p.trim().split(/[ ,]/).every(n=>Number(n)<=1000)?E.p.trim():null;
  if(ep){
    const ech={p:ep};
    const mm=num(E.mm,100,600);
    const src=txt(E.src,80);
    if(mm!==null&&src){ ech.mm=Math.round(mm); ech.src=src; if(E.ok) ech.ok=1; }
    out.ech=ech;
  }
  // ⚠ LE PLAFOND NE DOIT PAS ÊTRE UNE SURPRISE À L'ENREGISTREMENT.
  //   AVANT LE BUILD 1390, LES IMAGES CLÉS DE TOUS LES TRACÉS TOMBAIENT D'UN
  //   COUP dès le premier octet de trop : un angle de plus, et tous les suivis
  //   de la vidéo s'annulaient ensemble, figés sur leur tracé de base. On
  //   ALLÈGE maintenant, par moitiés, le tracé qui porte le plus de clés — les
  //   autres ne bougent pas —, jusqu'à passer sous le plafond. Les clés ne
  //   tombent entièrement, puis les derniers tracés, qu'en tout dernier
  //   recours.
  const poids=()=>JSON.stringify(out).length;
  while(poids()>ANNOT_TAILLE_MAX){
    let iMax=-1, nMax=2;
    out.a.forEach((x,i)=>{ const nk=(x.k||[]).length; if(nk>nMax){ nMax=nk; iMax=i; } });
    if(iMax<0) break;
    out={...out,a:out.a.map((x,i)=>i===iMax?{...x,k:_annotAmincir(x.k,Math.ceil(nMax/2))}:x)};
  }
  if(poids()>ANNOT_TAILLE_MAX) out={...out,a:out.a.map(({k,...r})=>r)};
  while(poids()>ANNOT_TAILLE_MAX&&out.a.length) out={...out,a:out.a.slice(0,-1)};
  return out;
}
// PURE. Y a-t-il quelque chose à montrer à l'athlète ? Un document vide, ou
// dont tous les tracés sont masqués, ne vaut pas un bouton.
function annotAMontrer(doc){
  const d=annotValide(doc);
  return !!(d&&d.a.some(x=>!x.h));
}
// L'ENREGISTREMENT. Le chemin de la correction : le dossier de l'athlète, la
// même garde, et `feedbackSeen=false` + `feedbackDate` — la pastille et la
// notification existantes font le reste.
// ⚠ `opts.silencieux` (build 1392) : une RÉPARATION, pas une correction. Le
//   laboratoire prolonge seul les suivis que l'ancienne borne des 20 s avait
//   coupés ; l'athlète n'a rien à rouvrir pour ça, et une pastille « nouvelle
//   correction » pour une retouche qu'il n'a pas demandée serait du bruit.
//   Le document s'enregistre et part, la pastille ne bouge pas.
function enregistrerAnnotationsVideo(email,videoId,doc,opts){
  const users=DB.get('users')||{};
  const c=users[email];
  if(!c||c.coachId!==currentUser?.id) return {ok:false,raison:'Élève introuvable ou non autorisé'};
  const idx=(Array.isArray(c.videos)?c.videos:[]).findIndex(v=>v&&v.id===videoId);
  if(idx<0) return {ok:false,raison:'Vidéo introuvable'};
  const a=annotValide({...doc,majLe:Date.now()});
  if(!a) return {ok:false,raison:'Les annotations sont illisibles : elles n’ont pas été enregistrées.'};
  c.videos[idx].annot=a;
  if(!(opts&&opts.silencieux)&&a.a.some(x=>!x.h)){ c.videos[idx].feedbackDate=Date.now(); c.videos[idx].feedbackSeen=false; }
  c.updatedAt=Date.now(); users[email]=c;
  const ok=DB.set('users',users);
  return {ok,envoi:CLOUD.pushOne(email,c),annot:a};
}
// PURE. « 0:45 » : la durée d'une correction.
function _motionDuree(ms){
  const s=Math.max(0,Math.round((Number(ms)||0)/1000));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
// L'ÉCRAN DE LECTURE : l'athlète revoit la correction ; le coach peut la revoir
// aussi. Le dossier lu est le sien pour l'athlète, celui de son athlète pour le
// coach désigné — personne d'autre.
async function ouvrirCorrectionMotion(email,videoId){
  let u=null;
  if(currentUser&&currentUser.email===email) u=currentUser;
  else {
    const c=(DB.get('users')||{})[email];
    if(c&&currentUser&&currentUser.role==='coach'&&c.coachId===currentUser.id) u=c;
  }
  const v=u&&(Array.isArray(u.videos)?u.videos:[]).find(x=>x&&x.id===videoId);
  if(!v||(!motionCorrectionValide(v.motion)&&!annotAMontrer(v.annot))){ toast('Correction introuvable','var(--orange)'); return false; }
  try{ await chargerMotionLab(); }
  catch(e){ toast(e.message,'var(--orange)'); return false; }
  go('s-motion-correction');
  return window.mlAfficherCorrection(u,v);
}
function fermerCorrectionMotion(){
  try{ if(typeof window.mlQuitterCorrection==='function') window.mlQuitterCorrection(); }catch(e){}
  retourDe('s-motion-correction',currentUser?.role==='coach'?'s-coach-home':'s-videos');
  return true;
}
// « Répondre » : les canaux que le coach a publiés — la même feuille que
// « Un souci ? » sur l'accueil.
function repondreCorrectionMotion(){
  try{ _rendreContactCoach(currentUser); }catch(e){}
  if(typeof ouvrirContactCoach==='function'&&ouvrirContactCoach()) return true;
  toast('Ton coach n’a publié aucun moyen de contact.','var(--orange)');
  return false;
}
// LE CHARGEMENT DU MODULE (décision D3). Un fichier à part, demandé à la
// première ouverture : un athlète qui n'ouvre jamais le laboratoire ne le
// télécharge pas. `?v=` porte le build — le service worker sert ses assets
// cache d'abord, et une adresse neuve à chaque version garantit le bon fichier.
let _mlChargement=null;
// LOT T5 : les autres analyses du MÊME exercice (le lien posé à l'envoi de la
// vidéo depuis une série), la plus ancienne d'abord. Une vidéo sans ce lien
// n'est rien proposé : on ne devine pas l'exercice sur un nom.
function analysesComparables(c,v,lire){
  const lecteur=typeof lire==='function'?lire:segmentsVideo;
  const cle=v&&v.lien&&v.lien.exerciceCle;
  if(!cle) return [];
  const a=x=>{ try{ return lecteur(x).some(s=>s&&s.barre); }catch(e){ return false; } };
  if(!a(v)) return [];
  return ((c&&c.videos)||[]).filter(x=>x&&x!==v&&x.id!==v.id&&x.lien&&x.lien.exerciceCle===cle&&a(x))
    .sort((p,q)=>Number(p.date)-Number(q.date));
}
function comparerAnalyses(email,videoId){
  chargerMotionLab().then(()=>mlOuvrirComparaison(email,videoId))
    .catch(e=>toast((e&&e.message)||'Motion Lab n’a pas pu se charger.','var(--orange)'));
  return true;
}
function chargerMotionLab(){
  if(typeof window.mlOuvrir==='function') return Promise.resolve(true);
  if(_mlChargement) return _mlChargement;
  _mlChargement=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='./motion-lab.js?v='+encodeURIComponent(String(window.RC_BUILD||''));
    s.onload=()=>(typeof window.mlOuvrir==='function')?res(true)
      :(_mlChargement=null,rej(new Error('Motion Lab est illisible : recharge la page.')));
    s.onerror=()=>{ _mlChargement=null; s.remove();
      rej(new Error('Motion Lab n’a pas pu se charger : il faut être en ligne la première fois.')); };
    document.head.appendChild(s);
  });
  return _mlChargement;
}
// LE BROUILLON DE LA CORRECTION EST GARDÉ. Le laboratoire est un écran, et la
// feuille de correction se ferme pour le laisser passer : un commentaire tapé
// et des repères posés, pas encore enregistrés, seraient perdus au retour.
let _vcBrouillonMl=null;
async function ouvrirMotionLab(email,videoId){
  const c=(DB.get('users')||{})[email];
  if(!c||c.coachId!==currentUser?.id){ toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  const v=(Array.isArray(c.videos)?c.videos:[]).find(x=>x&&x.id===videoId);
  if(!v||!/\.(mp4|mov|webm|mkv)(\?|$)/i.test(v.url||'')){
    toast('Seule une vidéo déposée se découpe : un lien YouTube ou Drive ne donne pas accès aux images.','var(--orange)');
    return false;
  }
  try{ await chargerMotionLab(); }
  catch(e){ toast(e.message,'var(--orange)'); return false; }
  const g=document.getElementById('vc-general');
  _vcBrouillonMl=(g&&window._vcEmail===email&&window._vcVideoId===videoId)
    ?{email,videoId,general:g.value,tss:JSON.parse(JSON.stringify(window._tsAnnotations||[]))}:null;
  if(document.getElementById('modal-overlay')) closeModal();
  return window.mlOuvrir(email,videoId);
}
// LES DEUX BOUTONS DE LA BARRE sont écrits dans index.html, et un attribut
// d'événement doit nommer une fonction qui existe sur window DÈS LE
// CHARGEMENT — le module, lui, n'arrive qu'à la première ouverture.
function enregistrerMotionLab(){
  return (typeof window.mlEnregistrer==='function')?window.mlEnregistrer():false;
}
// La flèche de l'écran. Le module décide — il demande avant de perdre des
// répétitions non enregistrées ; sans lui, on revient simplement.
function fermerMotionLab(){
  if(typeof window.mlFermer==='function') return window.mlFermer();
  retourDe('s-coach-motion-lab');
  return true;
}
// Rappelée par le module une fois le laboratoire quitté : on revient là d'où
// l'on venait, et la correction de la même vidéo se rouvre, brouillon compris.
function _vcRouvrirApresMotionLab(email,videoId){
  retourDe('s-coach-motion-lab');
  const b=_vcBrouillonMl;
  _vcBrouillonMl=null;
  openVideoCorrection(email,videoId);
  if(b&&b.email===email&&b.videoId===videoId&&document.getElementById('vc-general')){
    document.getElementById('vc-general').value=b.general;
    _vcxCompte();
    window._tsAnnotations=b.tss;
    _renderTsAnnotations();
  }
  return true;
}

// ══ LA RÉPONSE VOCALE AU BILAN (30/09/2026) ════════════════════════════════
//
// Le coach répond à un bilan en parlant : trois minutes au plus, écoute, puis
// « Envoyer » ou « Recommencer ». Le texte pré-écrit (brouillonBilan) reste
// au-dessus, comme aide-mémoire. Le bilan reçoit
//   b.reponseAudio = {url, duree (s), at}
// et reponseCoach devient facultatif : un bilan est RÉPONDU par l'un OU
// l'autre (bilanRepondu), partout : hasNewBilan, bilansSansReponse, le
// brouillon, la carte de l'athlète, et le Worker (relances, notification).
//
// ⚠ L'HÉBERGEMENT EST CLOUDINARY, PAS FIREBASE STORAGE. Le bucket du projet
//   (repcore-sync.firebasestorage.app) n'existe pas : l'API répond « 404 Not
//   Found » (un bucket fermé répondrait 403), et le plan Spark n'en crée plus.
//   Cloudinary est ce qui porte déjà les vidéos, leurs annotations audio et
//   les photos. Chemin : repcore/audio/<athlète>/bilan_<id>_<ts>.
// ⚠ UN SEUL ENREGISTREUR (enregistreurAudio) : la correction vidéo s'en sert
//   aussi, par ses mêmes noms publics (startAudioRec, stopAudioRec,
//   _audioMediaRecorder…), qui en sont devenus des adaptateurs.
// ⚠ HORS LIGNE : l'envoi est refusé, l'enregistrement reste en mémoire et
//   s'envoie au retour du réseau. Micro refusé : un toast qui dit où l'ouvrir.
//   Passage en arrière-plan : l'enregistrement s'arrête et se garde.
const AUDIO_BILAN_MAX_S=180;
const MICRO_REFUSE='Micro non autorisé : active l’accès au microphone dans les réglages du navigateur';
// PURE. Un bilan est-il répondu ? Par écrit, ou de vive voix.
function bilanRepondu(b){
  return !!(b&&(b.reponseCoach||(b.reponseAudio&&b.reponseAudio.url)));
}
// PURE. « 1:05 ».
function dureeAudioTxt(s){
  const n=Math.max(0,Math.round(Number(s)||0));
  return Math.floor(n/60)+':'+String(n%60).padStart(2,'0');
}
// PURE. Le format d'enregistrement, dans l'ordre de préférence : Opus en WebM
// (Chrome, Firefox), en Ogg, puis MP4 (Safari iOS ne sait que lui).
function mimeAudioPrefere(estSupporte){
  const ok=estSupporte||(t=>{ try{ return typeof MediaRecorder!=='undefined'&&!!MediaRecorder.isTypeSupported&&MediaRecorder.isTypeSupported(t); }catch(e){ return false; } });
  for(const m of ['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4','audio/aac']) if(ok(m)) return m;
  return '';
}
// PURE. L'extension qui va avec.
function extensionAudio(mime){
  const m=String(mime||'').toLowerCase();
  if(m.indexOf('ogg')>=0) return '.ogg';
  if(m.indexOf('mp4')>=0||m.indexOf('aac')>=0||m.indexOf('m4a')>=0) return '.mp4';
  return '.webm';
}
/**
 * L'enregistreur, commun à la correction vidéo et au bilan. Rend un contrôleur
 * {recorder, arreter(), annuler(), secondes} ou null (micro refusé, navigateur
 * sans MediaRecorder). Arrêt automatique à maxSec. onFin(blob, duree) n'est
 * pas appelé après annuler().
 */
let _enregistreurCourant=null;
async function enregistreurAudio(o){
  const opt=o||{};
  const maxSec=Number(opt.maxSec)>0?Number(opt.maxSec):AUDIO_BILAN_MAX_S;
  const erreur=e=>{ try{ if(opt.onErreur) opt.onErreur(e); else toast(MICRO_REFUSE,'var(--orange)'); }catch(x){} return null; };
  if(typeof MediaRecorder==='undefined'||!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia) return erreur(new Error('indisponible'));
  let stream;
  try{ stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false}); }catch(e){ return erreur(e); }
  const mime=mimeAudioPrefere();
  let rec;
  try{ rec=new MediaRecorder(stream,mime?{mimeType:mime}:{}); }
  catch(e){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(x){} return erreur(e); }
  const morceaux=[], t0=Date.now();
  let minut=null, annule=false;
  const ctrl={recorder:rec,maxSec,secondes:0,mime:rec.mimeType||mime,
    arreter(){ clearInterval(minut); try{ if(rec.state!=='inactive') rec.stop(); }catch(e){} },
    annuler(){ annule=true; ctrl.arreter(); }};
  rec.ondataavailable=e=>{ if(e.data&&e.data.size>0) morceaux.push(e.data); };
  rec.onstop=()=>{
    clearInterval(minut);
    try{ stream.getTracks().forEach(t=>t.stop()); }catch(e){}
    if(_enregistreurCourant===ctrl) _enregistreurCourant=null;
    if(annule) return;
    const blob=new Blob(morceaux,{type:rec.mimeType||mime||'audio/webm'});
    const duree=Math.min(maxSec,Math.max(1,Math.round((Date.now()-t0)/1000)));
    try{ if(opt.onFin) opt.onFin(blob,duree); }catch(e){}
  };
  try{ rec.start(100); }catch(e){ try{ stream.getTracks().forEach(t=>t.stop()); }catch(x){} return erreur(e); }
  _enregistreurCourant=ctrl;
  minut=setInterval(()=>{
    ctrl.secondes++;
    try{ if(opt.onTic) opt.onTic(ctrl.secondes,maxSec); }catch(e){}
    if(ctrl.secondes>=maxSec) ctrl.arreter();
  },1000);
  return ctrl;
}

// ── La réponse vocale, dans le bloc de réponse du bilan ─────────────────
let _rv=null;                 // {email, id, etat:'rec'|'ecoute'|'envoi', ctrl, blob, duree, url}
function _rvId(id){ return 'rv_'+id; }
function _rvHtml(b,c){
  const id=_idBilan(b);
  const a=b&&b.reponseAudio;
  const lu=b&&b.reponseVue===true;
  const deja=(a&&a.url)?'<div class="rv-envoyee"><div class="rv-t">Ta réponse vocale · '+escapeHtml(dureeAudioTxt(a.duree))+(lu?' · lue':' · non lue')+'</div>'
    +'<audio controls preload="none" src="'+escapeHtml(a.url)+'"></audio></div>':'';
  return deja+'<div id="'+escapeHtml(_rvId(id))+'" class="rv">'+_rvCorps(c&&c.email,id,!!(a&&a.url))+'</div>';
}
function _rvCorps(email,id,deja){
  const s=_rv&&_rv.email===email&&_rv.id===id?_rv:null;
  const em=_attrArg(String(email||'')), ide=_attrArg(String(id||''));
  if(!s) return '<button type="button" class="btn btn-outline btn-sm rv-b" onclick="rvDemarrer('+em+','+ide+')">'+icon('mic',14)+' '+(deja?'Nouvelle réponse vocale':'Répondre en vocal')+'</button>';
  if(s.etat==='rec') return '<div class="rv-rec" role="status"><span class="rv-point" aria-hidden="true"></span><span id="rv-temps">'+dureeAudioTxt(s.ctrl?s.ctrl.secondes:0)+' / '+dureeAudioTxt(AUDIO_BILAN_MAX_S)+'</span>'
    +'<button type="button" class="btn btn-red btn-sm rv-b2" onclick="rvArreter()">Arrêter</button></div>';
  if(s.etat==='envoi') return '<div class="rv-rec" role="status">Envoi de ta réponse vocale…</div>';
  return '<div class="rv-ecoute"><audio controls src="'+escapeHtml(s.url||'')+'"></audio>'
    +'<div class="rv-l">'+(s.blob&&!s.blob.size?'Enregistrement vide : vérifie ton micro et recommence.':escapeHtml(dureeAudioTxt(s.duree))+(s.enAttente?' · en attente du réseau':''))+'</div>'
    +'<div class="rv-bs"><button type="button" class="btn btn-outline btn-sm rv-b2" onclick="rvRecommencer()">Recommencer</button>'
    +'<button type="button" class="btn btn-red btn-sm rv-b2" onclick="rvEnvoyer()">Envoyer</button></div>'
    +'<button type="button" class="rv-lien" onclick="rvAnnuler()">Annuler</button></div>';
}
function _rvRepeindre(){
  if(!_rv) return;
  const z=document.getElementById(_rvId(_rv.id));
  if(z) z.innerHTML=_rvCorps(_rv.email,_rv.id,false);
}
async function rvDemarrer(email,id){
  if(_rv&&_rv.etat==='rec') return false;
  if(_rv&&_rv.url) try{ URL.revokeObjectURL(_rv.url); }catch(e){}
  _rv={email,id,etat:'rec',ctrl:null,blob:null,duree:0,url:null};
  _rvRepeindre();
  const s=_rv;
  const ctrl=await enregistreurAudio({maxSec:AUDIO_BILAN_MAX_S,
    onTic:(sec)=>{ const t=document.getElementById('rv-temps'); if(t) t.textContent=dureeAudioTxt(sec)+' / '+dureeAudioTxt(AUDIO_BILAN_MAX_S); },
    onFin:(blob,duree)=>{ if(_rv!==s) return; s.blob=blob; s.duree=duree; s.url=URL.createObjectURL(blob); s.etat='ecoute'; s.ctrl=null; _rvRepeindre(); }});
  if(!ctrl){ if(_rv===s){ _rv=null; } const z=document.getElementById(_rvId(id)); if(z) z.innerHTML=_rvCorps(email,id,false); return false; }
  s.ctrl=ctrl;
  _rvRepeindre();
  return true;
}
function rvArreter(){ if(_rv&&_rv.ctrl) _rv.ctrl.arreter(); }
function rvRecommencer(){ const s=_rv; if(!s) return false; return rvDemarrer(s.email,s.id); }
function rvAnnuler(){
  const s=_rv; if(!s) return false;
  if(s.ctrl) s.ctrl.annuler();
  if(s.url) try{ URL.revokeObjectURL(s.url); }catch(e){}
  _rv=null;
  const z=document.getElementById(_rvId(s.id)); if(z) z.innerHTML=_rvCorps(s.email,s.id,false);
  return true;
}
// L'envoi vers Cloudinary : repcore/audio/<athlète>/bilan_<id>_<ts>.
async function _audioBilanUpload(blob,athleteCle,bilanId){
  const ts=Date.now();
  const nom='bilan_'+String(bilanId).replace(/[^A-Za-z0-9_-]/g,'')+'_'+ts;
  const file=new File([blob],nom+extensionAudio(blob.type),{type:blob.type||'audio/webm'});
  if(!/^audio\//.test(file.type)||file.size>AUDIO_MAX_OCTETS) throw new Error('Enregistrement invalide ou trop lourd (maximum '+_mo(AUDIO_MAX_OCTETS)+').');
  const sig=await _cloudinarySigner('repcore/audio/'+String(athleteCle).replace(/[^A-Za-z0-9_@,.-]/g,'_'),'audio',nom);
  const fd=new FormData();
  fd.append('file',file);
  _champsDansFormData(fd,sig.champs);
  const res=await fetch(sig.url,{method:'POST',body:fd});
  if(!res.ok) throw new Error('Erreur serveur '+res.status);
  const d=await res.json();
  if(d.error) throw new Error(d.error.message);
  try{ rcq('cld_envois',1); rcqOctets('cld_ko',file.size||Number(d.bytes)||0); }catch(e){}
  return d.secure_url;
}
async function rvEnvoyer(){
  const s=_rv;
  if(!s||!s.blob) return false;
  // Un micro coupé ou muet rend un enregistrement VIDE : il ne part pas.
  if(!s.blob.size){ toast('Rien n’a été enregistré : vérifie ton micro et recommence.','var(--orange)'); return false; }
  if(typeof navigator!=='undefined'&&navigator.onLine===false){
    s.enAttente=true; _rvRepeindre();
    toast('Pas de réseau : ta réponse vocale est gardée ici, envoie-la une fois connecté.','var(--orange)');
    return false;
  }
  const users=DB.get('users')||{};
  const c=users[s.email];
  if(!c||!_estMonAthlete(c,currentUser)){ toast('Élève introuvable ou non autorisé','var(--orange)'); return false; }
  const b=(c.bilans||[]).find(x=>_idBilan(x)===s.id);
  if(!b){ toast('Bilan introuvable','var(--red)'); return false; }
  s.etat='envoi'; _rvRepeindre();
  let url;
  try{ url=await _audioBilanUpload(s.blob,String(s.email).replace(/\./g,','),s.id); }
  catch(e){ s.etat='ecoute'; _rvRepeindre(); toast(_cloudinaryUserMsg(e,'audio'),'var(--orange)'); return false; }
  // Le dossier est relu APRÈS l'envoi : une synchro a pu l'avancer entre-temps.
  const users2=DB.get('users')||{}, c2=users2[s.email];
  const b2=c2&&(c2.bilans||[]).find(x=>_idBilan(x)===s.id);
  if(!b2){ s.etat='ecoute'; _rvRepeindre(); toast('Bilan introuvable','var(--red)'); return false; }
  const _premiere=!bilanRepondu(b2), _indice=c2.bilans.indexOf(b2);
  b2.reponseAudio={url,duree:s.duree,at:Date.now()};
  b2.reponseDate=Date.now();
  b2.reponseVue=false;
  users2[s.email]=c2;
  const ok=DB.set('users',users2);
  const envoi=CLOUD.pushOne(s.email,c2);
  noterContact(c2.id);
  if(_premiere) try{ rcmCoach('coach_bilan_repondu'); }catch(e){}
  // La même notification que la réponse écrite : le serveur relit le bilan.
  if(_premiere) Promise.resolve(envoi).then(r=>{ if(r!==false) deposerEvenement({type:'reponse_bilan',dest:String(s.email).replace(/\./g,','),i:String(_indice)}); }).catch(()=>{});
  try{ URL.revokeObjectURL(s.url); }catch(e){}
  _rv=null;
  toastSync(ok,envoi,'Réponse vocale envoyée. '+(c2.fname||'Ton athlète')+' l’écoutera à sa prochaine ouverture.','la réponse est');
  // L'enchaînement, comme la réponse écrite.
  try{ if(_proposerBilanSuivant(_fileBilansSuivants(c2.id))) return true; }catch(e){}
  try{ openClientDetail(c2.id,true); }catch(e){}
  return true;
}

// ======= AUDIO RECORDING =======
// ADAPTATEURS : la correction vidéo garde ses noms, l'enregistrement passe par enregistreurAudio.
let _audioMediaRecorder=null,_audioChunks=[],_audioBlob=null,_audioPreviewUrl=null,_audioTimerInterval=null,_audioCtrl=null;
function toggleAudioRec(){
  if(_audioMediaRecorder&&_audioMediaRecorder.state==='recording') stopAudioRec();
  else startAudioRec();
}
async function startAudioRec(){
  // ⚠ L'INSTANT EST PRIS SUR LE LECTEUR (lot 7). Le comparateur le faisait, et
  //   c'est le seul geste qu'on aurait perdu avec lui : lire l'instant a
  //   l'ecran, ouvrir le clavier, taper « 0:12 », puis parler, ce sont trois
  //   gestes de trop, et a cinq gestes le coach repart sur Instagram.
  //   LE CHAMP RESTE MODIFIABLE, et ce qui y est deja ecrit n'est jamais
  //   ecrase : on ne prend l'instant que sur un champ vide.
  try{
    const champ=document.getElementById('vc-audio-ts');
    const v=_rcVideo('vc-video');
    const t=v?Number(v.currentTime):NaN;
    if(champ&&!String(champ.value||'').trim()&&isFinite(t)&&t>0) champ.value=secsToTs(t);
  }catch(e){}
  _audioChunks=[];_audioBlob=null;
  // Le plafond de la correction vidéo reste deux minutes.
  const ctrl=await enregistreurAudio({maxSec:120,
    onTic:(secs)=>{
      const st=document.getElementById('vc-audio-status');
      if(st)st.textContent='Enregistrement… '+Math.floor(secs/60)+':'+(secs%60<10?'0':'')+secs%60;
    },
    onFin:(blob)=>{
      _audioBlob=blob;
      if(_audioPreviewUrl) URL.revokeObjectURL(_audioPreviewUrl);
      _audioPreviewUrl=URL.createObjectURL(_audioBlob);
      const player=document.getElementById('vc-audio-player');
      if(player){player.src=_audioPreviewUrl;player.load();}
      const preview=document.getElementById('vc-audio-preview');if(preview)preview.style.display='block';
      const btn=document.getElementById('vc-audio-btn');if(btn){btn.innerHTML=icon('mic',14)+' Démarrer l\'enregistrement';btn.style.color='';}
      const status=document.getElementById('vc-audio-status');if(status)status.textContent='Écoute et ajoute si c\'est bon.';
      clearInterval(_audioTimerInterval);
    }});
  if(!ctrl){ _audioCtrl=null; _audioMediaRecorder=null; return; }
  _audioCtrl=ctrl; _audioMediaRecorder=ctrl.recorder;
  clearInterval(_audioTimerInterval);
  const btn=document.getElementById('vc-audio-btn');if(btn){btn.textContent='Arrêter';btn.style.color='var(--red)';}
  const preview=document.getElementById('vc-audio-preview');if(preview)preview.style.display='none';
  const status=document.getElementById('vc-audio-status');if(status)status.textContent='Enregistrement… 0:00';
}
function stopAudioRec(){
  if(_audioMediaRecorder&&_audioMediaRecorder.state!=='inactive')_audioMediaRecorder.stop();
  clearInterval(_audioTimerInterval);
}
async function confirmAudioAnnotation(){
  if(!_audioBlob){toast('Aucun enregistrement','var(--orange)');return;}
  const ts=(document.getElementById('vc-audio-ts')?.value||'').trim();
  if(!ts)return toast('Renseigne le timestamp avant d\'ajouter','var(--orange)');
  if(!/^\d+:\d{2}$/.test(ts))return toast('Format invalide : utilise m:ss (ex: 0:45)','var(--orange)');
  const targetEmail=currentUser.email; // capturé avant tout await
  const status=document.getElementById('vc-audio-status');
  if(status)status.textContent='Envoi…';
  try{
    const ext=_audioBlob.type.includes('ogg')?'.ogg':'.webm';
    const file=new File([_audioBlob],'audio_'+Date.now()+ext,{type:_audioBlob.type});
    if(!file.type.startsWith('audio/')||file.size>AUDIO_MAX_OCTETS){
      if(status)status.textContent='';
      return toast('Fichier audio invalide ou trop volumineux (maximum '+_mo(AUDIO_MAX_OCTETS)+').','var(--orange)');
    }
    const url=await _cloudinaryUpload(file);
    if(currentUser?.email!==targetEmail){
      const allUsers=DB.get('users')||{};
      if(!allUsers[targetEmail]){toast('Session expirée : audio non sauvegardé.','var(--orange)');return;}
    }
    if(!window._tsAnnotations)window._tsAnnotations=[];
    window._tsAnnotations.push({ts,note:'message audio',audioUrl:url});
    _renderTsAnnotations();
    cancelAudioAnnotation();
    document.getElementById('vc-audio-ts').value='';
    if(status) _texteIco(status,ICO.coche+' Message audio ajouté');
  }catch(e){
    console.error('[confirmAudioAnnotation]',e);
    if(status)status.textContent='';
    toast(_cloudinaryUserMsg(e,'audio'),'var(--orange)');
  }
}
async function uploadAudioFile(input){
  const file=input.files[0];if(!file)return;
  if(!file.type.startsWith('audio/')){
    toast('Fichier invalide : sélectionne un fichier audio (MP3, M4A, WebM…)','var(--orange)');
    input.value='';return;
  }
  if(file.size>AUDIO_MAX_OCTETS){
    toast('Fichier trop volumineux (maximum '+_mo(AUDIO_MAX_OCTETS)+').','var(--orange)');
    input.value='';return;
  }
  const ts=(document.getElementById('vc-audio-ts')?.value||'').trim();
  if(!ts){toast('Renseigne le timestamp d\'abord','var(--orange)');input.value='';return;}
  if(!/^\d+:\d{2}$/.test(ts)){toast('Format invalide : utilise m:ss','var(--orange)');input.value='';return;}
  const targetEmail=currentUser.email; // capturé avant tout await
  const status=document.getElementById('vc-audio-status');
  if(status)status.textContent='Envoi…';
  try{
    const url=await _cloudinaryUpload(file);
    if(currentUser?.email!==targetEmail){
      const allUsers=DB.get('users')||{};
      if(!allUsers[targetEmail]){toast('Session expirée : audio non sauvegardé.','var(--orange)');input.value='';return;}
    }
    if(!window._tsAnnotations)window._tsAnnotations=[];
    window._tsAnnotations.push({ts,note:'message audio',audioUrl:url});
    _renderTsAnnotations();
    document.getElementById('vc-audio-ts').value='';
    input.value='';
    if(status) _texteIco(status,ICO.coche+' Message audio ajouté');
  }catch(e){
    console.error('[uploadAudioFile]',e);
    if(status)status.textContent='';
    toast(_cloudinaryUserMsg(e,'audio'),'var(--orange)');
  }
}
function cancelAudioAnnotation(){
  if(_audioPreviewUrl){URL.revokeObjectURL(_audioPreviewUrl);_audioPreviewUrl=null;}
  _audioBlob=null;_audioChunks=[];
  // Annuler, c'est jeter : le son en cours ne revient pas en aperçu.
  if(_audioCtrl){ _audioCtrl.annuler(); _audioCtrl=null; }
  else if(_audioMediaRecorder&&_audioMediaRecorder.state!=='inactive')_audioMediaRecorder.stop();
  clearInterval(_audioTimerInterval);
  const preview=document.getElementById('vc-audio-preview');if(preview)preview.style.display='none';
  const btn=document.getElementById('vc-audio-btn');if(btn){btn.innerHTML=icon('mic',14)+' Démarrer l\'enregistrement';btn.style.color='';}
  const status=document.getElementById('vc-audio-status');if(status)status.textContent='';
}

// ======= STEPS =======
function getStepsWeek(){
  const today=new Date(),dow=today.getDay();
  const mon=new Date(today);
  mon.setDate(today.getDate()-(dow===0?6:dow-1));
  return Array.from({length:7},(_,i)=>{
    const d=new Date(mon);d.setDate(mon.getDate()+i);
    return localISODate(d);
  });
}
// ── Jour saisi dans Pas et Sommeil ──────────────────────────────────────────
// Les deux cartes n'acceptaient que la date du jour : une nuit oubliée au
// réveil, ou des pas relevés le lendemain, n'étaient plus saisissables du tout.
// _recordSteps prenait déjà une date en paramètre, seul l'appelant la figeait.
// null signifie « aujourd'hui » : la valeur n'est donc jamais périmée si l'app
// reste ouverte au passage de minuit.
let _stepsDate=null, _sleepDate=null;
function _jourSteps(){ return _stepsDate||localISODate(new Date()); }
// ── Bonjour / bonsoir ────────────────────────────────────────────────────
// La bascule etait a MIDI : « Bonsoir » des 12 h 01, ce qui n a de sens
// nulle part. Bornes retenues : bonjour de 5 h a 17 h, bonsoir de 17 h a 5 h.
//
// L HEURE EST CELLE DE PARIS, explicitement, et pas celle de l appareil.
// Consequence assumee : un athlete en deplacement hors de France lira
// « Bonsoir » a une heure ou il fait encore jour chez lui. C est le choix
// demande — le produit parle depuis le fuseau de son coach.
//
// PURE, et l heure est INJECTABLE : sans ce parametre, on ne pourrait tester
// les bornes qu en attendant 17 h.
const SALUT_DEBUT_JOUR=5, SALUT_DEBUT_SOIR=17;
function _heureParis(d){
  const base=(d instanceof Date)?d:new Date();
  // Intl plutot qu un decalage code en dur : l heure d ete change deux fois
  // par an, et un +1 fixe serait faux la moitie de l annee.
  try{
    const h=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',
      hourCycle:'h23'}).format(base);
    const n=parseInt(h,10);
    if(isFinite(n)&&n>=0&&n<=23) return n;
  }catch(e){}
  // Fuseau indisponible : on retombe sur l heure de l appareil plutot que de
  // ne rien dire du tout.
  return base.getHours();
}
function salutation(d){
  const h=(typeof d==='number')?d:_heureParis(d);
  return (h>=SALUT_DEBUT_JOUR&&h<SALUT_DEBUT_SOIR)?'Bonjour,':'Bonsoir,';
}
function _jourSleep(){ return _sleepDate||localISODate(new Date()); }
// PURE. Le jour voisin, ou null quand il sort des bornes. Les fleches de
// _bandeauJour se desactivent sur ce null : elles existent depuis toujours,
// mais ni les pas ni le sommeil ne les passaient — pour rattraper trois jours
// il fallait ouvrir trois fois le selecteur de date natif du telephone.
function _jourVoisin(iso,pas,retention){
  const d=new Date(String(iso)+'T12:00:00');
  if(isNaN(d.getTime())) return null;
  d.setDate(d.getDate()+pas);
  const v=localISODate(d);
  const auj=localISODate(new Date());
  if(v>auj) return null;                                   // on ne saisit pas l'avenir
  const min=localISODate(new Date(Date.now()-(retention||STEPS_RETENTION_JOURS)*24*3600*1000));
  return v<min?null:v;
}
function changeStepsDate(v){ _stepsDate=(v&&v!==localISODate(new Date()))?v:null; _rerenderLifestyle(); }
function changeSleepDate(v){ _sleepDate=(v&&v!==localISODate(new Date()))?v:null; _rerenderLifestyle(); }
// Re-rend la ou les cartes réellement affichées. Un loadLifestyle() aveugle
// ferait sortir de l'écran Pas ou Sommeil autonome au moindre changement de
// date, ce qui interromprait la saisie qu'on cherche justement à permettre.
function _rerenderLifestyle(){
  const actif=id=>document.getElementById(id)?.classList.contains('active');
  if(actif('s-lifestyle')){ try{ sanRendre(); }catch(e){
    // Repli sur les anciens rendus : l'ecran ne doit jamais rester vide.
    loadSteps('lifestyle-steps-content',{avecImport:false}); loadSleep('lifestyle-sleep-content',null,{avecImport:false}); } return; }
  if(actif('s-steps')){ loadSteps('steps-content'); return; }
  if(actif('s-sleep')){ loadSleep('sleep-content'); return; }
  loadLifestyle();
}
// Bandeau de sélection du jour, commun aux deux cartes.
// Bornes : jamais le futur (on ne saisit pas une nuit qui n'a pas eu lieu),
// jamais au-delà de la rétention, sinon la purge effacerait la saisie aussitôt.
// LE TITRE DE JOUR, FORME UNIQUE DU MODULE. Trois ecrans le dessinaient
// chacun de son cote : le journal en var(--fs-md) gras Montserrat, les deux
// ecrans de cafeine en var(--fs-md) gras aussi, et les pas en Bebas 15 avec
// 2,5 px d interlettre. C est cette derniere forme qui gagne, et elle vaut
// desormais pour les cinq.
//
// `retention` reste un PARAMETRE et non une constante en dur : la cafeine
// borne a CAFF_RETENTION_JOURS, les pas a STEPS_RETENTION_JOURS, et ces deux
// bornes ne doivent pas fusionner.
function _bandeauJour(inputId,jour,handler,opts){
  const {avecFleches=false,prev=null,next=null,retention=null,libelle=null}=opts||{};
  const auj=localISODate(new Date());
  const min=localISODate(new Date(Date.now()-(retention||STEPS_RETENTION_JOURS)*24*3600*1000));
  // Midi et non minuit : 'YYYY-MM-DD' seul est interprété en UTC, ce qui
  // décalerait l'affichage d'un jour à l'ouest de Greenwich.
  const estAuj=jour===auj;
  // Le jour de la semaine SEUL, pas la date complète : le sélecteur affiche
  // déjà 26/07, la répéter en toutes lettres débordait de la carte sur mobile.
  // Le jour reste utile, lui : c'est ce qui distingue un jour ON d'un jour OFF.
  const lbl=libelle!=null?libelle:(estAuj?"Aujourd'hui"
    :new Date(jour+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long'}));
  // LES FLECHES, quand l ecran en demande. Style repris tel quel de la version
  // cafeine : fond transparent, bordure #333, et la variante desactivee en #222.
  const _fl=(cible,txt,actif)=>actif
    ?`<button onclick="${handler}('${cible}')" style="flex:none;background:none;border:1px solid var(--border-strong);color:var(--text-mid);border-radius:var(--r-2);padding:6px 14px;font-size:15px;cursor:pointer;font-family:Montserrat,sans-serif">${txt}</button>`
    :`<button disabled style="flex:none;background:none;border:1px solid var(--border);color:var(--text-dim);border-radius:var(--r-2);padding:6px 14px;font-size:15px;cursor:not-allowed">${txt}</button>`;
  const _gauche=avecFleches?_fl(prev,'←',!!prev&&prev>=min):'';
  const _droite=avecFleches?_fl(next,'→',!!next&&next<=auj):'';
  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
    ${_gauche}
    <div style="flex:1;min-width:0;font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:${estAuj?'#8a8a8a':'var(--red)'};text-transform:uppercase;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lbl}</div>
    ${_droite}
    ${estAuj?'':`<button onclick="${handler}('')" title="Revenir à aujourd'hui" style="flex:none;background:var(--surface-1);border:1px solid var(--border);color:var(--sub);border-radius:var(--r-2);padding:6px 10px;font-family:Montserrat,sans-serif;font-size:var(--fs-2xs);font-weight:800;letter-spacing:.5px;cursor:pointer">AUJ.</button>`}
    <input type="date" id="${inputId}" value="${jour}" min="${min}" max="${auj}" onchange="${handler}(this.value)" aria-label="Choisir le jour" style="flex:0 0 auto;width:138px;box-sizing:border-box;background:var(--surface-1);border:1px solid var(--border);color:#ccc;border-radius:var(--r-2);padding:6px 8px;font-family:Montserrat,sans-serif;font-size:var(--fs-xs);color-scheme:dark">
  </div>`;
}

// PURE. L'objectif de pas d'un jour donné.
//
// LE TYPE DÉCLARÉ D'ABORD : stepsDayType est un choix explicite de l'athlète,
// rien ne le prime. À défaut, le PROGRAMME : nutIsOnDay lit sessions_config,
// la source que la nutrition emploie déjà pour ses jours ON/OFF — quelqu'un
// qui s'entraîne lundi, mercredi, vendredi n'a pas à le redéclarer ici.
//
// ET `off` EN DERNIER RECOURS : c'est l'objectif le plus bas, le seul qu'on
// puisse appliquer sans rien reprocher à quelqu'un dont on ignore le jour.
// Le repli codé en dur à 10 000 jugeait sur un chiffre que l'athlète n'avait
// jamais choisi.
// LES OBJECTIFS DE PAS PAR DÉFAUT, gelés et partagés.
//
// Ils étaient écrits en dur dans loadSteps. Ce défaut n’est pas décoratif :
// il colore les barres de la semaine et alimente _stepsObjectifJour, donc
// l’athlète le VIT. La fiche coach, elle, lisait `stepsGoals` sans repli et
// masquait la ligne « Objectif » pour tout dossier n’ayant jamais ouvert le
// réglage : le coach en concluait qu’aucun objectif n’était fixé.
const STEPS_GOALS_DEFAUT=Object.freeze({on:10000,off:7000});
function _stepsObjectifJour(goals,type,date){
  const g=goals||{};
  const on=Number(g.on)>0?Number(g.on):null;
  const off=Number(g.off)>0?Number(g.off):null;
  if(type==='on') return on||off||0;
  if(type==='off') return off||on||0;
  let estOn=false;
  try{ estOn=!!(date&&nutIsOnDay(date)); }catch(e){ estOn=false; }
  if(estOn&&on) return on;
  return off||on||0;
}
// LE GABARIT DE BARRE, PARTAGE PAR LES PAS ET LE SOMMEIL. Les deux ecrans
// dessinaient la meme barre a quelques octets pres, et ces octets-la
// divergeaient deja : plancher a 6 contre 4, hauteur minimale a 5 px contre 4.
// Une seule fonction, et la prochaine retouche ne peut plus les separer.
//
// LE LISERE HAUT REMPLACE UN GLOW MORT. Les deux ecrans calculaient une
// variable de lueur pour le jour courant sans jamais l employer : ce jour
// n etait donc signale nulle part. C est ce que ce calcul essayait de dire.
// LA BARRE NAIT A 4 px ET MONTE. Elle etait rendue a sa hauteur finale avec
// une transition a cote : une transition CSS n'interpole qu'entre deux valeurs
// dont la premiere a ete peinte, celle-ci n'a donc jamais joue une seule fois.
// _animerJauges pose la hauteur au second requestAnimationFrame. Le gabarit est
// PARTAGE par les pas et le sommeil : une fonction modifiee, deux ecrans.
function _htmlBarreSemaine(pct,col,isToday,accentBas){
  return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%"><div class="rc-barre-v" data-bar-h="${pct}" style="width:82%;height:4px;background:linear-gradient(180deg,${col},${col}55);border-radius:var(--r-1) var(--r-1) 0 0;min-height:4px;box-shadow:0 0 ${isToday?'14':'8'}px ${col}${isToday?'aa':'55'},inset 0 1px 0 rgba(255,255,255,.25);transition:height 420ms var(--c-out) var(--rcb-d,0ms);${isToday?'border-top:1px solid var(--border);':''}${accentBas?'border-bottom:2px solid '+accentBas+';':''}"></div></div>`;
}
// ⚠ `opts.avecImport` EST EXPLICITE, ET NON DEDUIT DU NOM DU CONTENEUR.
// Deduire « je suis sur la page autonome » de `containerId==='steps-content'`
// marchait tant qu'il n'y avait que deux appelants ; le jour ou un
// troisieme ecran rend cette page, il herite d'un comportement que
// personne n'a choisi pour lui. L'appelant dit ce qu'il veut.
// Par defaut : true, parce que les deux ecrans autonomes le veulent et
// que c'est le seul endroit ou l'oubli serait invisible.
function loadSteps(containerId='steps-content',opts){
  const _avecImport=!opts||opts.avecImport!==false;
  // « repeint » : la descente repeint l'ecran deja affiche, SANS go() — voir
  // _repeindreLifestyleAthlete. Tous les autres appels passent par go() comme
  // avant.
  if(containerId==='steps-content'&&!(opts&&opts.repeint)) go('s-steps');
  const log=currentUser.stepsLog||[];
  const goals=currentUser.stepsGoals||STEPS_GOALS_DEFAUT;
  const dayTypes=currentUser.stepsDayType||{};
  const todayStr=localISODate(new Date());
  const dayNames=['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
  const weekDates=getStepsWeek();
  const weekData=weekDates.map((d,i)=>({
    date:d,label:dayNames[i],
    count:(log.find(e=>e.date===d)||{}).count??null,
    type:dayTypes[d]??null,
    isToday:d===todayStr
  }));
  const withData=weekData.filter(d=>d.count!==null);
  const weekAvg=withData.length?Math.round(withData.reduce((s,d)=>s+d.count,0)/withData.length):0;
  const maxVal=Math.max(...weekData.map(d=>d.count||0),1);
  // Le graphe hebdomadaire reste sur la semaine en cours ; seule la carte de
  // saisie suit le jour choisi, qui peut être hors de cette semaine.
  const selStr=_jourSteps();
  const todayEntry={count:(log.find(e=>e.date===selStr)||{}).count??null};
  const todayType=dayTypes[selStr]??null;
  // LE JOUR EN PLUS DU TYPE : sans lui, impossible de déduire quoi que ce soit
  // du programme, et le repli restait un chiffre en dur.
  const stepColor=(n,type,date)=>{
    if(!n) return 'var(--border)';
    const goal=_stepsObjectifJour(goals,type,date);
    if(!(goal>0)) return 'var(--border)';
    if(n>=goal) return '#22c55e';
    if(n>=goal*0.6) return '#f97316';
    return ROUGE_MARQUE;
  };
  const fmt=n=>n?n.toLocaleString('fr-FR'):'-';
  const avgColor=weekAvg>=goals.on?'#22c55e':weekAvg>=goals.on*0.6?'#f97316':weekAvg>0?ROUGE_MARQUE:'#777777';

  let bars='';
  weekData.forEach(d=>{
    const pct=d.count?Math.max(5,Math.round(d.count/maxVal*100)):4;
    const col=stepColor(d.count||0,d.type,d.date);
    const typeAccent=d.type==='on'?ROUGE_MARQUE:d.type==='off'?'#60a5fa':'transparent';
    bars+=_htmlBarreSemaine(pct,col,d.isToday,typeAccent);
  });

  let labels='';
  weekData.forEach(d=>{
    labels+=`<div style="flex:1;text-align:center;font-size:var(--fs-xs);font-weight:800;color:${d.isToday?'var(--red)':'var(--sub)'};text-transform:uppercase;letter-spacing:.5px">${d.label}</div>`;
  });
  let counts='';
  weekData.forEach(d=>{
    counts+=`<div style="flex:1;text-align:center;font-size:var(--fs-xs);font-weight:700;color:${d.count?stepColor(d.count,d.type,d.date):'var(--border)'};margin-top:4px">${d.count?Math.round(d.count/100)/10+'k':'·'}</div>`;
  });

  let histHtml='';
  if(log.length){
    const rows=[...log].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,21).map(e=>{
      const type=dayTypes[e.date]??null;
      const d=new Date(e.date);
      const lbl=d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'});
      // LE MEME OBJECTIF QUE LA COULEUR. Sans lui, un jour sans type déclaré
      // se colorait contre un objectif déduit que cette ligne n’affichait pas.
      // `||null` : la fonction rend 0 quand rien n’est déductible, et c’est ce
      // 0 qui doit se lire « — », pas « 0 pas ».
      const goal=_stepsObjectifJour(goals,type,e.date)||null;
      const col=stepColor(e.count,type,e.date);
      const pctBar=goal?Math.min(100,Math.round(e.count/goal*100)):null;
      const typeBadge=type?`<span style="font-size:var(--fs-xs);font-weight:900;padding:2px 6px;border-radius:var(--r-1);background:${type==='on'?'#2a0000':'#001a2a'};color:${type==='on'?'var(--red)':'var(--sub)'};letter-spacing:.5px">${type==='on'?'Entraînement':'Repos'}</span>`:'';
      const goalLine=goal?`<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px">${e.count.toLocaleString('fr-FR')} / ${goal.toLocaleString('fr-FR')} pas${e.count>=goal?' <span style="color:var(--green)">'+icon('coche',14)+'</span>':''}</div><div style="height:3px;background:var(--surface-2);border-radius:var(--r-1);margin-top:6px;overflow:hidden"><div style="height:100%;width:${pctBar}%;background:${col};border-radius:var(--r-1)"></div></div>`:'';
      return `<div style="padding:10px 0;border-bottom:1px solid #111">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">${typeBadge}<div style="font-size:var(--fs-sm);font-weight:600;color:var(--text-mid);text-transform:capitalize">${lbl}</div></div>
          <div style="font-size:var(--fs-md);font-weight:800;color:${col}">${fmt(e.count)}</div>
        </div>
        ${goalLine}
      </div>`;
    }).join('');
    histHtml=`<div style="background:linear-gradient(180deg,var(--surface-1),var(--dark));border:1px solid var(--surface-2);border-radius:var(--r-4);padding:16px;position:relative;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 22px rgba(0,0,0,.4)">
      
      <!-- R34, l'historique n'est plus replie : ses jours se lisent d'emblee. -->
      <div class="hist-bloc" style="position:relative"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--sub);text-transform:uppercase">Historique</div><span style="font-size:var(--fs-xs);color:var(--text-faint);font-weight:700">${Math.min(log.length,21)} jour${Math.min(log.length,21)>1?'s':''}</span></div>
      ${rows}</div>
    </div>`;
  }

  // Même déduction que la couleur, sur le jour RÉELLEMENT choisi — `selStr`,
  // qui peut être hors de la semaine affichée.
  const todayGoal=_stepsObjectifJour(goals,todayType,selStr)||null;
  const todayCount=todayEntry?.count??0;
  const todayPct=todayGoal&&todayCount?Math.min(100,Math.round(todayCount/todayGoal*100)):0;
  const todayProgressHtml=todayGoal&&todayCount?`<div style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;font-size:var(--fs-xs);margin-bottom:4px">
      <span style="color:var(--sub)">${todayCount.toLocaleString('fr-FR')} / ${todayGoal.toLocaleString('fr-FR')} pas</span>
      <span id="steps-pct-jour" style="color:${stepColor(todayCount,todayType,selStr)};font-weight:800;font-variant-numeric:tabular-nums">${todayPct}%</span>
    </div>
    <div style="height:6px;background:var(--surface-2);border-radius:var(--r-1);overflow:hidden">
      <div class="rc-barre" data-bar-w="${todayPct}" style="height:100%;width:0;background:${stepColor(todayCount,todayType,selStr)};border-radius:var(--r-1);transition:width 520ms var(--c-out)"></div>
    </div>
  </div>`:'';
  // AFFICHÉ DÈS QU’UN OBJECTIF EXISTE, déclaré ou déduit — et non plus
  // seulement quand le type a été posé à la main. La teinte rouge reste
  // réservée au jour ON DÉCLARÉ : un jour déduit n’a pas la même certitude, et
  // le dire en rouge lui donnerait un poids qu’il n’a pas.
  const todayGoalHintHtml=todayGoal?`<div style="text-align:center;font-size:var(--fs-xs);color:var(--sub)">Objectif : <strong style="color:${todayType==='on'?'var(--red)':'var(--sub)'}">${todayGoal.toLocaleString('fr-FR')} pas</strong></div>`:'';

  document.getElementById(containerId).innerHTML=`
    <!-- R28, L ORDRE DE L USAGE : la saisie du jour, ce qu elle change,
         la semaine, l historique, puis les reglages. -->
    <div class="card-nut" style="margin-bottom:14px;${_animEntree('steps-saisie')}">
      
      <div style="position:absolute;left:50%;top:-30px;transform:translateX(-50%);width:130px;height:90px;border-radius:var(--r-full);background:radial-gradient(circle,${todayType==='off'?'transparent':'rgba(224,32,32,.14)'},transparent 68%);pointer-events:none"></div>
      <div style="position:relative">
        ${_bandeauJour('steps-date-input',selStr,'changeStepsDate',{avecFleches:true,
          prev:_jourVoisin(selStr,-1,STEPS_RETENTION_JOURS),
          next:_jourVoisin(selStr,1,STEPS_RETENTION_JOURS),
          retention:STEPS_RETENTION_JOURS})}
        <!-- R12 : ICI ON MARQUE LE TYPE DU JOUR, on ne regle rien. « Aujourd'hui »
             seulement si le jour choisi EST aujourd'hui : le bandeau au-dessus
             permet de revenir sur un autre jour, et le libelle mentirait. -->
        <div style="font-size:var(--fs-xs);font-weight:800;color:var(--sub);letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">${selStr===todayStr?'Aujourd\'hui':'Ce jour-là'} :</div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button onclick="stepsToggleType('on')" style="flex:1;padding:10px 4px;border-radius:var(--r-2);border:2px solid ${todayType==='on'?'var(--red)':'#1f1f1f'};background:${todayType==='on'?'linear-gradient(160deg,#c10000,#6d0000)':'linear-gradient(180deg,#131313,#0c0c0c)'};color:${todayType==='on'?'var(--text)':'#4a4a4a'};font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2px;cursor:pointer;box-shadow:${todayType==='on'?'0 0 18px rgba(224,32,32,.5),inset 0 1px 0 rgba(255,255,255,.2)':'inset 0 1px 0 rgba(255,255,255,.03)'};text-shadow:${todayType==='on'?'0 0 10px rgba(255,255,255,.6)':'none'};transition:background var(--t-2),border-color var(--t-2),color var(--t-2),box-shadow var(--t-2),text-shadow var(--t-2)">Entraînement</button>
          <button onclick="stepsToggleType('off')" style="flex:1;padding:10px 4px;border-radius:var(--r-2);border:2px solid ${todayType==='off'?'#60a5fa':'#1f1f1f'};background:${todayType==='off'?'linear-gradient(160deg,#1d4f80,#0b2740)':'linear-gradient(180deg,#131313,#0c0c0c)'};color:${todayType==='off'?'var(--text)':'#4a4a4a'};font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2px;cursor:pointer;box-shadow:${todayType==='off'?'0 0 18px rgba(96,165,250,.45),inset 0 1px 0 rgba(255,255,255,.2)':'inset 0 1px 0 rgba(255,255,255,.03)'};text-shadow:${todayType==='off'?'0 0 10px rgba(255,255,255,.6)':'none'};transition:background var(--t-2),border-color var(--t-2),color var(--t-2),box-shadow var(--t-2),text-shadow var(--t-2)">Repos</button>
        </div>
        <input type="number" id="steps-today-input" placeholder="0" min="0" max="99999"
          value="${todayEntry&&todayEntry.count!=null?todayEntry.count:''}"
          style="width:100%;box-sizing:border-box;font-size:var(--fs-3xl);text-align:center;padding:14px 10px;background:linear-gradient(180deg,var(--bg),var(--surface-0));border:1px solid var(--border);border-radius:var(--r-3);color:var(--text);font-family:var(--pile-titre);letter-spacing:2px;margin-bottom:12px;box-shadow:var(--e-inset);text-shadow:var(--halo-2)">
        <!-- R28, « Enregistrer », comme partout ailleurs dans l app. -->
        <button class="btn btn-red" onclick="saveSteps()">Enregistrer</button>
        <!-- LA CAPTURE SE PLACE SOUS LA SAISIE, PAS EN BAS DE PAGE : l athlete
             qui n a pas note ses journees est precisement celui qui ne fait
             pas defiler. R28, dans la carte, sous le bouton, en alternative
             (« ou importe une capture… ») : meme forme que sur Lifestyle. -->
        ${_avecImport?_htmlCadreImportCapture('pas',{alternative:true}):''}
      </div>
    </div>

    <!-- R28, L OBJECTIF DU JOUR ET SON AVANCEMENT, juste sous la saisie :
         c est ce que le chiffre qu on vient d ecrire change. -->
    ${todayGoalHintHtml||todayProgressHtml?`<div class="card-nut" style="margin-bottom:14px;${_animEntree('steps-jour')}"><div style="position:relative">${todayGoalHintHtml}${todayProgressHtml}</div></div>`:''}

    <div class="card-nut" style="margin-bottom:14px;${_animEntree('steps-sem')}">
      
      <div style="position:relative">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <span style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--sub);text-transform:uppercase">Cette semaine</span>
          <span style="font-size:var(--fs-xs);font-weight:800;letter-spacing:1px;color:var(--text-dim)"><span style="display:inline-block;width:6px;height:6px;border-radius:var(--r-full);background:var(--red);vertical-align:middle;box-shadow:0 0 6px color-mix(in srgb,var(--red) 90%,transparent)"></span> Entraînement &nbsp;<span style="display:inline-block;width:6px;height:6px;border-radius:var(--r-full);background:#60a5fa;vertical-align:middle;box-shadow:0 0 6px rgba(96,165,250,.8)"></span> Repos</span>
        </div>
        <div style="display:flex;align-items:flex-end;gap:4px;height:80px;margin-bottom:8px;border-bottom:1px solid color-mix(in srgb,var(--text) 5%,transparent)">${bars}</div>
        <div style="display:flex;gap:4px">${labels}</div>
        <div style="display:flex;gap:4px">${counts}</div>
      </div>
    </div>

    <div style="background:linear-gradient(145deg,#c10000 0%,#7d0000 55%,#4a0000 100%);border-radius:var(--r-4);padding:20px;margin-bottom:14px;text-align:center;position:relative;overflow:hidden;box-shadow:var(--e3);${_animEntree('steps-moy')}">
      
      <div style="position:absolute;right:-22px;top:-22px;width:100px;height:100px;border-radius:var(--r-full);background:color-mix(in srgb,var(--text) 5.5%,transparent);pointer-events:none"></div>
      <div style="position:relative">
        <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.55);text-transform:uppercase;letter-spacing:3px;font-weight:800;margin-bottom:8px">Moyenne hebdomadaire</div>
        <div style="font-family:var(--pile-titre);font-size:var(--fs-3xl);line-height:.95;color:var(--text);letter-spacing:1px;text-shadow:var(--halo-3),0 0 34px rgba(255,255,255,.4)">${fmt(weekAvg)}</div>
        <div style="font-size:var(--fs-xs);color:rgba(255,255,255,.62);margin-top:6px">pas / jour &nbsp;·&nbsp; ${withData.length} / 7 jours renseignés</div>
        <div style="margin-top:14px;display:flex;justify-content:center;gap:14px">
          <div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:rgba(255,255,255,.5);letter-spacing:1.5px;font-weight:800">OBJECTIF ENTRAÎNEMENT</div><div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:var(--text);margin-top:2px">${goals.on.toLocaleString('fr-FR')}</div></div>
          <div style="width:1px;background:color-mix(in srgb,var(--text) 18%,transparent)"></div>
          <div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:rgba(255,255,255,.5);letter-spacing:1.5px;font-weight:800">OBJECTIF REPOS</div><div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:rgba(255,255,255,.8);margin-top:2px">${goals.off.toLocaleString('fr-FR')}</div></div>
          <div style="width:1px;background:color-mix(in srgb,var(--text) 18%,transparent)"></div>
          <div style="text-align:center;flex:1"><div style="font-size:var(--fs-xs);color:rgba(255,255,255,.5);letter-spacing:1.5px;font-weight:800">TOTAL SEMAINE</div><div style="font-family:var(--pile-titre);font-size:var(--fs-xl);color:var(--text);margin-top:2px">${fmt(withData.reduce((s,d)=>s+d.count,0))}</div></div>
        </div>
      </div>
    </div>

    ${histHtml}
    <!-- R28, LES REGLAGES EN DERNIER. On regle ses objectifs une fois ; on
         saisit ses pas tous les jours. R34, plus replies : la carte est
         affichee en entier. -->
    <div class="card-nut" style="margin:14px 0">
      
      <div class="steps-reglages" style="position:relative">
        <div style="font-family:var(--pile-titre);font-size:var(--fs-lg);letter-spacing:2.5px;color:var(--sub);text-transform:uppercase">Régler mes objectifs</div>
        <!-- ALIGNES PAR LE BAS. « JOUR ON ENTRAÎNEMENT » se replie sur deux
             lignes la ou « JOUR OFF REPOS » tient sur une : les deux champs
             se retrouvaient decales. Les colonnes s etirent a la meme hauteur
             et poussent leur champ en bas, ce qui tient quel que soit le
             libelle, figer une hauteur casserait a la premiere retouche de
             texte, ou sur un telephone plus etroit. -->
        <div style="display:flex;gap:10px;margin:14px 0 12px;align-items:stretch">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end">
            <!-- R12, PLUS DE « JOUR ON ». Ici on REGLE UN OBJECTIF : le
                 libelle le dit, et il ne se confond plus avec le marquage du
                 jour, plus haut, qui employait les memes mots. -->
            <div style="font-size:var(--fs-xs);font-weight:800;color:var(--red-text);letter-spacing:1.2px;margin-bottom:6px;text-transform:uppercase">Objectif les jours d'entraînement</div>
            <input type="number" id="steps-goal-on" value="${goals.on}" min="500" max="50000" style="width:100%;box-sizing:border-box;font-size:var(--fs-xl);text-align:center;padding:12px 6px;background:linear-gradient(180deg,var(--red-bg),var(--red-bg));border:1px solid #3a0d0d;border-radius:var(--r-2);color:var(--red-text);font-family:var(--pile-titre);letter-spacing:1px;box-shadow:var(--e-inset),var(--glow-red);--halo-c:color-mix(in srgb,var(--red) 60%,transparent);text-shadow:var(--halo-1)">
          </div>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:flex-end">
            <div style="font-size:var(--fs-xs);font-weight:800;color:#7aa7d9;letter-spacing:1.2px;margin-bottom:6px;text-transform:uppercase">Objectif les jours de repos</div>
            <input type="number" id="steps-goal-off" value="${goals.off}" min="500" max="50000" style="width:100%;box-sizing:border-box;font-size:var(--fs-xl);text-align:center;padding:12px 6px;background:linear-gradient(180deg,var(--bg),var(--bg));border:1px solid #12304d;border-radius:var(--r-2);color:#7aa7d9;font-family:var(--pile-titre);letter-spacing:1px;box-shadow:var(--e-inset),0 0 12px rgba(96,165,250,.1);--halo-c:rgba(96,165,250,.5);text-shadow:var(--halo-1)">
          </div>
        </div>
        <button onclick="saveStepsGoals()" style="width:100%;padding:12px;background:linear-gradient(160deg,#e21414,var(--red-deep));border:1px solid rgba(255,90,90,.4);color:var(--text);border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;cursor:pointer;box-shadow:0 0 18px color-mix(in srgb,var(--red) 40%,transparent),inset 0 1px 0 rgba(255,255,255,.18);text-shadow:var(--halo-1)">Enregistrer les objectifs</button>
      </div>
    </div>
  `;
  // Les barres et le pourcentage du jour ne bougent que si quelqu'un leur donne
  // leur cible AU TOUR SUIVANT : c'est tout l'objet de _animerJauges.
  try{
    const _z=document.getElementById(containerId);
    if(_z){
      _animerJauges(_z);
      if(todayGoal&&todayCount)
        arcChiffre('steps-pct-jour',0,todayPct,{duree:520,format:v=>Math.round(v)+'%'});
    }
  }catch(e){}
}
// ── Journal de pas : point d'écriture unique ────────────────────────────────
// Deux écrans y déposent la même donnée — la saisie Lifestyle et le champ de
// fin de séance. Dupliquer la logique, c'était garantir qu'elles finiraient par
// diverger sur la clé de date, la purge ou l'écrasement, et produire soit des
// doublons soit des jours fantômes. Un seul chemin, donc.
// N'ÉCRIT PAS : la persistance reste à l'appelant, qui sait s'il a d'autres
// modifications à grouper dans le même saveUser().
const STEPS_RETENTION_JOURS=180;

// ══════════════ SUIVI DU POIDS : PESÉE QUOTIDIENNE ET TENDANCE ══════════════
// Le poids n'était saisi que dans un bilan, toutes les une ou deux semaines, et
// tracé BRUT : à cette fréquence, une variation d'eau de 1 kg ressemble à une
// progression. On ajoute la pesée quotidienne et une moyenne mobile, sans rien
// migrer : les poids déjà présents dans les bilans sont LUS, jamais recopiés.
// ══════════════ CONSTANTES ET ANALYSES ══════════════
// Ce module CONSIGNE. Il n'interprète rien, et c'est le point entier :
// risquesMicro posait déjà des questions sur les bilans sanguins sans pouvoir
// en enregistrer les réponses. On ferme ce trou sans ouvrir celui d'à côté —
// aucune borne de référence, aucune couleur, aucun score. Une valeur de
// laboratoire dépend du labo, du sexe, de l'âge et du contexte : l'app qui
// oserait la qualifier dirait une bêtise à quelqu'un qui la croirait.
const CONSTANTES_RETENTION_JOURS=730;      // aligné sur PESEE_RETENTION_JOURS
// Bornes de SAISIE, pas de normalité : elles écartent une faute de frappe,
// elles ne disent rien de ce qui est sain. Hors bornes, on REFUSE — jamais de
// correction silencieuse, comme _recordWeight.
const TENSION_BORNES={sys:[70,250],dia:[40,150],pouls:[30,220]};
const TENSION_SEUIL_SYS=140, TENSION_SEUIL_DIA=90;
const TENSION_MESURES_ALERTE=3;
const TENSION_ESPACEMENT_H=24;
function _bornesOk(v,b){
  const n=Number(v);
  return isFinite(n)&&n>=b[0]&&n<=b[1];
}
// Rend {ok:true,entree} ou {ok:false,raison}. PURE : n'écrit pas.
function validerTension(sys,dia,pouls,dateISO){
  if(!_bornesOk(sys,TENSION_BORNES.sys))
    return {ok:false,raison:'Systolique attendue entre '+TENSION_BORNES.sys[0]+' et '+TENSION_BORNES.sys[1]+'.'};
  if(!_bornesOk(dia,TENSION_BORNES.dia))
    return {ok:false,raison:'Diastolique attendue entre '+TENSION_BORNES.dia[0]+' et '+TENSION_BORNES.dia[1]+'.'};
  if(pouls!==''&&pouls!=null&&!_bornesOk(pouls,TENSION_BORNES.pouls))
    return {ok:false,raison:'Pouls attendu entre '+TENSION_BORNES.pouls[0]+' et '+TENSION_BORNES.pouls[1]+'.'};
  const d=dateISO||new Date().toISOString();
  if(isNaN(new Date(d).getTime())) return {ok:false,raison:'Date illisible.'};
  const e={date:new Date(d).toISOString(),type:'tension',
    sys:Number(sys),dia:Number(dia)};
  if(pouls!==''&&pouls!=null) e.pouls=Number(pouls);
  return {ok:true,entree:e};
}
function enregistrerConstante(user,sys,dia,pouls,dateISO){
  if(!user) return {ok:false,raison:'Aucun dossier.'};
  const v=validerTension(sys,dia,pouls,dateISO);
  if(!v.ok) return v;
  if(!Array.isArray(user.constantes)) user.constantes=[];
  user.constantes.push(v.entree);
  const min=Date.now()-CONSTANTES_RETENTION_JOURS*24*3600*1000;
  user.constantes=user.constantes
    .filter(e=>e&&e.date&&new Date(e.date).getTime()>=min)
    .sort((a,b)=>a.date<b.date?-1:1);
  return {ok:true,entree:v.entree};
}
// RETRAIT D'UN RELEVÉ. Ni DOM ni réseau : elles décident, l'écran applique.
//
// La date ISO porte les millisecondes : elle identifie donc un relevé à elle
// seule. C'est aussi la clef qui dédoublonne dans _unionParDate — retirer par
// date, ici, retire bien la même chose que ce que la fusion reconnaît.
//
// AUCUN TABLEAU N'EST CRÉÉ : si le dossier n'en a pas, il n'y a rien à
// retirer, et poser un [] ferait écrire un champ vide vers sante_privee.
function supprimerConstante(user,dateISO){
  if(!user) return {ok:false,raison:'Aucun dossier.'};
  if(!Array.isArray(user.constantes)) return {ok:false,raison:'Aucune mesure.'};
  const avant=user.constantes.length;
  user.constantes=user.constantes.filter(e=>!(e&&e.date===dateISO));
  const n=avant-user.constantes.length;
  return n?{ok:true,retirees:n}:{ok:false,raison:'Mesure introuvable.'};
}
// Le marqueur EN PLUS de la date : deux analyses du même prélèvement portent
// le même horodatage, et retirer la ferritine ne doit pas emporter la TSH.
function supprimerAnalyse(user,dateISO,marqueur){
  if(!user) return {ok:false,raison:'Aucun dossier.'};
  if(!Array.isArray(user.analyses)) return {ok:false,raison:'Aucune analyse.'};
  const avant=user.analyses.length;
  user.analyses=user.analyses.filter(e=>!(e&&e.date===dateISO&&e.marqueur===marqueur));
  const n=avant-user.analyses.length;
  return n?{ok:true,retirees:n}:{ok:false,raison:'Analyse introuvable.'};
}
// PURE. Trois dernières mesures au-dessus du seuil ET espacées de plus de 24 h
// l'une de l'autre. L'espacement n'est pas un détail : trois relevés pris à
// cinq minutes d'intervalle un jour de stress ne sont qu'une seule mesure.
function alerteTension(user){
  const l=(((user&&user.constantes)||[]).filter(e=>e&&e.type==='tension'&&e.date))
    .slice().sort((a,b)=>a.date<b.date?-1:1);
  if(l.length<TENSION_MESURES_ALERTE) return {alerte:false};
  const trois=l.slice(-TENSION_MESURES_ALERTE);
  for(const m of trois){
    if(!(Number(m.sys)>=TENSION_SEUIL_SYS||Number(m.dia)>=TENSION_SEUIL_DIA))
      return {alerte:false};
  }
  for(let i=1;i<trois.length;i++){
    const dt=new Date(trois[i].date).getTime()-new Date(trois[i-1].date).getTime();
    if(!(dt>TENSION_ESPACEMENT_H*3600*1000)) return {alerte:false};
  }
  return {alerte:true,mesures:trois};
}
// Le message ne contient AUCUN chiffre interprété : il rappelle le seuil qui a
// déclenché l'affichage, et renvoie. Il ne dit pas « ta tension est élevée ».
const TENSION_MESSAGE='Trois mesures au-dessus de 140/90. RepCore ne peut pas '
  +'interpréter une tension : fais-la contrôler par un médecin ou en pharmacie.';

// ── Analyses : consignation seule ──────────────────────────────────────────
// Liste FERMÉE. Aucune entrée ne porte de borne, de min, de max, de référence
// ni de seuil — un test le vérifie, parce que c'est le genre de champ qu'on
// ajoute « juste pour aider » six mois plus tard.
const MARQUEURS=Object.freeze([
  {cle:'hematocrite',   lib:'Hématocrite',        unites:['%']},
  {cle:'hemoglobine',   lib:'Hémoglobine',        unites:['g/dL','g/L']},
  {cle:'ferritine',     lib:'Ferritine',          unites:['µg/L','ng/mL']},
  {cle:'ldl',           lib:'LDL',                unites:['g/L','mmol/L']},
  {cle:'hdl',           lib:'HDL',                unites:['g/L','mmol/L']},
  {cle:'triglycerides', lib:'Triglycérides',      unites:['g/L','mmol/L']},
  {cle:'asat',          lib:'ASAT',               unites:['UI/L']},
  {cle:'alat',          lib:'ALAT',               unites:['UI/L']},
  {cle:'ggt',           lib:'Gamma-GT',           unites:['UI/L']},
  {cle:'glycemie_jeun', lib:'Glycémie à jeun',    unites:['g/L','mmol/L']},
  {cle:'hba1c',         lib:'HbA1c',              unites:['%','mmol/mol']},
  {cle:'creatinine',    lib:'Créatinine',         unites:['mg/L','µmol/L']},
  {cle:'tsh',           lib:'TSH',                unites:['mUI/L']},
  {cle:'vitamine_d',    lib:'Vitamine D',         unites:['ng/mL','nmol/L']}
]);
function marqueurDe(cle){ return MARQUEURS.find(m=>m.cle===cle)||null; }
function validerAnalyse(cle,valeur,unite,dateISO){
  const m=marqueurDe(cle);
  if(!m) return {ok:false,raison:'Marqueur inconnu.'};
  const v=Number(valeur);
  // Pas de borne de normalité : on refuse ce qui n'est pas un nombre positif,
  // rien de plus. Le reste appartient au médecin.
  if(!isFinite(v)||v<0) return {ok:false,raison:'Valeur attendue : un nombre positif.'};
  const u=String(unite||'').trim();
  if(m.unites.indexOf(u)<0) return {ok:false,raison:'Unité attendue : '+m.unites.join(' ou ')+'.'};
  const d=dateISO||new Date().toISOString();
  if(isNaN(new Date(d).getTime())) return {ok:false,raison:'Date illisible.'};
  return {ok:true,entree:{date:new Date(d).toISOString(),marqueur:cle,valeur:v,unite:u}};
}
function enregistrerAnalyse(user,cle,valeur,unite,dateISO){
  if(!user) return {ok:false,raison:'Aucun dossier.'};
  const v=validerAnalyse(cle,valeur,unite,dateISO);
  if(!v.ok) return v;
  if(!Array.isArray(user.analyses)) user.analyses=[];
  user.analyses.push(v.entree);
  user.analyses.sort((a,b)=>a.date<b.date?-1:1);
  return {ok:true,entree:v.entree};
}
// Écart avec le relevé PRÉCÉDENT du même marqueur. Un écart n'est pas un
// jugement : on dit « +6 depuis le 12 mars », jamais « en hausse, à surveiller ».
function ecartAnalyse(user,entree){
  const l=((user&&user.analyses)||[])
    .filter(e=>e&&e.marqueur===entree.marqueur&&e.unite===entree.unite&&e.date<entree.date)
    .sort((a,b)=>a.date<b.date?-1:1);
  const p=l[l.length-1];
  if(!p) return null;
  const d=Math.round((entree.valeur-p.valeur)*100)/100;
  return {delta:d,depuis:p.date,precedente:p.valeur};
}
const ANALYSES_PHRASE='Les valeurs de référence dépendent du laboratoire, de ton '
  +'sexe, de ton âge et de ton contexte. Seul le médecin qui a prescrit l\'analyse '
  +'peut les interpréter. RepCore les conserve pour que tu les aies sous la main.';
const ANALYSES_VIDE='Aucune analyse consignée. Ajoute une valeur pour la garder '
  +'sous la main lors de ton prochain rendez-vous.';
// Relance : aucune notification, un encart et rien d'autre.
const ANALYSES_RELANCE_JOURS=90;
function relanceAnalyses(user,ref){
  // La condition était isolée en attendant ce lot. La brancher RESTREINT le
  // rappel : il sortait jusqu'ici pour tout le monde, faute d'aPES. C'est
  // voulu — rappeler un bilan sanguin à qui n'a aucune raison d'en faire un
  // n'est pas un service, c'est du bruit.
  if(!aPES(user)) return false;
  const l=((user&&user.analyses)||[]).filter(e=>e&&e.date);
  const t=(ref instanceof Date?ref:new Date()).getTime();
  if(!l.length) return true;
  const der=l.slice().sort((a,b)=>a.date<b.date?-1:1).pop();
  return (t-new Date(der.date).getTime())>ANALYSES_RELANCE_JOURS*24*3600*1000;
}

const PESEE_RETENTION_JOURS=730;
const PESEE_MIN=25, PESEE_MAX=300;
const PESEE_FENETRE_MM=7;          // largeur de la moyenne mobile
const PESEE_MM_MIN=4;       // en dessous, la moyenne ne veut rien dire
const PESEE_FENETRE_VIT=14;    // jours servant à la régression
const PESEE_VIT_MIN_PTS=10;    // valeurs de mm7 nécessaires sur ces 14 jours
const PESEE_COUPURE_JOURS=30;      // au-delà, la série repart de zéro
const PESEE_ECART_CONFIRM=3;  // kg d'écart avec la veille avant confirmation

function _jourISO(d){ return localISODate(d instanceof Date?d:new Date(d)); }
function _jourPlus(iso,n){
  const [a,m,j]=String(iso).split('-').map(Number);
  const d=new Date(a,m-1,j+n);
  return localISODate(d);
}
function _joursEntre(a,b){
  const [a1,m1,j1]=String(a).split('-').map(Number);
  const [a2,m2,j2]=String(b).split('-').map(Number);
  return Math.round((new Date(a2,m2-1,j2)-new Date(a1,m1-1,j1))/86400000);
}

// Même mécanique que _recordSteps : un jour n'a qu'une valeur, écrasement et
// non ajout, ce qui permet de corriger une pesée saisie trop vite.
// `marque` (facultatif) : {dataStatus:'sync'} pour une pesée synchronisée.
// Sans elle, c'est une pesée à la main : son dataStatus le dit, et la
// synchronisation ne l'écrasera jamais (sanFusionSync).
function _recordWeight(dateStr,kg,marque){
  const v=parseFloat(kg);
  if(!dateStr||isNaN(v)||v<PESEE_MIN||v>PESEE_MAX) return false;
  if(!currentUser.weightLog) currentUser.weightLog=[];
  const arrondi=Math.round(v*10)/10;
  const idx=currentUser.weightLog.findIndex(e=>e.date===dateStr);
  if(idx>=0) currentUser.weightLog[idx].kg=arrondi;
  else currentUser.weightLog.push({date:dateStr,kg:arrondi});
  const _e=currentUser.weightLog.find(e=>e.date===dateStr);
  _sanMarquer(_e,marque);
  // L'heure d'une pesée synchronisée ne vaut pas pour une saisie à la main.
  if(_e&&!(marque&&marque.dataStatus==='sync')) delete _e.heure;
  const min=localISODate(new Date(Date.now()-PESEE_RETENTION_JOURS*24*3600*1000));
  currentUser.weightLog=currentUser.weightLog.filter(e=>e&&e.date>=min);
  currentUser.weightLog.sort((a,b)=>a.date<b.date?-1:1);
  return true;
}

// Série d'affichage : les pesées quotidiennes ET les poids déjà saisis dans les
// bilans, à leur date. Un même jour ne compte qu'une fois, la pesée l'emporte
// sur le bilan — elle est plus délibérée. Les bilans ne sont JAMAIS recopiés
// dans weightLog : un athlète qui ne se pèse jamais voit exactement ce qu'il
// voyait avant.
function serieWeight(user){
  const parJour={};
  for(const b of ((user&&user.bilans)||[])){
    if(!b||!b.date) continue;
    const v=getBW(b);
    if(v==null||v<PESEE_MIN||v>PESEE_MAX) continue;
    parJour[_jourISO(b.date)]={date:_jourISO(b.date),kg:v,source:'bilan'};
  }
  for(const e of ((user&&user.weightLog)||[])){
    if(!e||!e.date) continue;
    const v=parseFloat(e.kg);
    if(isNaN(v)||v<PESEE_MIN||v>PESEE_MAX) continue;
    parJour[e.date]={date:e.date,kg:v,source:'pesee'};
    if(/^\d{2}:\d{2}$/.test(e.heure||'')) parJour[e.date].heure=e.heure;
  }
  return Object.values(parJour).sort((a,b)=>a.date<b.date?-1:1);
}

// Moyenne mobile sur [jour − 6, jour]. Les jours sans pesée ne sont JAMAIS
// interpolés : une absence de pesée est une absence d'information, pas une
// valeur à inventer.
//
// « pleine » exige en plus que la fenêtre commence APRÈS la première pesée.
// Sans ça, les trois premiers points sont des moyennes de fenêtres tronquées,
// donc centrées trop tôt, et la régression sous-estime la vitesse d'environ
// 10 % (mesuré : −0,449 kg/sem au lieu de −0,500). La courbe, elle, garde les
// fenêtres partielles : mieux vaut un début de tracé un peu mou qu'un tracé
// qui ne démarre qu'au septième jour.
function mm7(serie,jour,pleine){
  if(!serie||!serie.length||!jour) return null;
  const debut=_jourPlus(jour,-(PESEE_FENETRE_MM-1));
  if(pleine&&debut<serie[0].date) return null;
  const dans=serie.filter(e=>e.date>=debut&&e.date<=jour);
  if(dans.length<PESEE_MM_MIN) return null;
  return dans.reduce((a,b)=>a+b.kg,0)/dans.length;
}

// Une interruption longue coupe la série : comparer une pesée d'aujourd'hui à
// celle d'il y a deux mois ne dit rien d'une vitesse.
function segmentsWeight(serie){
  const segs=[]; let cur=[];
  for(const e of (serie||[])){
    if(cur.length&&_joursEntre(cur[cur.length-1].date,e.date)>PESEE_COUPURE_JOURS){
      segs.push(cur); cur=[];
    }
    cur.push(e);
  }
  if(cur.length) segs.push(cur);
  return segs;
}

// Vitesse hebdomadaire, par moindres carrés sur la MOYENNE MOBILE et non sur les
// points bruts : la pente est plus stable, et une pesée aberrante en fin de
// fenêtre ne fait pas basculer le verdict.
// jourISO (facultatif) : la vitesse AU jour donné, la série tronquée à ce jour
// avant d'être découpée — un rapport de mars ne lit pas les pesées de
// septembre. Sans lui, la vitesse à la dernière pesée, comme avant.
function vitesseHebdo(serie,jourISO){
  if(jourISO) serie=(serie||[]).filter(e=>e.date<=jourISO);
  const segs=segmentsWeight(serie);
  const seg=segs.length?segs[segs.length-1]:null;
  if(!seg||!seg.length) return null;
  const dernier=seg[seg.length-1].date;
  // Il faut au moins deux semaines de recul DEPUIS LA REPRISE.
  if(_joursEntre(seg[0].date,dernier)<PESEE_FENETRE_VIT) return null;
  const pts=[];
  for(let i=PESEE_FENETRE_VIT-1;i>=0;i--){
    const j=_jourPlus(dernier,-i);
    const v=mm7(seg,j,true);
    if(v!=null) pts.push({x:PESEE_FENETRE_VIT-1-i,y:v});
  }
  if(pts.length<PESEE_VIT_MIN_PTS) return null;
  const n=pts.length;
  const mx=pts.reduce((a,p)=>a+p.x,0)/n, my=pts.reduce((a,p)=>a+p.y,0)/n;
  let num=0,den=0;
  for(const p of pts){ num+=(p.x-mx)*(p.y-my); den+=(p.x-mx)*(p.x-mx); }
  if(!den) return null;
  const pente=num/den;                       // kg par jour
  const courant=pts[pts.length-1].y;
  return {kgSem:pente*7, pctSem:courant?(pente*7)/courant*100:null,
          points:n, mm7Courant:courant, regime:'precis'};
}

// ── Régime de mesure ÉTENDU ─────────────────────────────────────────────────
// Le régime PRÉCIS exige une pesée quasi quotidienne pendant un mois : mm7
// réclame quatre pesées par semaine glissante, et la régression dix valeurs de
// mm7 sur quatorze jours. Un athlète qui se pèse trois fois par semaine
// n'obtient donc JAMAIS de vitesse — pas « une vitesse imprécise », rien du
// tout, et aucune proposition d'ajustement de sa vie.
//
// Le régime étendu regarde plus loin et plus grossièrement : quatre semaines,
// huit pesées BRUTES, régression sur les dates réelles. Il est moins fiable, et
// c'est pourquoi il corrige par pas RÉDUIT et attend plus longtemps entre deux
// propositions. On ne compense pas une mesure faible par une correction franche.
const PESEE_FENETRE_VIT_ETENDUE=28;
const PESEE_VIT_MIN_PTS_ETENDU=8;        // pesées BRUTES, pas des mm7
const PESEE_VIT_MIN_SEMAINES_ETENDU=3;   // réparties sur >= 3 semaines
const AJUST_PAS_ETENDU=0.05;
const AJUST_VERROU_JOURS_ETENDU=21;
// Clé de semaine calendaire, via le lundi. Huit pesées faites en trois jours
// décrivent une humeur, pas une tendance : c'est la RÉPARTITION qui fait la
// différence entre une vitesse et un accident de mesure.
function _cleSemaineISO(iso){
  const [a,m,j]=String(iso).split('-').map(Number);
  const d=new Date(a,m-1,j);
  const jour=(d.getDay()+6)%7;            // lundi = 0
  d.setDate(d.getDate()-jour);
  return localISODate(d);
}
// PURE. Régression par moindres carrés sur les PESÉES BRUTES, pondérée par la
// DATE RÉELLE et non par l'index : les pesées d'un régime étendu ne sont pas
// équidistantes, et régresser sur l'index donnerait une pente qui ne
// correspond à aucune durée.
function vitesseHebdoEtendue(serie,jourISO){
  const segs=segmentsWeight(serie);
  const seg=segs.length?segs[segs.length-1]:null;
  if(!seg||!seg.length) return null;
  const fin=jourISO||seg[seg.length-1].date;
  const debut=_jourPlus(fin,-(PESEE_FENETRE_VIT_ETENDUE-1));
  const pts=seg.filter(e=>e.date>=debut&&e.date<=fin);
  if(pts.length<PESEE_VIT_MIN_PTS_ETENDU) return null;
  const semaines=new Set(pts.map(e=>_cleSemaineISO(e.date)));
  if(semaines.size<PESEE_VIT_MIN_SEMAINES_ETENDU) return null;
  // x en JOURS depuis la première pesée retenue.
  const base=pts[0].date;
  const xs=pts.map(e=>_joursEntre(base,e.date));
  const ys=pts.map(e=>e.kg);
  const n=pts.length;
  const mx=xs.reduce((a,b)=>a+b,0)/n, my=ys.reduce((a,b)=>a+b,0)/n;
  let num=0,den=0;
  for(let i=0;i<n;i++){ num+=(xs[i]-mx)*(ys[i]-my); den+=(xs[i]-mx)*(xs[i]-mx); }
  if(!den) return null;
  const pente=num/den;                    // kg par jour
  // Le poids de référence est la VALEUR AJUSTÉE en fin de fenêtre, pas la
  // dernière pesée : une pesée haute le dernier jour fausserait le pourcentage.
  const courant=my+pente*(xs[n-1]-mx);
  return {kgSem:pente*7, pctSem:courant?(pente*7)/courant*100:null,
    points:n, nPesees:n, nSemaines:semaines.size, mm7Courant:courant,
    regime:'etendu'};
}

// ══════════════════════ PHASE : MASSE / SÈCHE / RECOMP / MAINTIEN ══════════
// La phase ne CALCULE rien et ne prescrit rien. Elle dit seulement dans quel
// sens lire ce que les autres écrans mesurent déjà : sans elle, l'app tenait
// pour acquis que perdre du poids est un progrès, ce qui est faux pour la
// moitié des gens qui s'entraînent.
//
// « sens » est la seule chose qui pilote la couleur : +1 la hausse est le but,
// −1 la baisse est le but, 0 aucune direction n'est un progrès — donc aucune
// couleur. Absente vaut 0, et c'est un état parfaitement valide.
const PHASES=Object.freeze({
  masse:{lib:'Prise de masse', apres:'prise de masse', sens:1, min:0.25, max:0.5, alerte:0.75,
    texte:"Tu manges plus que ta dépense pour construire du muscle. Une part de gras vient avec, c'est normal. Rythme habituel : +0,25 à 0,5 % de ton poids par semaine."},
  seche:{lib:'Sèche', apres:'sèche', sens:-1, min:-1.0, max:-0.5, alerte:-1.2,
    texte:"Tu manges moins que ta dépense pour perdre du gras. L'objectif à l'entraînement devient de CONSERVER ta masse musculaire, pas d'en gagner. Rythme habituel : −0,5 à 1 % par semaine."},
  recomp:{lib:'Recomposition', apres:'recomposition', sens:0, min:-0.25, max:0.25, alerteAbs:0.5,
    texte:"Poids stable, composition qui change. C'est réaliste quand on débute, quand on reprend, ou avec du surpoids. Chez un pratiquant avancé et déjà sec, c'est très lent."},
  maintien:{lib:'Maintien', apres:'maintien', sens:0, min:-0.25, max:0.25, alerteAbs:0.5,
    texte:"Tu entretiens. Volume d'entraînement au minimum efficace, poids stable."},
  // ══ PEAK WEEK — AJOUTEE LE 08/09/2026, A LA DEMANDE DE KEVIN ═══════════
  //
  // ⚠ CE QUE CETTE PHASE EST, ET CE QU'ELLE N'EST PAS. Elle NOMME la semaine
  // qui precede un passage sur scene, et elle en tire UNE seule consequence
  // technique : la balance ne veut plus rien dire. Elle ne porte AUCUN
  // protocole — pas de charge en glucides chiffree, pas de manipulation de
  // l'eau, pas de manipulation du sodium, pas de dessiccation. RepCore
  // suspend, elargit et renvoie ; il ne prescrit pas, et une peak week est
  // exactement le moment ou une consigne chiffree sortie d'une application
  // ferait le plus de degats. Le protocole appartient au coach, qui est dans
  // la salle avec son athlete.
  //
  // ⚠ UNE ASSERTION INTERDISAIT CETTE ENTREE — « Aucune phase de competition
  // n'est proposee ». Elle a ete REECRITE, pas supprimee, et elle verrouille
  // desormais la vraie regle : la phase peut exister, son contenu ne peut pas
  // devenir un protocole. Voir la suite de tests.
  //
  // alerteAbs A 3 % ET NON 0,5 : trois kilos d'eau et de glycogene se prennent
  // et se perdent en quatre jours pendant une charge, et ce n'est ni une prise
  // de gras ni une fonte musculaire. Une alerte de poids pendant cette
  // semaine-la ne pourrait dire QUE des choses fausses. Le seuil n'est pas
  // « large par prudence » : il est mis hors d'atteinte parce que la mesure
  // elle-meme ne mesure plus ce qu'on croit.
  peak:{lib:'Peak week', apres:'peak week', sens:0, min:-0.5, max:0.5, alerteAbs:3,
    texte:"La semaine avant la scène. Le poids sur la balance ne dit plus rien "
      +"d'utile : il suit l'eau et le glycogène, pas le gras. RepCore ne calcule "
      +"aucun protocole de peak week : c'est ton coach qui le conduit."}
});
// Les phases qu'un athlete peut choisir SEUL. Peak week n'y est pas : voir
// _htmlChoixPhase. La liste est derivee de PHASES pour qu'une phase ajoutee
// demain soit un choix explicite et non un oubli.
const PHASES_ATHLETE=Object.freeze(Object.keys(PHASES).filter(t=>t!=='peak'));
const PESEE_ALERTE_SANS_PHASE=1.5;
const PHASE_HIST_MAX=12;
const PHASE_SEMAINES_RELANCE=20;
// Un type inconnu retombe sur neutre au lieu de faire planter l'écran : une
// version future du champ ne doit pas casser une version ancienne de l'app.
function phaseCourante(user){
  const p=user&&user.phase;
  if(!p||!p.type||!PHASES[p.type]||!p.debut) return null;
  return p;
}
function typePhase(user){ const p=phaseCourante(user); return p?p.type:null; }
function libPhase(user){ const p=phaseCourante(user); return p?PHASES[p.type].lib:null; }
function ordinalSemaine(n){ return n===1?'1re semaine':n+'e semaine'; }
function semainesPhase(user){
  const p=phaseCourante(user);
  if(!p) return null;
  return Math.max(1,Math.floor((Date.now()-p.debut)/(7*24*3600*1000))+1);
}
// Durée RÉVOLUE, et non le numéro de la semaine en cours : au 140e jour on
// est dans la semaine 21 mais on a bien vingt semaines derrière soi. Comparer
// un seuil au numéro affiché déclenchait la relance une semaine trop tôt.
function semainesEcoulees(user){
  const p=phaseCourante(user);
  if(!p) return null;
  return Math.floor((Date.now()-p.debut)/(7*24*3600*1000));
}
// Reconduire la MÊME phase ne remet pas le compteur à zéro : ça effacerait la
// semaine 12 d'une sèche et supprimerait la vitesse pendant trois semaines,
// pour un clic qui ne changeait rien.
function changerPhase(user,type,finPrevue,definiPar){
  if(!user||!PHASES[type]) return false;
  // La garde est DANS la fonction, pas dans l'écran : le coach passe par le
  // même chemin, et il ne voit pas forcément la déclaration.
  if(type==='seche'&&grossesseSuspend(user)) return false;
  // BILAN DE SECURITE. Meme mecanique, meme endroit, et le refus se DIT :
  // un blocage silencieux laisse croire a un bug. La grossesse passe avant
  // — un seul message, celui qui existe deja.
  if(type==='seche'&&aTCA(user)){
    try{ toast(TCA_REFUS_SECHE,'var(--orange)'); }catch(e){}
    return false;
  }
  // Vigilance energetique : meme garde, meme endroit, meme refus parle.
  if(type==='seche'){
    let _rv=false; try{ _rv=redsSuspend(user); }catch(e){}
    if(_rv){
      try{ toast(REDS_RENVOI,'var(--orange)'); }catch(e){}
      return false;
    }
  }
  // Post-partum : AUCUN blocage. Une question, et elle passe.
  if(type==='seche'&&etatGrossesse(user)==='post_partum'){
    try{ toast(GROSSESSE_Q_POSTNATALE,'var(--orange)'); }catch(e){}
  }
  const anc=phaseCourante(user);
  const hist=((user.phase&&user.phase.historique)||[]).slice();
  if(anc&&anc.type===type){
    user.phase=Object.assign({},anc,{finPrevue:finPrevue||null,
      definiPar:definiPar||anc.definiPar||'athlete',historique:hist.slice(-PHASE_HIST_MAX)});
    return true;
  }
  if(anc) hist.push({type:anc.type,debut:anc.debut,fin:Date.now()});
  // La pause appartenait a la phase qu'on quitte.
  if(anc&&user.phase&&user.phase.pause){
    try{ _pauseJournaliser(user,'pause_effacee_changement_phase',
      {de:anc.type,vers:type}); }catch(e){}
  }
  user.phase={type,debut:Date.now(),finPrevue:finPrevue||null,
    definiPar:definiPar||'athlete',historique:hist.slice(-PHASE_HIST_MAX)};
  return true;
}
// Suggestion depuis l'objectif déjà saisi. Les libellés EXACTS des cases à
// cocher du questionnaire sont dans les motifs : « Prise de muscle » ne
// contient pas « prendre » et « Perte de poids » ne contient pas « perdre »,
// donc sans eux la suggestion ne se serait jamais déclenchée sur le cas le
// plus fréquent. Les deux familles présentes → on ne suggère RIEN : deviner
// serait pire que se taire.
const _RX_PH_MASSE=/masse|volume|prise de muscle|\bprendre\b|\bgrossir\b|prise de poids/i;
const _RX_PH_SECHE=/s[eéè]ch|\bsec\b|perte de poids|\bperdre\b|maigrir|affut|affût|mincir/i;
function suggererPhaseDepuisTexte(txt){
  const t=_texteReponse(txt);
  if(!t) return null;
  const m=_RX_PH_MASSE.test(t), s=_RX_PH_SECHE.test(t);
  if(m===s) return null;
  return m?'masse':'seche';
}
// Couleur d'évolution du poids. Remplace le « perdre = vert » inconditionnel
// qui contredisait frontalement l'objectif d'un athlète en prise de masse.
function couleurEvolution(user,diff){
  const p=phaseCourante(user);
  const sens=p?PHASES[p.type].sens:0;
  if(!sens||diff==null||!diff) return 'var(--sub)';
  return (diff>0)===(sens>0)?'var(--green)':'var(--orange)';
}
// Relance : une phase qui dure trop, ou dont la fin annoncée est passée. On
// pose une QUESTION, on ne donne pas d'ordre — c'est à l'athlète et à son
// coach de décider si la phase continue.
function relancePhase(user){
  const p=phaseCourante(user);
  if(!p) return null;
  const sem=semainesEcoulees(user);
  if(sem>=PHASE_SEMAINES_RELANCE)
    return 'Tu es en '+PHASES[p.type].apres+' depuis '+sem+" semaines. C'est long. Où en es-tu ?";
  if(p.finPrevue&&Date.now()>p.finPrevue)
    return 'La fin que tu avais prévue pour ta '+PHASES[p.type].apres+' est passée. Où en es-tu ?';
  return null;
}
const PAUSE_TEXTE_VITESSE='pause diététique en cours : une reprise de poids sur '
  +'quelques jours est attendue';
function cibleVitesse(user){
  const p=phaseCourante(user);
  // Pendant une pause, la fourchette est celle du MAINTIEN et aucune alerte ne
  // se declenche : reprendre un peu de poids en remontant les calories est le
  // comportement ATTENDU, pas un derapage. alerteAbs et alerte sont mis a null
  // explicitement, sinon vitesseAlerte retomberait sur ceux du maintien.
  // Même mécanique que la pause, et pour la même raison : alerte et alerteAbs
  // à null EXPLICITEMENT, sinon vitesseAlerte retomberait sur ceux de la
  // phase. La prise de poids attendue cesse ainsi d'être signalée comme une
  // dérive, sans qu'une ligne de vitesseAlerte ne bouge.
  if(p&&grossesseSuspend(user))
    return Object.assign({},PHASES[p.type],{phase:p.type,grossesse:true,
      alerte:null,alerteAbs:null});
  if(p&&pauseActive(user))
    return Object.assign({},PHASES.maintien,{phase:p.type,pause:true,
      alerte:null,alerteAbs:null,note:PAUSE_TEXTE_VITESSE});
  // Traitement déclaré : la vitesse cesse d'être signalée comme une dérive,
  // et la phrase dit POURQUOI plutôt que de se taire. Même mécanique que la
  // pause et la grossesse — alerte et alerteAbs à null EXPLICITEMENT — et
  // pas une ligne de vitesseAlerte ne bouge : elle est PURE et ne reçoit pas
  // le dossier, la garder de l'intérieur exigerait de changer sa signature.
  //
  // Placé APRÈS la grossesse et la pause, qui portent leurs propres messages,
  // et AVANT le SOPK : sous traitement, élargir une fourchette n'aurait pas de
  // sens puisqu'on cesse d'alerter tout court. La fourchette AFFICHÉE reste
  // celle de la phase — on ne prétend pas savoir laquelle viser sous
  // traitement, on cesse seulement de crier.
  if(p&&traitementDeclare(user))
    return Object.assign({},PHASES[p.type],{phase:p.type,traitement:true,
      alerte:null,alerteAbs:null,note:TRAITEMENT_VITESSE});
  // SOPK déclaré et sèche en cours : la fourchette s'élargit vers le bas et
  // le seuil d'alerte suit. Une perte plus lente n'est pas un déficit
  // insuffisant — c'est ce que la spécification appelle le vrai défaut.
  // SOPK et ménopause peuvent se cumuler : on retient la fourchette la plus
  // large des deux, jamais leur intersection. Deux raisons de perdre plus
  // lentement ne font pas une raison de perdre plus vite.
  if(p&&p.type==='seche'&&(sopkApplicable(user)||menopauseDeclaree(user))){
    const _sk=sopkApplicable(user), _mn=menopauseDeclaree(user);
    const _f=_fourchetteLaPlusLarge([_sk?SOPK_CIBLE_SECHE:null,_mn?MENO_CIBLE_SECHE:null]);
    return Object.assign({phase:p.type},PHASES.seche,_f,{sopk:_sk,menopause:_mn});
  }
  if(p) return Object.assign({phase:p.type},PHASES[p.type]);
  return {phase:null,min:null,max:null,alerteAbs:PESEE_ALERTE_SANS_PHASE,lib:null};
}
// Série servant à la VITESSE, bornée au début de la phase en cours : une
// régression à cheval sur une prise de masse et la sèche qui la suit ne décrit
// aucune des deux. Conséquence assumée : après un changement de phase, la
// vitesse disparaît le temps de reconstituer trois semaines de pesées.
function serieVitesse(user){
  const s=serieWeight(user);
  const p=phaseCourante(user);
  if(!p) return s;
  const d=localISODate(new Date(p.debut));
  return s.filter(e=>e.date>=d);
}
// Vrai si la vitesse dépasse le seuil d'alerte de la phase.
function vitesseAlerte(pct,cible){
  if(pct==null||!cible) return false;
  if(cible.alerteAbs!=null) return Math.abs(pct)>cible.alerteAbs;
  if(cible.alerte==null) return false;
  return cible.alerte<0?pct<cible.alerte:pct>cible.alerte;
}

// ── GARDE-FOU TCA ───────────────────────────────────────────────────────────
// Mesure de prudence produit, pas dispositif clinique. Elle ne détecte rien :
// elle se contente de ne pas aggraver.
//
// Pilotée par la donnée EXISTANTE du questionnaire de départ, sans nouvelle
// question. Le filtre est le MÊME que celui de contreIndications, à dessein :
// ce que le coach voit comme alerte est exactement ce qui déclenche le mode
// neutre. Conséquence assumée : une réponse comme « non, jamais » n'est pas
// filtrée et bascule en mode neutre. Pour un garde-fou, c'est le bon sens
// d'erreur.
// _RIEN_DECLARE A ETE SUPPRIMEE. Elle decidait du statut TCA depuis un champ
// de TEXTE LIBRE, en exigeant que la reponse soit EXACTEMENT l un de six
// mots. Mesure faite : « Jamais », « Aucune, jamais », « non, jamais eu » et
// « aucun trouble alimentaire » declenchaient TOUS le risque. Le dépistage
// passe desormais par le questionnaire structure, et le champ libre n est
// plus analyse par rien.

