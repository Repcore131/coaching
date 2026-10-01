// ══ LES TEXTES LIBRES, BORNES COMME LA REGLE LES BORNE (01/10/2026) ══════
// database.rules.json refuse, dans users/<cle>, tout texte libre de plus de
// TEXTE_LIBRE_MAX caracteres (bio, vision, consignes de seance, reponses de
// bilan, retour sur une video, modeles de message) et tout champ inconnu dans
// msgTemplates[] et quickComments[]. Un seul depassement, et c'est le PUT
// ENTIER qui serait rejete. Avant chaque envoi, ces textes sont donc rognes
// et ces deux listes ramenees a leur schema. PURE sur ses arguments :
// modifie `doc` en place et le rend.
const TEXTE_LIBRE_MAX=4000;
const TEXTES_LIBRES_RACINE=Object.freeze(['bio','catchphrase','vision','traitementDetail']);
const SCHEMA_MODELE=Object.freeze({id:60,cat:40,titre:120,corps:TEXTE_LIBRE_MAX,createdAt:0});
const SCHEMA_COMMENTAIRE=Object.freeze({id:60,label:120,text:TEXTE_LIBRE_MAX,pos:0});
function _textesBornes(doc){
  if(!doc||typeof doc!=='object') return doc;
  const rogner=(v,max)=>{ const x=String(v); return x.length>max?x.slice(0,max):x; };
  const liste=o=>(!o||typeof o!=='object')?[]:(Array.isArray(o)?o:Object.values(o));
  for(const k of TEXTES_LIBRES_RACINE) if(doc[k]!=null) doc[k]=rogner(doc[k],TEXTE_LIBRE_MAX);
  for(const s of liste(doc.sessions)) if(s&&typeof s==='object'&&s.notes!=null) s.notes=rogner(s.notes,TEXTE_LIBRE_MAX);
  for(const v of liste(doc.videos)) if(v&&typeof v==='object'&&v.feedback!=null) v.feedback=rogner(v.feedback,TEXTE_LIBRE_MAX);
  for(const b of liste(doc.bilans)){
    if(!b||typeof b!=='object') continue;
    for(const c of Object.keys(b))
      if(typeof b[c]==='string'&&!/-photo-/.test(c)&&b[c].length>TEXTE_LIBRE_MAX) b[c]=b[c].slice(0,TEXTE_LIBRE_MAX);
  }
  const fermer=(o,schema)=>{
    if(!o||typeof o!=='object') return;
    for(const c of Object.keys(o)){
      if(!(c in schema)){ delete o[c]; continue; }
      if(o[c]==null) continue;
      if(schema[c]===0){ const n=Number(o[c]); if(isFinite(n)) o[c]=n; else delete o[c]; }
      else o[c]=rogner(o[c],schema[c]);
    }
  };
  for(const t of liste(doc.msgTemplates)) fermer(t,SCHEMA_MODELE);
  for(const c of liste(doc.quickComments)) fermer(c,SCHEMA_COMMENTAIRE);
  return doc;
}
const CLOUD={
  _fbUrl:'https://repcore-sync-default-rtdb.firebaseio.com/users.json',
  _fbKey:'AIzaSyDQ_9jqpYMD6_32LRz1s7xyJOvEUPyr9K0',
  _idToken:null,_refreshToken:null,_tokenExpiry:0,
  _pushTimer:null,

  // ── Firebase Auth ──────────────────────────────────────────────
  _loadAuth(){
    try{const t=JSON.parse(localStorage.getItem('rc_fb_auth')||'null');if(t){this._idToken=t.i;this._refreshToken=t.r;this._tokenExpiry=t.e||0;}}catch{}
  },
  _saveAuth(){
    try{localStorage.setItem('rc_fb_auth',JSON.stringify({i:this._idToken,r:this._refreshToken,e:this._tokenExpiry}));}catch{}
  },

  // ── La base de la fusion a trois voies ──────────────────────────────────
  // UNE CLEF PAR DOSSIER, ET NON UNE CARTE GLOBALE. Un coach synchronise tous
  // ses athletes a chaque cycle : une carte unique aurait ete relue et
  // reecrite en entier trente fois de suite. Chaque base ne pese que ses
  // empreintes — quelques kilo-octets — et non le dossier.
  //
  // ⚠ UNE BASE QUI NE PEUT PAS S'ECRIRE EST RETIREE, PAS GARDEE. Si le quota
  //   est plein, on efface l'ancienne plutot que de laisser une base perimee
  //   qui ferait passer une modification de l'autre pour la mienne. Sans base,
  //   la fusion retombe sur le comportement d'avant : la version locale gagne.
  _cleBase(email){ return 'rc_sync_base:'+email; },
  _lireBase(email){
    try{
      const b=JSON.parse(localStorage.getItem(this._cleBase(email))||'null');
      return (b&&b.h&&typeof b.h==='object')?b:null;
    }catch(e){ return null; }
  },
  _poserBase(email,doc){
    if(!email||!doc||typeof doc!=='object') return;
    // L'ANCIENNE BASE PASSE EN MEMOIRE, pour les dossiers qui en derivent
    // encore — voir _baseDe.
    try{
      const avant=this._lireBase(email);
      if(avant&&avant.maj!==(Number(doc.updatedAt)||0)){
        const hist=this._histBases[email]||(this._histBases[email]=[]);
        hist.push(avant);
        while(hist.length>this._HIST_BASES) hist.shift();
      }
    }catch(e){}
    // `lu` : la date a laquelle cette base a servi. C'est ce qui permet, stockage
    // plein, de liberer d'abord les bases des dossiers qu'on n'ouvre plus.
    const val=JSON.stringify({h:syncEmpreintes(doc),maj:Number(doc.updatedAt)||0,lu:Date.now()});
    try{
      localStorage.setItem(this._cleBase(email),val);
    }catch(e){
      // QUOTA : ON LIBERE D'ABORD, ON RENONCE ENSUITE (30/09/2026). Sans base,
      // le prochain envoi de ce dossier ne pourrait plus fusionner a trois voies.
      let ok=false;
      try{ purgerPhotosAnciennes(); }catch(e2){}
      try{ this._purgerBasesAnciennes(email); }catch(e2){}
      try{ localStorage.setItem(this._cleBase(email),val); ok=true; }catch(e2){}
      if(!ok) try{ localStorage.removeItem(this._cleBase(email)); }catch(e2){}
    }
  },
  // Les bases des AUTRES dossiers qui n'ont pas servi depuis BASE_INUTILE_MS :
  // un athlete que le coach n'a pas ouvert depuis un mois. Leur perte ne coute
  // qu'une fusion sans base (union) a la prochaine ouverture.
  _purgerBasesAnciennes(sauf){
    const lim=Date.now()-SYNC_BASE_INUTILE_MS;
    let n=0;
    for(const k of Object.keys(localStorage)){
      if(k.indexOf('rc_sync_base:')!==0||k===this._cleBase(sauf)) continue;
      if(typeof currentUser==='object'&&currentUser&&k===this._cleBase(currentUser.email)) continue;
      let lu=0; try{ lu=Number((JSON.parse(localStorage.getItem(k))||{}).lu)||0; }catch(e){ lu=0; }
      if(lu<lim){ try{ localStorage.removeItem(k); n++; }catch(e){} }
    }
    return n;
  },

  // ── Quelle base pour CE dossier ? ───────────────────────────────────────
  // UNE COPIE PERIMEE N'A PAS LA MEME BASE QUE LA COPIE A JOUR. Une quinzaine
  // de gestes du coach lisent le dossier, ouvrent une boite de dialogue —
  // « Lever ce drapeau ? », « Combien de semaines ? » — puis l'ecrivent et
  // l'envoient. Si une descente arrive pendant que la boite est ouverte, la
  // copie qu'ils renvoient date d'AVANT elle. Fusionnee contre la base
  // d'APRES, elle semblait avoir retire tout ce que la descente venait
  // d'apporter — la seance de l'athlete, son bilan — et la fusion l'effacait
  // du serveur. DB.set, qui reecrit tout rc_users, ramenait de meme les autres
  // dossiers en arriere.
  //
  // CHAQUE COPIE LOCALE PORTE DONC SA LIGNEE : `_syncMaj`, l'horodatage de la
  // version du serveur dont elle derive, pose a chaque integration. Elle
  // voyage avec la copie — un geste lit le dossier, le modifie, l'ecrit : la
  // marque suit — et ne monte jamais (retirée avant l'envoi, hors empreintes).
  //
  // LES BASES PRECEDENTES RESTENT EN MEMOIRE, PAS DANS LE STOCKAGE : une base
  // pese jusqu'a une centaine de kilo-octets, et le cas qu'elles couvrent — un
  // geste en cours pendant une descente — ne survit pas a un rechargement.
  //
  // LIGNEE INCONNUE (marque perimee, memoire perdue) : la base est la copie
  // elle-meme, et c'est donc le serveur qui l'emporte partout. Une copie
  // qu'on sait perimee ne doit rien effacer.
  _histBases:{},
  _HIST_BASES:3,
  _baseDe(email,doc){
    const cur=this._lireBase(email);
    if(!cur) return null;
    const m=doc&&doc._syncMaj;
    if(m==null||m===cur.maj) return cur;
    const h=(this._histBases[email]||[]).find(b=>b&&b.maj===m);
    if(h) return h;
    return {h:syncEmpreintes(doc),maj:m};
  },

  // ── Un dossier, un echange a la fois ────────────────────────────────────
  // LES ENVOIS ET LES DESCENTES D'UN MEME DOSSIER PASSENT A LA FILE. Chacun
  // fait deux allers-retours — lire le serveur, puis ecrire — et ils se
  // croisaient. Mesure au banc a deux appareils : deux gestes du coach a une
  // seconde d'intervalle, le premier PUT parti arrive le dernier, et le
  // serveur garde la premiere modification en perdant la seconde ; l'appareil
  // du coach la perd aussi, en integrant l'envoi qui revient. Une descente qui
  // lit le serveur juste avant un envoi et fusionne juste apres defait de meme
  // ce qu'on vient d'envoyer.
  //
  // UNE FILE PAR DOSSIER, PAS UNE SEULE : un coach descend tous ses athletes
  // en parallele, et rien ne justifie de les mettre les uns derriere les
  // autres.
  //
  // ⚠ UNE ATTENTE BORNEE. Un fetch peut rester pendu des minutes sur un
  //   reseau mobile qui bascule ; sans borne, il bloquerait toutes les
  //   descentes de ce dossier et l'athlete ne recevrait plus rien. Passe ce
  //   delai, on repart comme avant : en parallele.
  _filesDossier:{},
  // Plus long que _DELAI_ENVOI, la borne d'un PUT : un envoi abandonne a
  // toujours rendu la main avant que le suivant ne parte.
  _DELAI_ENVOI:45000,
  _ATTENTE_FILE:60000,
  _aTonTour(email,fn){
    const prec=this._filesDossier[email]||Promise.resolve();
    const tour=Promise.race([prec,new Promise(r=>setTimeout(r,this._ATTENTE_FILE))]).then(fn);
    this._filesDossier[email]=tour.then(()=>{},()=>{});
    return tour;
  },

  // ── File de renvoi ────────────────────────────────────────────────────────
  // Un push qui échouait (jeton absent, réseau coupé, 5xx côté Firebase) laissait
  // la modification sur le seul appareil, sans jamais être retentée : le cloud ne
  // la voyait qu'à la prochaine modification du même dossier — parfois jamais.
  // On mémorise les clés en échec et on les rejoue au prochain démarrage de CLOUD
  // et après chaque authentification réussie.
  _QUEUE_KEY:'rc_sync_queue',
  _lireFile(){
    try{const f=JSON.parse(localStorage.getItem(this._QUEUE_KEY)||'[]');return Array.isArray(f)?f:[];}
    catch{return [];}
  },
  _ecrireFile(liste){
    // BORNEE A 500 (30/09/2026 ; elle l'etait a 50) : un coach a plus de
    // cinquante athletes perdait les plus anciennes clefs. Une file non bornee
    // finirait par saturer le stockage qu'elle est censee soulager : on garde
    // les plus recentes — MAIS JAMAIS SANS LA CLEF DE L'UTILISATEUR COURANT.
    let l=liste.slice(-CLOUD_FILE_MAX);
    try{
      const cur=(typeof currentUser==='object'&&currentUser&&currentUser.email)||'';
      if(cur&&liste.includes(cur)&&!l.includes(cur)){ l=l.slice(1); l.unshift(cur); }
    }catch(e){}
    try{localStorage.setItem(this._QUEUE_KEY,JSON.stringify(l));}catch{}
    try{ _majIndicAttente(); }catch(e){}
  },
  // LE JOURNAL D'ECRITURE ANTICIPEE (30/09/2026). La clef entre en file AVANT
  // tout reseau, et n'en sort qu'apres un PUT accepte (_defiler, apres r.ok) ou
  // un refus delibere. Une app tuee en plein envoi — onglet ferme, telephone
  // qui coupe l'app en arriere-plan — laisse donc la clef en file, et viderFile
  // renvoie le dossier au demarrage suivant. Avant, la clef n'entrait qu'a
  // l'ECHEC constate : un envoi abandonne en vol ne laissait aucune trace.
  _enfiler(email){
    if(!email) return;
    const f=this._lireFile();
    if(f.includes(email)) return;
    f.push(email);this._ecrireFile(f);
    this._syncFond();
  },
  // BACKGROUND SYNC : le navigateur reveille le service worker quand le reseau
  // revient, meme app en arriere-plan ; le SW demande alors aux pages ouvertes
  // de vider la file (lui-meme ne peut pas : jeton et fusion vivent ici).
  // Sans l'API (Safari), rien : le demarrage et le retour au premier plan
  // restent les filets.
  _syncFond(){
    try{
      if(!('serviceWorker' in navigator)) return;
      navigator.serviceWorker.ready
        .then(reg=>{ if(reg&&reg.sync&&typeof reg.sync.register==='function') return reg.sync.register('rc-sync'); })
        .catch(()=>{});
    }catch(e){}
  },
  _defiler(email){
    const f=this._lireFile();
    const g=f.filter(e=>e!==email);
    if(g.length!==f.length) this._ecrireFile(g);
  },
  enAttenteDeSync(){return this._lireFile().length;},

  // ── Relances progressives ─────────────────────────────────────────────────
  // La file rc_sync_queue dit QUOI renvoyer et survit aux sessions ; ceci dit
  // QUAND, pour le cas complémentaire où l'app reste ouverte et où le réseau
  // revient sans qu'aucune action de l'utilisateur ne le signale.
  // Paliers croissants : insister toutes les 30 s pendant une panne longue
  // viderait la batterie sans rien résoudre.
  _RETRY_DELAIS:[30000,120000,600000],
  _retryIdx:0,_retryTimer:null,
  _queueRetry(){
    if(this._retryTimer) return; // une seule relance en vol à la fois
    const delai=this._RETRY_DELAIS[Math.min(this._retryIdx,this._RETRY_DELAIS.length-1)];
    this._retryIdx++;
    this._retryTimer=setTimeout(async()=>{
      this._retryTimer=null;
      // Déconnecté entre-temps : plus rien à renvoyer, et _doPushOne écrirait
      // sur un nœud qui n'est plus celui de l'utilisateur courant.
      if(!currentUser?.email){this._retryIdx=0;return;}
      try{
        const u=this._dossierCourantAPousser(DB.get('users')||{});
        await this._doPushOne(currentUser.email,u);
        await this.viderFile();
        this._retryIdx=0; // succès : le prochain échec repart du palier court
      }catch(e){
        this._queueRetry(); // toujours en échec : palier suivant
      }
    },delai);
  },
  _annulerRetry(){clearTimeout(this._retryTimer);this._retryTimer=null;this._retryIdx=0;},
  // Rejoue les dossiers restés en échec. Silencieuse : c'est une reprise
  // d'arrière-plan, l'utilisateur a déjà été averti au moment de l'échec.
  // Séquentielle et non parallèle : chaque envoi relit le nœud distant pour la
  // défense anti-écrasement, et les lancer tous d'un coup au démarrage
  // retarderait l'affichage de l'accueil.
  async viderFile(){
    if(this._videEnCours) return 0;
    const f=this._lireFile();
    // Le profil public compte AUSSI : sans lui dans cette condition, une
    // vitrine seule en attente n’aurait jamais été rejouée.
    if((!f.length&&!this._fileProfil())||!this.canWrite()) return 0;
    this._videEnCours=true;
    let renvoyes=0;
    try{
      // RELU A CHAQUE TOUR, pour la meme raison que _doPush : l'envoi du
      // dossier precedent a pu en integrer un autre dans rc_users.
      for(const email of f){
        // Le dossier courant : celui en memoire si la copie locale est en retard.
        const u=(typeof currentUser==='object'&&currentUser&&currentUser.email===email)
          ?this._dossierCourantAPousser(DB.get('users')||{}):(DB.get('users')||{})[email];
        // Le dossier n'existe plus localement : plus rien à renvoyer.
        if(!u){this._defiler(email);continue;}
        try{
          await this._doPushOne(email,u);
          renvoyes++;
        }catch(e){
          // UN REFUS DEFINITIF NE BLOQUE PLUS LA FILE. Le `break` supposait que
          // tout echec etait passager — hors ligne, jeton expire. Un 401 sur une
          // clef que les regles refusent PAR CONSTRUCTION ne passera jamais : il
          // arretait le rejeu de toutes les clefs suivantes, et le dossier de
          // l'athlete lui-meme cessait d'etre renvoye. On defile la clef refusee
          // et on continue ; les echecs de reseau, eux, gardent le break.
          const _def=e&&(e._refus===true||/\b40[13]\b/.test(String(e.message||'')));
          if(_def){ this._defiler(email); continue; }
          break;
        }
      }
      // LE PROFIL PUBLIC, en dernier et sans jamais faire échouer le reste :
      // il ne part pas par _doPushOne, et une vitrine refusée ne doit pas
      // empêcher les dossiers de repartir. Un échec se ré-enfile tout seul.
      const _p=this._fileProfil();
      if(_p){
        const u=(DB.get('users')||{})[_p];
        if(!u) this._defilerProfil();
        else { try{ await this.pushProfilCoach(u); renvoyes++; }catch(e){} }
      }
    } finally { this._videEnCours=false; }
    return renvoyes;
  },
  /**
   * L'adresse PORTÉE PAR LE JETON, lue dans sa charge utile. Un JWT est trois
   * sections base64 séparées par des points ; la deuxième est du JSON et porte
   * la revendication `email`. Aucun appel réseau, aucun secret exposé.
   * @returns {string}
   */
  _emailDuJeton(){
    try{
      const p=String(this._idToken||'').split('.')[1];
      if(!p) return '';
      const j=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
      return String(j.email||'').toLowerCase();
    }catch(e){ return ''; }
  },
  /** Le motif du dernier refus d'identité, pour que l'appelant puisse le dire. */
  _jetonEtranger:'',
  async _getToken(){
    // ══ LE JETON DOIT APPARTENIR AU COMPTE AFFICHÉ ═══════════════════════════
    //
    // `rc_fb_auth` ne porte QUE des jetons — pas l'adresse à qui ils sont. Sur
    // un appareil où plusieurs comptes se succèdent, une bascule qui ne repose
    // pas les bons laisse ceux du précédent : l'app affiche Kévin, écrit dans
    // le dossier de Kévin, et signe avec le jeton de quelqu'un d'autre. La
    // règle compare les deux adresses, n'en reconnaît aucune, et refuse TOUT —
    // définitivement, avec pour seule trace « Erreur serveur 401 ».
    //
    // Constaté en production : cible « inkev8638@gmail,com », jeton
    // « kevinquentin2@gmail.com ». Aucune écriture ne passait plus, et la
    // vidéo de l'athlète n'atteignait jamais son coach.
    //
    // ON RÉPARE D'ABORD, on refuse ensuite : les jetons du bon compte sont
    // souvent déjà dans le registre, et l'athlète n'a alors rien à faire.
    try{
      const _attendu=String((typeof currentUser==='object'&&currentUser&&currentUser.email)||'').toLowerCase();
      const _actuel=this._emailDuJeton();
      if(_attendu&&_actuel&&_actuel!==_attendu){
        let _repare=false;
        try{
          const _c=(typeof comptesConnectes==='function'?comptesConnectes():[])
            .find(x=>x&&String(x.email||'').toLowerCase()===_attendu);
          if(_c&&_c.auth&&_c.auth.r){
            this._idToken=_c.auth.i||null;
            this._refreshToken=_c.auth.r;
            this._tokenExpiry=_c.auth.e||0;
            this._saveAuth();
            _repare=(this._emailDuJeton()===_attendu)||!this._idToken;
          }
        }catch(e){}
        if(!_repare){
          // On ne signe RIEN avec le jeton d'un autre : la requête serait
          // refusée, et surtout elle écrirait sous une identité qui n'est pas
          // celle de la personne devant l'écran.
          this._jetonEtranger=_actuel;
          this._idToken=null; this._refreshToken=null; this._tokenExpiry=0;
          return null;
        }
        this._jetonEtranger='';
      }
    }catch(e){}
    if(this._idToken&&Date.now()<this._tokenExpiry-60000) return this._idToken;
    if(!this._refreshToken) return null;
    try{
      const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+this._fbKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({grant_type:'refresh_token',refresh_token:this._refreshToken})
      });
      const d=await r.json();
      if(d.id_token){
        this._idToken=d.id_token;this._refreshToken=d.refresh_token;
        this._tokenExpiry=Date.now()+(parseInt(d.expires_in)||3600)*1000;
        this._saveAuth();return this._idToken;
      }
    }catch{}
    this._idToken=null;return null;
  },
  _signInErr:null,
  async signIn(email,password){
    this._signInErr=null;
    // VRAI QUAND LE JETON VIENT DU REPLI signUp — l'adresse n'avait AUCUN
    // compte et on vient d'en creer un. A l'inscription c'est le but ; a la
    // CONNEXION c'est une faute de frappe, et le compte vide ainsi cree
    // repondrait EMAIL_EXISTS a la vraie inscription du lendemain.
    this._compteCree=false;
    if(!this._fbKey||this._fbKey==='REPLACE_WITH_FIREBASE_WEB_API_KEY') return false;
    const call=async ep=>{
      try{
        const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:'+ep+'?key='+this._fbKey,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email,password,returnSecureToken:true})
        });
        const json=await r.json();
        return json;
      }catch{this._signInErr='network';return {};}
    };
    let d=await call('signInWithPassword');
    if(!d.idToken){
      const errCode=d.error?.message||'';
      // ADRESSE MAL FORMÉE : on ne tente pas signUp, il échouerait exactement
      // pareil. Un aller-retour réseau épargné, et surtout un cas nommé — sans
      // lui l'appelant retombait sur son message générique.
      if(errCode.includes('INVALID_EMAIL')){
        this._signInErr='invalid_email';return false;
      }
      // ══ INVALID_LOGIN_CREDENTIALS NE DIT PLUS RIEN, ET C'ÉTAIT LE BUG ══════
      //
      // Ce code s'arrêtait ici sur INVALID_PASSWORD *ou*
      // INVALID_LOGIN_CREDENTIALS, en concluant « mauvais mot de passe » — la
      // lecture était juste au moment où elle a été écrite. Elle ne l'est plus :
      // le projet a la PROTECTION CONTRE L'ÉNUMÉRATION DES ADRESSES activée, et
      // Firebase répond alors INVALID_LOGIN_CREDENTIALS AUSSI pour une adresse
      // parfaitement inconnue. C'est tout l'objet de cette protection : ne plus
      // laisser deviner qui a un compte.
      //
      // Mesuré le 02/09/2026 sur ce projet, avec une adresse jamais vue :
      //   signInWithPassword -> INVALID_LOGIN_CREDENTIALS  (et non EMAIL_NOT_FOUND)
      //   createAuthUri      -> plus aucun champ `registered`
      //   sendOobCode        -> succes, meme sur une adresse inexistante
      // Le repli signUp n'était donc PLUS JAMAIS atteint : toute inscription
      // sortait sur « Un compte existe déjà avec cet email », pour des adresses
      // que personne n'avait jamais utilisées. Plus une seule inscription ne
      // pouvait aboutir.
      //
      // ON NE DEVINE PLUS, ON DEMANDE. signUp est le seul point de l'API qui
      // discrimine encore, et sa réponse est sans ambiguïté :
      //   • EMAIL_EXISTS -> l'adresse est bien prise, le mot de passe est faux ;
      //   • un jeton     -> l'adresse était libre, le compte vient d'être créé.
      // Il ne peut RIEN détourner : sur un compte existant il refuse, quel que
      // soit le mot de passe présenté. Le tour de réseau supplémentaire ne
      // coute que dans le cas d'echec.
      if(!this._signInErr){ d=await call('signUp'); if(d.idToken) this._compteCree=true; }
      if(!d.idToken&&!this._signInErr){
        const e2=String(d.error?.message||'');
        // L'ADRESSE EXISTE : c'est signUp qui vient de le prouver, pas une
        // supposition tirée d'un code d'erreur devenu muet.
        if(e2.includes('EMAIL_EXISTS'))       this._signInErr='wrong_password';
        else if(e2.includes('INVALID_EMAIL')) this._signInErr='invalid_email';
        // MOT DE PASSE TROP COURT SUR UNE ADRESSE LIBRE. Sans ce cas nommé, la
        // création échouait sous le message générique « Réessaie » — et
        // réessayer ne pouvait pas marcher.
        else if(e2.includes('WEAK_PASSWORD'))  this._signInErr='weak_password';
      }
    }
    if(d.idToken){
      this._idToken=d.idToken;this._refreshToken=d.refreshToken;
      this._tokenExpiry=Date.now()+(parseInt(d.expiresIn)||3600)*1000;
      this._saveAuth();
      // Envoie immédiatement les données locales en attente après chaque auth réussie
      setTimeout(()=>{try{const u=DB.get('users');if(u) this._doPush(u);}catch{}},300);
      // …et rejoue les dossiers restés en échec pendant qu'on n'était pas
      // authentifié. C'est précisément le cas que la file existe pour rattraper.
      setTimeout(()=>{this.viderFile().catch(()=>{});},1200);
      return true;
    }
    return false;
  },
  // DEFAIT LE COMPTE QUI VIENT D'ETRE CREE PAR ERREUR. Utilise par doLogin
  // seulement. Rend true/false ; l'appelant ne doit PAS s'arreter sur un echec :
  // un menage rate ne doit pas empecher de dire ce qui s'est passe.
  async supprimerCompteCourant(){
    if(!this._fbKey||!this._idToken) return false;
    try{
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:delete?key='+this._fbKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({idToken:this._idToken})
      });
      return r.ok;
    }catch(e){ return false; }
  },
  // Crée un compte Firebase Auth SANS toucher à la session en cours.
  // signIn() écrase _idToken / _refreshToken : l'utiliser ici déconnecterait le
  // coach au profit de l'élève qu'il vient de créer. returnSecureToken:false
  // demande à Firebase de ne même pas émettre de jeton — rien à ignorer, donc
  // rien qui puisse fuiter dans la session.
  // Retourne {ok:true} ou {ok:false, err:'exists'|'weak'|'email'|'network'|<code>}.
  async createAuthAccount(email,password){
    if(!this._fbKey||this._fbKey==='REPLACE_WITH_FIREBASE_WEB_API_KEY') return {ok:false,err:'config'};
    try{
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+this._fbKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password,returnSecureToken:false})
      });
      const d=await r.json();
      const m=d.error?.message||'';
      if(m){
        if(m.includes('EMAIL_EXISTS'))   return {ok:false,err:'exists'};
        if(m.includes('WEAK_PASSWORD'))  return {ok:false,err:'weak'};
        if(m.includes('INVALID_EMAIL'))  return {ok:false,err:'email'};
        return {ok:false,err:m};
      }
      return {ok:true};
    }catch(e){ return {ok:false,err:'network'}; }
  },
  signOut(){
    this._idToken=null;this._refreshToken=null;this._tokenExpiry=0;
    try{localStorage.removeItem('rc_fb_auth');}catch{}
  },
  // ══ L'ADRESSE E-MAIL VERIFIEE (01/10/2026) ════════════════════════════════
  // Un filleul ne compte pour son parrain qu'avec une adresse VERIFIEE : le
  // Worker le lit dans le jeton (email_verified). A l'inscription, on envoie
  // le lien de verification ; ensuite, un rappel discret tant que ce n'est pas
  // fait (_majRappelVerification).
  async envoyerVerificationEmail(){
    const token=await this._getToken().catch(()=>null);
    if(!token||!this._fbKey) return false;
    try{
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+this._fbKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestType:'VERIFY_EMAIL',idToken:token})});
      return r.ok;
    }catch(e){ return false; }
  },
  // true / false selon le jeton courant ; null quand il n'y en a pas.
  emailVerifieDuJeton(){
    try{
      if(!this._idToken) return null;
      const p=JSON.parse(atob(String(this._idToken).split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      return p.email_verified===true;
    }catch(e){ return null; }
  },
  _resetErr:null,
  async resetPassword(email){
    this._resetErr=null;
    if(!this._fbKey) return false;
    try{
      const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+this._fbKey,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({requestType:'PASSWORD_RESET',email})
      });
      const d=await r.json();
      if(d.error){this._resetErr=d.error.message||'error';return false;}
      return true;
    }catch{this._resetErr='network';return false;}
  },
  // ──────────────────────────────────────────────────────────────

  ok(){return true;},
  canWrite(){return !!this._idToken;},
  configure(){},

  // ── _callFn : VESTIGE, jamais appele ────────────────────────────────────
  // Aucune Cloud Function n'est deployee ni executable : le plan Spark ne les
  // fait pas tourner, et l'app est passee 100 % client. Cette methode n'a plus
  // aucun appelant dans le fichier — conservee comme point d'accroche si le
  // projet passe un jour en Blaze, mais elle ne protege RIEN aujourd'hui.
  // L'en-tete precedent annoncait des « tokens RCACCESS signes cote serveur » :
  // cette signature n'existe pas.
  //
  // ⚠ 27/09/2026 : LE SERVEUR LÉGER RÉPOND À CES APPELS (/fn/<nom>, même
  //   protocole, jeton Firebase vérifié). Depuis le 01/10/2026, ouvrirEssai et
  //   verifierAchatProgramme y sont aussi : voir FONCTIONS_WORKER.
  get _functionsBase(){ return SERVEUR_LEGER?SERVEUR_LEGER_URL+'/fn':'https://europe-west1-repcore-sync.cloudfunctions.net'; },
  async _callFn(name,data){
    const token=await this._getToken();
    const headers={'Content-Type':'application/json'};
    if(token) headers['Authorization']='Bearer '+token;
    let r;
    try{
      r=await fetch(this._functionsBase+'/'+name,{method:'POST',headers,body:JSON.stringify({data})});
    }catch(e){
      throw new Error('Impossible de joindre le serveur : vérifie ta connexion.');
    }
    let j;
    try{ j=await r.json(); }catch(e){
      // Réponse non-JSON (ex. page d'erreur HTML servie par le Service Worker en fallback
      // offline si le serveur est injoignable) — à traiter comme une vraie erreur, jamais
      // comme un succès silencieux.
      throw new Error('Réponse serveur invalide ('+r.status+') : le service est peut-être indisponible.');
    }
    if(!r.ok||j.error){
      // LE STATUT HTTP VOYAGE AVEC L'ERREUR : un 400 ou un 403 est une réponse
      // définitive, qu'un appelant doit pouvoir distinguer d'une panne.
      const err=new Error((j.error&&j.error.message)||'Erreur serveur ('+r.status+').');
      err.statut=r.status;
      throw err;
    }
    if(!('result' in j)){
      throw new Error('Réponse serveur inattendue : réessaie.');
    }
    return j.result;
  },
  // ──────────────────────────────────────────────────────────────

  push(users){
    // Ne pousse que currentUser — évite d'écraser les données d'autres utilisateurs
    // avec des copies obsolètes présentes en cache chez le coach
    clearTimeout(this._pushTimer);
    this._pushTimer=setTimeout(()=>this._doPush(users),2000);
  },
  // Push ciblé d'un seul utilisateur (modifications coach sur profil athlète).
  // Retourne la promesse de _doPushOne — les appelants peuvent l'await (ou .then/.catch)
  // pour afficher un toast de succès/erreur ; les fire-and-forget l'ignorent simplement.
  // Repose l'horodatage d'avant sur la copie locale. Appelee quand un envoi a
  // echoue : sans elle, le dossier local garde une date que le serveur n'a
  // jamais recue.
  //
  // setLocal ET NON set : `set` pousse, et reparer un horodatage declencherait
  // un envoi complet de tous les dossiers.
  _rendreHorodatage(email,avant){
    try{
      const _us=DB.get('users');
      if(_us&&_us[email]){
        if(avant===undefined) delete _us[email].updatedAt; else _us[email].updatedAt=avant;
        DB.setLocal('users',_us);
      }
      const _se=DB.get('session');
      if(_se&&_se.email===email){
        if(avant===undefined) delete _se.updatedAt; else _se.updatedAt=avant;
        DB.setLocal('session',_se);
      }
    }catch(e){}
  },
  pushOne(email,user){
    // N3.1 — TOUTE POUSSEE HORODATE LE DOSSIER, ICI ET NULLE PART AILLEURS.
    // syncUser refuse de telecharger un dossier dont le updatedAt distant n'est
    // pas STRICTEMENT plus recent que le local. Sept ecritures du coach —
    // phase, demande de video, annulation, reponse au bilan, habitudes, levee
    // de drapeau — poussaient sans y toucher : le toast annoncait « ton athlete
    // la verra a sa prochaine ouverture », l'athlete rouvrait, la sonde
    // repondait « rien de neuf », et il ne voyait jamais la reponse.
    //
    // ICI PLUTOT QUE DANS LES SEPT : la huitieme ecriture ajoutee demain en
    // heritera sans que personne n'y pense. Et c'est le seul point ou l'on
    // sait qu'un dossier PART — un dossier ecrit localement sans etre pousse
    // n'a aucune raison d'etre horodate.
    // B1.3 — L'HORODATAGE LOCAL NE VAUT QUE SI LE SERVEUR L'A ACCEPTE.
    //
    // La ligne ci-dessous avance updatedAt AVANT toute tentative d'envoi, et le
    // bloc suivant l'ecrit dans la copie locale. Quand l'envoi echoue — reseau
    // coupe, 500, jeton expire, ou le refus delibere de _doPushOne — le dossier
    // local garde une date que le serveur n'a jamais recue. Il se croit alors
    // plus recent que lui POUR TOUJOURS, et syncUser, qui ne telecharge que du
    // STRICTEMENT plus recent, repond « rien de neuf » a chaque reveil.
    //
    // L'APPAREIL DEVIENT AVEUGLE A CE DOSSIER. Un coach dont une seule ecriture
    // a echoue ne voyait plus jamais descendre les videos ni les seances de cet
    // athlete, sans qu'aucun message ne le dise et sans que rien ne repare.
    // Reproduit : un envoi en 500, puis une video deposee cote athlete que la
    // synchro suivante refuse de tirer.
    //
    // ON RETIENT DONC LA VALEUR D'AVANT, et on la repose si l'envoi echoue.
    const _horodatageAvant=(()=>{ try{
      const _u=DB.get('users'); return (_u&&_u[email])?_u[email].updatedAt:undefined;
    }catch(e){ return undefined; } })();
    try{ if(user&&typeof user==='object') user.updatedAt=Date.now(); }catch(e){}
    // B1.2 — ET LA COPIE LOCALE PORTE LE MEME HORODATAGE.
    //
    // Les sept ecritures du coach appellent DB.set('users',users) AVANT
    // CLOUD.pushOne : la version deposee dans localStorage portait donc
    // l'ancien updatedAt, et le serveur le nouveau. _mergeUser compare
    // `distant.updatedAt > safe.updatedAt` et jugeait le distant plus recent A
    // TOUS LES COUPS — y compris pour ecraser une modification locale faite
    // entre-temps et pas encore poussee. Le dossier partait juste, la copie
    // qui reste sur l'appareil mentait sur son age.
    //
    // ICI, ET NON DANS LES SEPT APPELANTS : c'est le meme raisonnement que
    // pour l'horodatage lui-meme, pose ci-dessus en un seul endroit. La
    // huitieme ecriture ajoutee demain en heritera.
    //
    // setLocal ET NON set : `set` pousse, et reparer l'horodatage d'un envoi
    // cible declencherait un envoi complet de tous les dossiers.
    //
    // LE DOSSIER COURANT AUSSI. `rc_session` porte une seconde copie du
    // dossier de l'utilisateur connecte ; laissee en arriere, elle reintroduit
    // exactement le meme ecart au prochain demarrage.
    try{
      if(user&&user.updatedAt){
        const _us=DB.get('users');
        if(_us&&_us[email]){ _us[email].updatedAt=user.updatedAt; DB.setLocal('users',_us); }
        const _se=DB.get('session');
        if(_se&&_se.email===email){ _se.updatedAt=user.updatedAt; DB.setLocal('session',_se); }
      }
    }catch(e){}
    const key='_one_'+email;
    clearTimeout(this._pushTimers?.[key]);
    // EN FILE AVANT TOUT RESEAU : voir _enfiler.
    this._enfiler(email);
    const p=this._doPushOne(email,user);
    // Filet unique pour la trentaine d'appelants « fire-and-forget » : attacher
    // ici un gestionnaire marque la promesse comme traitée, donc aucun rejet non
    // capturé. `p` est tout de même retournée telle quelle — les appelants qui
    // l'await ou lui ajoutent un .catch reçoivent bien l'erreur (voir
    // addBilanPhoto). L'échec reste signalé par le badge de synchronisation.
    // B1.3 - LA REPARATION DE L'HORODATAGE, SUR UNE BRANCHE A ELLE.
    // Elle ne peut pas s'ecrire dans le filet ci-dessous : un test lit le
    // source de pushOne et exige d'y trouver `p.catch(()=>{})` A LA LETTRE,
    // parce que c'est lui qui garantit qu'aucun des trente appelants « lance
    // et oublie » ne produise de rejet non capture. `then(null, …)` fait le
    // meme travail sans toucher au filet, et sans s'intercaler entre
    // _doPushOne et ce que pushOne rend.
    p.then(null,()=>{ this._rendreHorodatage(email,_horodatageAvant); });
    return p;
  },
  // La contraception ne monte QUE si l'athlète a activé le partage. Sans ça,
  // l'interrupteur d'interface ne masquerait rien : la règle de /users laisse
  // le coach lire le dossier entier, et la donnée serait déjà sur son
  // téléphone. Même traitement que les constantes, même contrepartie assumée :
  // non partagée, elle ne survit pas à un changement d'appareil.
  //
  // Fonction NOMMÉE et non trois lignes dans _doPushOne : celle-ci est
  // asynchrone et fait du réseau, donc inéprouvable depuis la suite. Une liste
  // noire qu'on ne peut pas tester n'est pas une liste noire.
  // Les DATES de declaration suivent exactement le meme sort que les blocs
  // qu elles datent. Une date qui existe est une declaration qui existe :
  // laisser `sante.declare.pes` monter aurait revele le PES a un coach a
  // qui l athlete ne l a pas partage, et le journal aurait fait pire encore
  // en gardant la trace des retraits.
  //
  // Meme patron que _retirerContraceptionSiNonPartagee : safe est une copie
  // PLATE, donc safe.sante est LE MEME objet que user.sante. Sans le clone,
  // le delete effacerait la vraie donnee locale.
  _retirerDatesNonPartagees(safe,user){
    if(!safe||!safe.sante||typeof safe.sante!=='object') return safe;
    const vu=b=>{ try{ return santeVisibleCoach(user,b)===true; }catch(e){ return false; } };
    safe.sante={...safe.sante};
    if(safe.sante.declare&&typeof safe.sante.declare==='object'){
      const d={...safe.sante.declare};
      for(const b of Object.keys(d)) if(!vu(b)) delete d[b];
      safe.sante.declare=d;
    }
    if(Array.isArray(safe.sante.journal))
      safe.sante.journal=safe.sante.journal.filter(e=>e&&vu(e.bloc));
    return safe;
  },
  // ⚠ LES TRAITEMENTS NE PARTENT QU'AMPUTES. Le noeud /users est lisible par
  // le COACH de ce dossier : un nom de medicament y serait lisible par lui
  // sans que l'athlete l'ait partage. On remplace donc le tableau par sa
  // version masquee — les moments, et le nom seulement quand partageCoach est
  // explicitement vrai.
  //
  // Meme patron que _retirerContraceptionSiNonPartagee : safe est une copie
  // PLATE, donc safe.sante est LE MEME objet que user.sante. Sans le clone, le
  // remplacement effacerait la vraie donnee locale.
  //
  // CONTREPARTIE ASSUMEE, ET A DIRE : ce qui n'est pas partage ne quitte pas
  // l'appareil. Un changement de telephone perd le nom, la dose et le
  // prescripteur des traitements non partages — exactement la contrepartie
  // deja acceptee pour les constantes et les analyses avant qu'un noeud prive
  // n'existe pour elles. `sante_privee` est le prolongement naturel de ce lot ;
  // il n'y est pas.
  _masquerTraitements(safe,user){
    if(!safe||!safe.sante||typeof safe.sante!=='object') return safe;
    if(!Array.isArray(safe.sante.traitements)) return safe;
    safe.sante={...safe.sante};
    try{ safe.sante.traitements=traitementsPourCoach(user); }
    catch(e){ delete safe.sante.traitements; }
    // LE RELEVE DE PRISE NE PART PAS DU TOUT. L'observance ne regarde pas le
    // coach, et un releve qui remonterait ferait cesser de cocher.
    delete safe.sante.prises;
    return safe;
  },
  _retirerContraceptionSiNonPartagee(safe){
    if(!safe||!safe.cycle||safe.cycle.contraceptionPartagee) return safe;
    // safe est une copie PLATE du dossier : safe.cycle est LE MÊME objet que
    // user.cycle. Sans ce clone, le delete effacerait la vraie donnée locale.
    safe.cycle={...safe.cycle};
    delete safe.cycle.contraception;
    return safe;
  },
  // `rattrapage` : ce dossier est deja le SECOND essai, celui qui part apres
  // une descente. Il interdit de recommencer — voir le bloc « AVANT DE
  // REFUSER » plus bas.
  //
  // `_tour` : la base lue quand l'appelant a remis son dossier. Absent, on se
  // met a la file ; present, c'est notre tour.
  async _doPushOne(email,user,rattrapage,_tour){
    // LA BASE EST LUE ICI, A LA REMISE DU DOSSIER, et non quand vient son
    // tour. Elle doit etre la version du serveur dont CE dossier derive. Lue
    // plus tard — apres qu'un envoi ou une descente l'a avancee — elle ferait
    // passer pour un retrait tout ce que le dossier n'avait pas encore vu : la
    // seance que l'athlete vient d'envoyer, la reponse du coach a un bilan. La
    // fusion l'effacerait du serveur, puis de l'autre appareil.
    if(!_tour){
      // EN FILE AVANT TOUT RESEAU (journal d'ecriture anticipee, voir _enfiler).
      this._enfiler(email);
      const tour={base:this._baseDe(email,user)};
      return this._aTonTour(email,()=>this._doPushOne(email,user,rattrapage,tour));
    }
    this._setSyncStatus('pending');
    try{
      const token=await this._getToken();
      // Sans jeton, l'ancien `return` laissait le badge figé sur « Synchronisation
      // en cours » et l'utilisateur croyait ses données envoyées. On signale l'échec
      // et on remonte une erreur actionnable aux appelants qui l'attendent.
      // DEUX PANNES DIFFÉRENTES, DEUX MESSAGES. « Reconnecte-toi » n'aide
      // personne quand le problème est qu'on est connecté avec le MAUVAIS
      // compte : il faut nommer lequel, sinon on se reconnecte au même.
      //
      // ⚠ LE COMMENTAIRE VIT ICI, HORS DU BLOC. Un test borne la garde
      //   `if(!token){…}` à six cents caractères pour vérifier qu'elle n'a pas
      //   disparu ; l'allonger la fait échouer alors qu'elle est intacte.
      const _msgSansJeton=this._jetonEtranger
        ? ('Session ouverte avec « '+this._jetonEtranger+' » alors que l’app affiche « '
           +(((typeof currentUser==='object'&&currentUser&&currentUser.email)||'?'))
           +' ». Déconnecte-toi et reconnecte-toi avec le bon compte.')
        : 'Non authentifié : modification enregistrée sur cet appareil uniquement.';
      if(!token){
        this._setSyncStatus(false);
        const sansJeton=new Error(_msgSansJeton);
        // Remonté tel quel par toastSync : « synchronisation en échec » ne dirait
        // pas à l'utilisateur qu'il lui suffit de se reconnecter.
        sansJeton._actionnable=true;
        throw sansJeton;
      }
      const safeKey=email.replace(/\./g,',');
      let safe={...user};
      // AVANT TOUT LE RESTE : les traitements ne doivent jamais traverser en
      // clair, quelle que soit la suite du traitement de `safe`.
      try{ safe=this._masquerTraitements(safe,user)||safe; }catch(e){}
      // ⚠ LES RETRAITS SONT ENVELOPPES POUR ETRE JOUES DEUX FOIS, et c'est un
      //   ajout du 21/09/2026. Une fois ici ; une fois APRES la fusion a trois
      //   voies, qui prend des champs du distant — et un champ qu'on a cesse de
      //   partager a pu y rester d'une epoque ou il l'etait. Sans ce second
      //   passage, la fusion aurait pu renvoyer au serveur ce que l'athlete
      //   venait de retirer. La fermeture lit `safe` a chaque appel, donc la
      //   version fusionnee au second.
      const _retirerPrives=()=>{
      delete safe.pwd;delete safe.pwdHash;delete safe._st;delete safe._stb64;delete safe._sk;
      // seenBilans uses email addresses as keys (dots/@ invalid in Firebase) — strip before push
      delete safe.seenBilans;
      // La lignee de la copie locale (voir _baseDe) : elle n'a de sens que sur
      // cet appareil.
      delete safe._syncMaj;
      delete safe.programPdf; // base64 blob — stocké dans Firebase Storage, pas dans RTDB
      // Constantes physiologiques et analyses biologiques : elles ne quittent
      // PAS l'appareil. Le dossier /users est lisible par le coach ; une tension
      // et un bilan sanguin n'ont rien à y faire, et l'athlète n'a pas à choisir
      // entre consigner ses valeurs et les garder pour lui.
      // CONTREPARTIE ASSUMÉE, à dire à l'utilisateur : ces données ne sont ni
      // sauvegardées ni transférées d'un téléphone à l'autre. Un changement
      // d'appareil les perd.
      // Le drapeau général, LUI, part : prévenir le coach est l'un de ses effets.
      // MÊME autorité que santeBlocsPrives, qui décide de ce qui part vers
      // sante_privee. Deux tables séparées finiraient par diverger, et un
      // bloc à la fois envoyé au nœud privé ET laissé dans users/ serait le
      // pire des deux mondes : illisible pour l'athlète, lisible du coach.
      // Un test vérifie que les deux listes coïncident exactement.
      for(const bloc of Object.keys(SANTE_CHAMPS)){
        if(santeVisibleCoach(user,bloc)) continue;
        for(const champ of SANTE_CHAMPS[bloc]) delete safe[champ];
      }
      // JOURNAL DE COACH — derniere barriere avant le reseau. Les notes vivent
      // dans le dossier du coach ; ce PUT-ci peut viser le dossier d un ATHLETE,
      // et une copie de commodite y serait lisible par lui. On ne retire donc
      // le champ que lorsque le document poussé n est PAS celui de l emetteur.
      if(!currentUser||email!==currentUser.email) delete safe.coachNotes;
      this._retirerContraceptionSiNonPartagee(safe);
      this._retirerDatesNonPartagees(safe,user);
      // La grossesse ne monte JAMAIS par défaut. coach_public est déjà hors
      // de portée — c'est le profil DU COACH, filtré par liste blanche — mais
      // /users est lisible en entier par le coach : sans ce retrait,
      // « visibilité désactivée » ne serait qu'une promesse d'interface.
      // Le consentement de partage part AVEC la déclaration quand elle ne
      // monte pas : un dossier portant « pesPartagee:true » sans « pes » se
      // lirait tout seul. La déclaration elle-même, elle, est déjà retirée
      // par la boucle ci-dessus.
      if(!safe.grossessePartagee) delete safe.grossesse;
      // Même raison, même patron : /users est lisible en entier par le
      // coach. Le consentement de partage part avec elle, sinon un dossier
      // portant « pesPartagee:true » sans « pes » se lirait tout seul.
      if(!safe.pesPartagee){ delete safe.pes; delete safe.pesPartagee; }
      };
      _retirerPrives();
      // Permettre aux règles RTDB de vérifier qui est le coach de cet athlète
      // Les trois cas doivent être traités EXPLICITEMENT. L'ancienne forme ne
      // touchait à coachEmailKey que lorsqu'un coach était trouvé : après un
      // « Libérer » ou la suppression du compte coach, la clé restait en place
      // et l'ex-coach conservait son droit d'écriture, que les règles RTDB
      // accordent précisément sur la foi de cette valeur.
      // null et non undefined : JSON.stringify conserve null, et Firebase
      // supprime alors la clé côté serveur.
      if(safe.coachId){
        const coach=Object.values(DB.get('users')||{}).find(u=>u.id===safe.coachId);
        // Le coach n'est pas toujours en cache : sur un appareil neuf, l'athlete
        // a saisi un code sans avoir jamais vu sa fiche. Ecraser a null dans ce
        // cas annulait la cle posee au rattachement A CHAQUE push, et le coach
        // n'obtenait jamais l'acces. On retombe donc sur la valeur deja portee.
        // La revocation reste intacte : « Liberer » efface coachId, donc la
        // branche else ci-dessous, qui met bien null.
        safe.coachEmailKey = coach?.email ? coach.email.replace(/\./g,',')
                                          : (safe.coachEmailKey||null);
      } else {
        safe.coachEmailKey = null;
      }
      // Supprimer photo2 (base64 temporaire pour OCR) de chaque session avant push RTDB
      // N3.5 — UN OBJET A CLEFS NUMERIQUES EST VRAI, ET N'A PAS DE .map.
      // Firebase rend sessions_config sous forme d'objet des qu'un creneau
      // manque. L'exception partait AVANT le fetch : le catch enfilait la clef
      // dans rc_sync_queue, et _queueRetry rejouait exactement le meme echec
      // par paliers, indefiniment. Le dossier de cet athlete n'etait plus
      // jamais synchronise, quelle que soit la donnee modifiee.
      const _tab=v=>Array.isArray(v)?v:(v&&typeof v==='object'?Object.keys(v)
        .sort((a,b)=>Number(a)-Number(b)).map(k=>v[k]):null);
      if(safe.sessions_config){
        const _sc=_tab(safe.sessions_config);
        if(_sc) safe.sessions_config=_sc.map(s=>{
          if(!s||!s.photo2) return s;
          const {photo2,...rest}=s; return rest;
        });
      }
      // safe.sessions PARTAIT SANS ETRE NORMALISE, seul des trois. Un trou au
      // moment de l'envoi — une seance supprimee, un tableau reconstruit a la
      // main — et Firebase stocke un OBJET : tout appareil qui redescendra le
      // dossier en heritera. La lecture sait desormais s'en remettre, mais on
      // ne pousse pas sciemment une forme qu'on devra reparer a l'arrivee.
      //
      // PAR SYMETRIE AVEC LES DEUX AUTRES, et au meme endroit : trois champs,
      // trois normalisations, cote a cote. Un quatrieme ajoute demain se verra
      // manquer.
      if(safe.sessions){
        const _ss=_tab(safe.sessions);
        if(_ss) safe.sessions=_ss;
      }
      if(safe.bilans&&_tab(safe.bilans)) safe.bilans=await Promise.all(_tab(safe.bilans).map(async b=>{
        const cl={...b};
        for(const k of Object.keys(cl)){
          if(k.includes('photo')&&cl[k]&&typeof cl[k]==='string'&&cl[k].startsWith('data:')){
            cl[k]=await this._compressPhoto(cl[k])||undefined;
            if(!cl[k]) delete cl[k];
          }
        }
        return cl;
      }));
      // Défense en profondeur : ne jamais écraser un nœud distant PLUS RÉCENT
      // par un objet PLUS PAUVRE. Un appareil resté longtemps hors ligne, ou une
      // réinscription mal rattrapée, effacerait sinon tout l'historique. Le
      // surcoût est une lecture par envoi ; à ce prix, une perte de données
      // devient impossible même si un autre garde-fou cède.
      // ── Santé privée : écrire d'abord, supprimer ensuite ─────────────
      // L'ORDRE EST CRITIQUE et non négociable. Si la connexion tombe entre
      // les deux, la donnée existe en double — désagréable, réparable au
      // prochain envoi. Dans l'autre sens elle n'existe plus nulle part.
      //
      // AVANT LA LECTURE DU DOSSIER (30/09/2026), et non plus entre elle et le
      // PUT : il allongeait d'un aller-retour la fenetre lecture → ecriture que
      // le PUT conditionnel protege. Pas APRES le PUT non plus : l'ordre
      // « ecrire le prive, puis retirer de users/ » doit tenir.
      // Cet envoi est indépendant de celui du dossier : son échec ne doit pas
      // empêcher le reste de partir, et un dossier sans bloc masqué n'écrit
      // rien du tout plutôt que d'écraser le nœud par un objet vide.
      try{
        const prives=santeBlocsPrives(user);
        if(Object.keys(prives).length){
          prives.maj=Date.now();
          // Horodatage de migration : il DOIT figurer en liste blanche des
          // règles, sinon l'écriture entière est rejetée. Une clef de trop
          // suffit — c'est le piège qui a rendu constantes inécrivables.
          prives.migre=Date.now();
          const _cp=JSON.stringify(prives);
          try{ _quotaCompter('out',_cp.length); }catch(e){}
          await fetch(this._urlSantePrivee(safeKey)+'?auth='+token,
            {method:'PUT',headers:{'Content-Type':'application/json'},
             body:_cp});
        }
      }catch(e){ console.error('[RepCore] sante_privee push:',e); }
      // ⚠ AVEC SON ETAG (30/09/2026) : le PUT qui suit est CONDITIONNEL
      //   (if-match). Entre cette lecture et l'ecriture, un autre appareil a pu
      //   ecrire ; sans condition, son ecriture etait ecrasee par une fusion
      //   faite sur une version qu'il avait deja depassee. Avec, le serveur
      //   repond 412 et l'on refusionne sur la version qu'il porte vraiment.
      const _lu=await this.pullUser(email,{etag:true});
      // Un remplacant qui rend le dossier seul (ancienne forme) : pas d'etag.
      const _luN=(_lu&&typeof _lu==='object'&&('etag' in _lu)&&('doc' in _lu))?_lu:{doc:_lu||null,etag:null};
      const distant=_luN.doc;
      let _etag=_luN.etag;
      // LA COPIE D'AVANT FUSION : un 412 oblige a refusionner, et une fusion ne
      // se refait proprement que depuis ce que l'appareil voulait ecrire, pas
      // depuis le resultat d'une fusion precedente.
      const _safeAvantFusion=JSON.parse(JSON.stringify(safe));
      // Le createur ecrit les champs geles (regles) : on ne les lui aligne pas.
      const _parLeCreateur=!!(typeof currentUser==='object'&&currentUser&&currentUser.email===CREATOR_EMAIL);
      const _base=_tour.base;
      // Integre une version du serveur dans le dossier qui part : les
      // traitements d'un autre, puis la fusion a trois voies. Rejouee telle
      // quelle a chaque 412.
      const _integrer=(d)=>{
        safe=JSON.parse(JSON.stringify(_safeAvantFusion));
      // ⚠ LES TRAITEMENTS D'UN AUTRE NE SE REECRIVENT PAS DEPUIS UNE COPIE
      // MASQUEE. Meme patron que coachNotes vingt lignes plus haut : on regarde
      // si le document pousse est celui de l'emetteur. Ici, le distant vient
      // d'etre lu — c'est la seule version complete accessible, et elle sert de
      // base. Le releve de prise, lui, ne se reecrit JAMAIS d'ailleurs que de
      // l'appareil de l'athlete.
      if(currentUser&&email!==currentUser.email){
        try{
          if(!safe.sante||typeof safe.sante!=='object') safe.sante={};
          else safe.sante={...safe.sante};
          const _dt=((d||{}).sante||{}).traitements;
          const _f=_fusionnerTraitementsPoussee(_dt,safe.sante.traitements);
          if(_f.length) safe.sante.traitements=_f;
          else delete safe.sante.traitements;
          const _dp=((d||{}).sante||{}).prises;
          if(_dp!=null) safe.sante.prises=_dp; else delete safe.sante.prises;
        }catch(e){}
      }
        // SANS BASE : l'union conservatrice, et non plus la copie locale brute.
        if(d){
          const _avant=Number(safe.updatedAt)||0;
          safe=_base?syncFusion(_base.h,safe,d):syncUnionSansBase(safe,d);
          _retirerPrives();
          // UN HORODATAGE STRICTEMENT SUPERIEUR A CELUI DU SERVEUR. Un appareil
          // dont l'horloge retarde aurait sinon pose une date anterieure, et
          // l'autre appareil aurait conclu qu'il n'y avait rien de neuf.
          safe.updatedAt=Math.max(_avant,(Number(d.updatedAt)||0)+1);
        }
        // LES CHAMPS DE DROITS REPARTENT TELS QUE LE SERVEUR LES PORTE : voir
        // _alignerChampsGeles. Un seul different, et Firebase rejetterait le
        // dossier ENTIER — seances comprises.
        if(!_parLeCreateur) safe=_alignerChampsGeles(safe,d);
        // LES LIENS DE VIDEO, conformes a la regle : voir _videosConformes.
        _videosConformes(safe);
        // LES TEXTES LIBRES, a la longueur que la regle admet : _textesBornes.
        _textesBornes(safe);
      };
      // ⚠ LA FUSION A TROIS VOIES, AVANT D'ECRIRE QUOI QUE CE SOIT. C'est le
      //   coeur du correctif du 21/09/2026 : sans elle, ce PUT ecrasait le
      //   document entier, et l'appareil qui envoyait en dernier effacait ce
      //   que l'autre venait d'ecrire — les calories du coach, la seance et le
      //   bilan de l'athlete, la reponse du coach a ce bilan. Voir syncFusion.
      //
      //   SANS BASE, RIEN NE CHANGE : syncFusion rend alors la version locale,
      //   comme avant. La base s'etablit a la premiere descente, c'est-a-dire
      //   a l'ouverture de l'app.
      // ⚠ PAS D'ENVOI A L'AVEUGLE. Un dossier dont on tient une base existe
      //   sur le serveur : si la lecture ne rend rien, c'est le reseau qui a
      //   cede, pas le dossier qui manque. Le PUT partait quand meme, avec la
      //   seule copie locale, et effacait ce que l'autre appareil avait pose
      //   depuis. Mesure au banc : la seance de l'athlete disparaissait du
      //   serveur, puis de son propre telephone a la descente suivante.
      //   L'envoi est remis en file, comme une coupure : il repartira avec une
      //   lecture.
      if(!distant&&_base) throw new Error('Serveur illisible ('+((this._lectures||{})[email]||'?')
        +') : envoi remis à plus tard pour ne rien écraser.');
      // SANS ETAG, PAS DE PUT : il ne pourrait pas etre conditionnel. Un nœud
      // absent en porte un (« null_etag ») : l'absence veut dire une lecture
      // ratee. Rejouable, comme une coupure.
      if(!_etag) throw new Error('Serveur illisible (pas d’ETag, '+((this._lectures||{})[email]||'?')
        +') : envoi remis à plus tard pour ne rien écraser.');
      _integrer(distant);
      // ══ LE GARDE-FOU COMPARE LE CONTENU, PLUS LES DATES (30/09/2026) ══════
      // Il ne se declenchait jamais : pushOne et saveUser posent updatedAt =
      // Date.now() juste avant, et le local etait donc TOUJOURS « plus recent ».
      // La question est desormais « le dossier qui part porte-t-il moins que le
      // serveur ? » — seances, bilans, videos, sans compter ce qu'une pierre
      // tombale du local retire legitimement ; et pour le programme, moins de
      // travail que le serveur SI celui-ci a bouge depuis la base (sinon, c'est
      // le local qui a retire, volontairement).
      const volume=o=>(((o&&o.sessions)||[]).length)+(((o&&o.bilans)||[]).length)+(((o&&o.videos)||[]).length);
      const travail=o=>{ try{ return _cptContenu((o&&o.sessions_config)||[]); }catch(e){ return 0; } };
      const _vif=d=>syncSansTombes(d,syncTombes(safe));
      const _progBouge=d=>{ try{ return !_base||syncEmpreintes(d)['sessions_config']!==_base.h['sessions_config']; }catch(e){ return true; } };
      const _plusPauvre=d=>!!d&&((volume(safe)<volume(_vif(d)))||(_progBouge(d)&&travail(safe)<travail(d)));
      if(_plusPauvre(distant)){
        // LE PROGRAMME ETAIT LE SEUL CHAMP DISPUTE QUE LA DEFENSE NE REGARDAIT
        // PAS — et c'est le plus dispute de tous : le coach l'edite depuis son
        // ordinateur pendant que le telephone de l'athlete pousse son propre
        // dossier. Une seance ecrite par le coach pouvait donc etre effacee par
        // un envoi parti d'un appareil qui ne l'avait pas encore vue, sans que
        // le garde-fou bronche : il ne comptait que l'historique.
        //
        // PAS AVEC LE MEME COMPTEUR, ET C'EST DELIBERE. sessions_config fait
        // TOUJOURS sept cases : sa longueur ne dit rien. Ce qui compte est le
        // TRAVAIL qu'il porte — un exercice, un nom de seance, un jour actif —
        // et _cptContenu mesure exactement cela, sur cette forme-la, depuis
        // qu'il a ete ecrit pour les modeles du coach. Une seule definition de
        // « y a-t-il du travail la-dedans », pour les deux endroits.
        //
        // ET DEUX MESSAGES DISTINCTS : melanger sept creneaux a un historique
        // de seances rendrait le chiffre annonce incomprehensible, et un
        // message qu'on ne comprend pas est un message qu'on clique sans lire.
        const _tS=travail(safe), _tD=_progBouge(distant)?travail(distant):_tS;
        // ══ AVANT DE REFUSER : DESCENDRE, PUIS REPARTIR UNE FOIS ════════════
        //
        // Le dossier local est plus pauvre PARCE QU'IL N'A PAS ENCORE DESCENDU.
        // Refuser sans rien tenter de plus laissait la situation SANS ISSUE :
        // le refus est marque `_nonRejouable`, il n'entre donc pas dans la file
        // de relance, et rien ne le rejoue jamais. Une video deposee dans cette
        // fenetre-la n'atteignait jamais le coach — et l'athlete avait pourtant
        // lu « Video envoyee au coach », puisque la confirmation ne repond que
        // de l'ecriture LOCALE.
        //
        // LA REPARATION EST CELLE QUI MANQUAIT : on fusionne le distant dans le
        // local — l'union garde ce que le serveur n'a jamais vu, video comprise
        // — puis on repart une fois, avec le dossier complet. Le garde-fou n'a
        // alors plus rien a refuser, puisque le local porte tout le distant.
        //
        // UNE SEULE FOIS, par le drapeau : si le second envoi se fait refuser a
        // son tour, c'est que la fusion n'a pas suffi, et boucler n'y changerait
        // rien.
        if(!rattrapage&&((_tS<_tD)||(volume(safe)<volume(_vif(distant))))){
          // DANS LE TOUR EN COURS : passer par la file attendrait la fin de
          // cet envoi, qui attend cette descente.
          const descendu=await this.syncUser(email,false,true).catch(()=>false);
          if(descendu){
            // Le dossier courant passe par _dossierCourantAPousser : quota
            // plein, rc_users est en retard sur la memoire.
            const frais=(typeof currentUser==='object'&&currentUser&&currentUser.email===email)
              ?this._dossierCourantAPousser(DB.get('users')||{}):(DB.get('users')||{})[email];
            if(frais){
              // HORODATE ICI, par exception a la regle posee dans pushOne : ce
              // second envoi ne passe pas par elle, et sans date neuve le
              // dossier repartirait avec celle du serveur. Les autres appareils
              // le liraient « pas plus recent » et ne descendraient pas la
              // video qu'on vient justement de sauver.
              frais.updatedAt=Date.now();
              return await this._doPushOne(email,frais,true,{base:this._baseDe(email,frais)});
            }
          }
        }
        if(_tS<_tD){
          this._setSyncStatus(false);
          const refus=new Error('Le programme distant est plus récent et plus complet ('
            +_tD+' séance'+(_tD>1?'s':'')+' contre '+_tS
            +') : envoi annulé pour ne pas écraser le travail de ton coach.');
          refus._nonRejouable=true;
          refus._actionnable=true;
          throw refus;
        }
        if(volume(safe)<volume(_vif(distant))){
          this._setSyncStatus(false);
          const refus=new Error('Version distante plus récente et plus complète ('
            +volume(_vif(distant))+' entrées contre '+volume(safe)
            +') : envoi annulé pour ne pas écraser tes données.');
          // Refus délibéré, pas une panne : le rejouer à chaque démarrage
          // échouerait à l'identique indéfiniment. Il ne va pas dans la file.
          refus._nonRejouable=true;
          refus._actionnable=true;
          throw refus;
        }
      }
      const url=this._fbUrl.replace('users.json','users/'+safeKey+'.json');
      // ══ LE PUT CONDITIONNEL (if-match), ET SA REPRISE SUR 412 ════════════
      // 412 : un autre appareil a ecrit depuis notre lecture. La reponse porte
      // l'ETag courant (en-tete) et la valeur courante (corps) : on refusionne
      // depuis la copie d'avant fusion, avec la MEME base, et on repart avec le
      // nouvel etag. Trois 412 de suite : erreur REJOUABLE (file de relance) —
      // un dossier qui bouge a ce point sera repris un peu plus tard.
      let r, _conflits=0, corps='';
      for(;;){
      corps=JSON.stringify(safe);
      // keepalive accepte les en-tetes : la requete etait deja « pre-verifiee »
      // (Content-Type JSON), et le serveur y admet if-match.
      const opts={method:'PUT',headers:{'Content-Type':'application/json','if-match':_etag},body:corps};
      // Onglet déjà masqué : le navigateur peut détruire la page avant la
      // réponse, et une requête normale serait annulée en vol. `keepalive` la
      // laisse aller au bout — c'est l'équivalent de sendBeacon, mais qui
      // accepte PUT et l'en-tête d'authentification (sendBeacon ne fait que
      // POST sans en-tête, inutilisable sur cette route).
      // Plafond du navigateur : 64 Ko. Au-delà, fetch rejette d'emblée ; on
      // envoie alors normalement — la file de relance couvre le cas où la page
      // meurt avant la fin.
      if(document.hidden&&corps.length<60000) opts.keepalive=true;
      // UN ENVOI BORNE DANS LE TEMPS. Sans borne, un PUT pendu sur un reseau
      // mobile qui bascule pouvait aboutir des minutes plus tard, APRES un
      // envoi plus recent du meme dossier, et le defaire. Abandonne, il part
      // en file comme une coupure et repartira avec une relecture — donc une
      // fusion. La file d'attente par dossier (_ATTENTE_FILE) attend plus
      // longtemps que cette borne : deux envois du meme dossier ne peuvent
      // plus se chevaucher.
      const _arret=new AbortController();
      const _minuteur=setTimeout(()=>{ try{ _arret.abort(); }catch(e){} },this._DELAI_ENVOI);
      opts.signal=_arret.signal;
      try{ r=await fetch(url+'?auth='+token,opts); }
      finally{ clearTimeout(_minuteur); }
      // Sortant : le corps envoyé. Entrant : la réponse de Firebase, qui
      // renvoie l'objet écrit — d'où le doublement du coût par envoi.
      try{ _quotaCompter('out',corps.length);
        const cl=Number(r.headers.get('content-length'));
        if(cl>0) _quotaCompter('in',cl); }catch(e){}
      if(r.status!==412) break;
      _conflits++;
      if(_conflits>=CLOUD_CONFLITS_MAX){
        throw new Error('Conflit d’écriture répété ('+_conflits+' fois) : envoi remis à plus tard.');
      }
      let _nd=null, _ne=null;
      try{ _ne=r.headers.get('ETag'); const _t=await r.text(); _nd=_t?JSON.parse(_t):null; }catch(e){ _ne=null; }
      // L'en-tete absent (proxy, navigateur) : on relit, avec son etag.
      if(!_ne){ const _re=await this.pullUser(email,{etag:true}); _nd=_re&&_re.doc||null; _ne=_re&&_re.etag||null; }
      if(!_ne) throw new Error('Serveur illisible après un conflit : envoi remis à plus tard.');
      _etag=_ne;
      _integrer(_nd);
      // Meme garantie apres une refusion : jamais moins que le serveur, pierres
      // tombales mises a part. Rejouable : la prochaine tentative redescendra.
      if(_plusPauvre(_nd)) throw new Error('Le serveur porte plus que ce dossier après un conflit : envoi remis à plus tard.');
      }
      this._setSyncStatus(r.ok);
      if(!r.ok){
        // ⚠ UN 401 NE DIT PAS CE QU'IL REFUSE, et c'est ce qui rend la panne
        //   indéchiffrable. La règle d'écriture compare l'adresse PORTÉE PAR LE
        //   JETON à la CLÉ du nœud visé ; une majuscule, un espace, un point de
        //   plus d'un côté, et tout est refusé — définitivement, en silence.
        //   Les deux valeurs tiennent en trente caractères : on les met dans le
        //   message, c'est le seul endroit où elles peuvent être lues.
        let _detail='';
        if(r.status===401||r.status===403){
          let _jeton='(illisible)';
          try{
            const _p=JSON.parse(atob(String(token).split('.')[1]
              .replace(/-/g,'+').replace(/_/g,'/')));
            _jeton=String(_p.email||'(jeton sans adresse)');
          }catch(e){}
          const _attendu=_jeton.replace(/\./g,',');
          _detail=' · cible « '+safeKey+' » · jeton « '+_jeton+' » → attend « '
            +_attendu+' »'+(_attendu===safeKey?' (identiques)':' (DIFFÉRENTS)');
        }
        throw new Error('Erreur serveur '+r.status+' ('+r.statusText+')'+_detail);
      }
      // Le nœud distant est à jour : plus rien à rejouer pour cette clé, et le
      // réseau répond — la relance en attente n'a plus lieu d'être.
      this._defiler(email);
      this._annulerRetry();
      // ⚠ L'APPAREIL INTEGRE CE QU'IL VIENT D'ENVOYER. La fusion a pu prendre
      //   au serveur des champs que cet appareil n'avait pas — les calories
      //   que le coach venait de poser, la reponse a un bilan. S'il ne les
      //   recopiait pas chez lui, sa copie restait perimee, et comme elle porte
      //   desormais l'horodatage le plus recent, la descente suivante ne les
      //   aurait jamais ramenes.
      //
      //   ⚠ setLocal ET NON set. DB.set('users') declenche lui-meme un envoi :
      //   l'appeler ici aurait relance un envoi apres chaque envoi.
      //
      //   ⚠ ET currentUser AUSSI. saveUser reecrit la base locale a partir de
      //   currentUser : si celui-ci gardait l'ancienne valeur, le prochain geste
      //   de l'athlete l'aurait remise en place, et renvoyee.
      try{
        const _us=DB.get('users')||{};
        const _b=_us[email]?this._baseDe(email,_us[email]):null;
        // ⚠ ET SANS BASE AUSSI (30/09/2026, trouve par scripts/verif/banc-sync.mjs).
        //   Un appareil neuf, ou dont la base a ete purgee, envoie l'UNION de
        //   sa copie et du serveur — puis posait cette union comme base sans
        //   l'avoir integree chez lui. A la descente suivante, les seances du
        //   serveur figuraient dans la base et manquaient a la copie : la fusion
        //   les lisait comme supprimees ICI, et l'envoi d'apres les effacait du
        //   serveur. La base de cette integration-la est ce que l'appareil a
        //   envoye avant la fusion : ce qu'il a change depuis reste a lui, ce
        //   que l'union a pris au serveur entre chez lui.
        //   ⚠ LA COPIE LA PLUS FRAICHE, alors : quota plein, rc_users est en
        //   retard sur la memoire, et la seance qui n'existe qu'en memoire,
        //   presente dans ce qui est parti, passerait pour retiree ici.
        if(!_b&&_us[email]&&typeof currentUser==='object'&&currentUser&&currentUser.email===email)
          _us[email]=this._dossierCourantAPousser(_us);
        const _bh=_b?_b.h:(_us[email]?syncEmpreintes(_safeAvantFusion):null);
        if(_bh&&_us[email]){
          const _clesAvant=Object.keys(_us[email]);
          const _hAvant=_repeintUtile(email)?syncEmpreintes(_us[email])['']:null;
          _us[email]=syncFusion(_bh,_us[email],safe);
          _us[email]._syncMaj=Number(safe.updatedAt)||0;
          DB.setLocal('users',_us,true);
          if(typeof currentUser==='object'&&currentUser&&currentUser.email===email){
            Object.assign(currentUser,_us[email]);
            // Ce que l'autre appareil a supprime disparait aussi — voir syncUser.
            for(const k of _clesAvant) if(!(k in _us[email])) delete currentUser[k];
            DB.setLocal('session',currentUser,true);
          }
          // L'envoi a ramene du nouveau de l'autre appareil : l'ecran suit.
          if(_hAvant!==null&&_hAvant!==syncEmpreintes(_us[email])['']) _planifierRepeint(email);
        }
      }catch(e){ console.warn('[RepCore] integration apres envoi :',e); }
      this._poserBase(email,safe);
      // LA BOITE DU COACH : un nombre, apres le dossier. Voir _signalerCoach.
      this._signalerCoach(email,safe,safeKey,token);
      // LE ✓ PROMIS PAR LE MESSAGE DE QUOTA : il ne vient qu'ici, apres un PUT
      // reussi du dossier courant.
      if(DB._quotaAnnonce&&typeof currentUser==='object'&&currentUser&&currentUser.email===email){
        DB._quotaAnnonce=false;
        try{ toast('✓ Envoyé au cloud. Le téléphone est plein : ces données ne seront pas disponibles hors ligne.','var(--green)'); }catch(e){}
      }
    }catch(e){
      console.error('[RepCore] sync push error:',e);
      this._setSyncStatus(false);
      // Entonnoir unique de tous les échecs d'envoi : c'est ici, et nulle part
      // ailleurs, que la file se remplit. Les ~20 appelants « fire-and-forget »
      // en bénéficient sans avoir à s'en occuper.
      // Branché ici et non au seul garde de jeton : le même entonnoir couvre
      // le réseau coupé et les 5xx, qui sont les causes les plus fréquentes.
      if(!e||!e._nonRejouable){this._enfiler(email);this._queueRetry();}
      // Un refus DELIBERE ne se rejoue pas : il se reproduirait a chaque palier.
      // La clef posee avant l'envoi sort donc de la file.
      else this._defiler(email);
      throw e;
    }
  },
  async _compressPhoto(dataURL){
    return new Promise(resolve=>{
      try{
        const img=new Image();
        img.onload=()=>{
          const MAX_W=220,MAX_H=300;
          const r=Math.min(MAX_W/img.width,MAX_H/img.height,1);
          const cv=document.createElement('canvas');
          cv.width=Math.round(img.width*r);
          cv.height=Math.round(img.height*r);
          cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
          resolve(cv.toDataURL('image/jpeg',0.72));
        };
        img.onerror=()=>resolve(null);
        img.src=dataURL;
      }catch{resolve(null);}
    });
  },
  _setSyncStatus(state){
    this._lastSync={state,ts:Date.now()};
    this._updateSyncBadge();
  },
  _updateSyncBadge(){
    const s=this._lastSync;if(!s) return;
    let text,color;
    if(s.state==='pending'){text='● Synchronisation en cours';color='var(--info)';}
    else if(s.state===true){text='● Synchronisé';color='var(--success)';}
    else{text='● Échec : réessaie';color='var(--warning)';}
    // .rc-sync-badge est le crochet neutre : il permet d'ajouter un indicateur
    // hors des écrans coach sans renommer l'existant. data-sync-state laisse la
    // feuille de style décider de la discrétion, sans dupliquer la logique ici.
    document.querySelectorAll('.coach-sync-badge, .rc-sync-badge').forEach(el=>{
      el.textContent=text;el.style.color=color;
      el.dataset.syncState=s.state==='pending'?'pending':(s.state===true?'ok':'fail');
    });
  },
  async _doPush(users){
    // Ne pousse QUE currentUser — évite d'écraser les données d'athlètes avec des copies obsolètes
    if(!currentUser?.email) return;
    // Push groupé débounce, toujours appelé depuis un setTimeout sans capture :
    // il ne doit jamais rejeter. L'échec est déjà porté par le badge (_doPushOne).
    //
    // LE DOSSIER TEL QU'IL EST AU DEPART, et non l'instantane pris au DB.set
    // deux secondes plus tot : un envoi ou une descente a pu avancer la base
    // entre-temps, et l'instantane aurait defait ce qu'ils venaient
    // d'apporter.
    const _frais=DB.get('users')||users||{};
    try{
      await this._doPushOne(currentUser.email, this._dossierCourantAPousser(_frais));
    }catch(e){}
  },
  // LE DOSSIER COURANT A POUSSER. La copie fraiche de rc_users, sauf quand
  // elle ment : l'ecriture locale a echoue (quota), ou currentUser est plus
  // recent qu'elle. On pousse alors le dossier EN MEMOIRE — copie profonde,
  // et passe par _sansSante comme dans saveUser : le verrou de l'article 9 ne
  // se contourne pas par ce chemin-ci.
  _dossierCourantAPousser(frais){
    const em=currentUser&&currentUser.email;
    const f=(frais&&em)?frais[em]:null;
    const echec=!!(DB._echecLocal&&DB._echecLocal.users);
    const plusRecent=!!(f&&Number(currentUser.updatedAt||0)>Number(f.updatedAt||0));
    if(echec||plusRecent){
      try{ return JSON.parse(JSON.stringify(_sansSante(currentUser))); }catch(e){ return f||currentUser; }
    }
    return f||currentUser;
  },

  // ── Firebase Storage : téléverse un PDF, retourne l'URL de téléchargement ──
  _storageBucket:STORAGE_BUCKET,
  async uploadPdf(emailKey,file){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté : impossible d’envoyer le PDF.');
    const path='pdfs/'+emailKey+'/programme.pdf';
    const url='https://firebasestorage.googleapis.com/v0/b/'+this._storageBucket+'/o?name='+encodeURIComponent(path)+'&uploadType=media';
    const res=await fetch(url,{method:'POST',headers:{'Authorization':'Bearer '+token,'Content-Type':'application/pdf'},body:file});
    if(!res.ok){
      let msg=''+res.status;
      try{const d=await res.json();msg=d.error?.message||msg;}catch{}
      throw new Error('Firebase Storage : '+msg);
    }
    const d=await res.json();
    const encodedName=encodeURIComponent(d.name);
    return'https://firebasestorage.googleapis.com/v0/b/'+d.bucket+'/o/'+encodedName+'?alt=media&token='+d.downloadTokens;
  },

  // ══════ N3.7 — UNE SUPPRESSION DOIT POUVOIR REDESCENDRE ═════════════════
  // Les tableaux `bilans` et `sessions` sont fusionnes par UNION : une entree
  // presente en local et absente du cloud est conservee. C'est ce qui protege
  // un appareil reste hors ligne — une seance saisie dans une salle sans
  // reseau ne doit pas disparaitre a la premiere synchro — et il faut le
  // garder. Mais cela rend aussi toute suppression IRREVERSIBLE DANS LE
  // MAUVAIS SENS : une seance aberrante retiree du dossier remonte amputee
  // dans Firebase, puis ressuscite sur le telephone de l'athlete a chaque
  // descente. Les deux cotes cessent alors de compter le meme nombre de
  // seances.
  //
  // LA PIERRE TOMBALE EST CE QUI DISTINGUE LES DEUX CAS. Une entree absente
  // du cloud ET nommee dans `supprimes` a ete reellement supprimee : on la
  // retire. Une entree absente du cloud et absente de `supprimes` n'est jamais
  // montee : l'union la garde, exactement comme avant.
  //
  // LA CLEF EST CELLE DE L'UNION, pas une autre : `id` pour une seance,
  // `date|type` pour un bilan. Deux clefs differentes pour un meme objet, et
  // la pierre tombale ne recouvrirait jamais la bonne tombe.
  //
  // BORNEE. Un dossier qui accumulerait ses suppressions depuis des annees
  // finirait par peser plus lourd que ce qu'il decrit. Les plus anciennes
  // sortent en premier : une entree supprimee il y a deux ans a eu le temps
  // de disparaitre de tous les appareils.
  _cleBilan(b){ return b?String(b.date)+'|'+String(b.type||''):''; },
  _pierresTombales(u){
    const s=(u&&u.supprimes)||{};
    const lire=o=>{
      const m=new Set();
      if(!o||typeof o!=='object') return m;
      for(const k of Object.keys(o)) m.add(String(k));
      return m;
    };
    return {sessions:lire(s.sessions),bilans:lire(s.bilans),videos:lire(s.videos)};
  },
  // Fusionner un seul utilisateur cloud → localStorage
  _mergeUser(merged,email,cloudUser){
    // N3.4 — le dossier distant est remis a plat DES SON ARRIVEE : il est
    // range dans currentUser sans repasser par le stockage local, et un
    // sessions_config en objet aurait donc traverse la porte d'entree.
    //
    // ET PAS SEULEMENT sessions_config. `bilans` et `sessions` sont ETALES
    // quelques lignes plus bas — `[...cloudBilans]`, `[...cloudSessions]` — et
    // un objet n'est pas iterable : la TypeError partait dans syncUser, methode
    // async dont personne n'attend le resultat, donc en rejet non capture.
    // DB.set('users',merged) n'etait jamais atteint. L'athlete dont une seule
    // seance manquait au milieu de sa liste ne se synchronisait plus DU TOUT,
    // sur aucun appareil, et rien ne le disait.
    //
    // AVANT TOUT USAGE, et sur les trois champs a la fois : _aplatirDossier
    // les nomme en un seul endroit.
    try{ _aplatirDossier(cloudUser); }catch(e){}
    const loc=merged[email];
    // ⚠ AVEC UNE BASE, LA FUSION A TROIS VOIES — LA MEME QU'A L'ENVOI. Sans
    //   elle, tout ce qui n'etait ni seance, ni bilan, ni video passait en
    //   « le plus recent gagne » sur le document entier : un appareil qui avait
    //   touche a n'importe quoi depuis la derniere descente ignorait tout ce
    //   que l'autre avait ecrit, nutrition et programme compris.
    //
    //   SANS BASE — premiere descente sur cet appareil — le comportement
    //   d'avant, ci-dessous, a l'identique.
    const _b=loc?this._baseDe(email,loc):null;
    if(_b){
      const locConstantes=loc.constantes, locAnalyses=loc.analyses;
      merged[email]=syncFusion(_b.h,loc,cloudUser);
      // Ces deux-la vivent sur l'appareil et dans l'espace de sante prive :
      // ce que le dossier partage en dit ne fait jamais foi.
      if(locConstantes!==undefined) merged[email].constantes=locConstantes;
      if(locAnalyses!==undefined) merged[email].analyses=locAnalyses;
      return;
    }
    // N3.7 — les pierres tombales DISTANTES : ce que quelqu'un a reellement
    // supprime, ailleurs. Les locales ne comptent pas ici — elles n'ont pas
    // encore ete poussees, et c'est le dossier local qui les porte deja.
    const _mort=this._pierresTombales(cloudUser);
    // Merge bilans (union par date+type)
    const cloudBilans=cloudUser.bilans||[];
    const localBilans=loc?.bilans||[];
    const allBilans=[...cloudBilans];
    for(const lb of localBilans){
      // Absent du cloud ET nomme dans les pierres tombales : supprime pour de
      // bon. Absent du cloud et absent des pierres : jamais monte, on garde.
      if(_mort.bilans.has(this._cleBilan(lb))) continue;
      const idx=allBilans.findIndex(cb=>cb.date===lb.date&&cb.type===lb.type);
      if(idx===-1){allBilans.push(lb);}
      else{Object.keys(lb).filter(k=>k.includes('photo')).forEach(k=>{allBilans[idx][k]=lb[k];});}
    }
    allBilans.sort((a,b)=>a.date-b.date);
    // Merge sessions (union par id — évite qu'un sync écrase des séances locales)
    const cloudSessions=cloudUser.sessions||[];
    const localSessions=(loc?.sessions||[]).filter(s=>!(s&&_mort.sessions.has(String(s.id))));
    const sessMap=new Map();
    [...cloudSessions,...localSessions].forEach(s=>{if(s?.id&&!sessMap.has(s.id))sessMap.set(s.id,s);});
    const allSessions=[...sessMap.values()].sort((a,b)=>(a.date||0)-(b.date||0));
    // ══ LES VIDEOS SE FUSIONNENT AUSSI, ET POUR LA MEME RAISON ══════════════
    //
    // Sans cette union, `merged[email]={...cloudUser}` quelques lignes plus bas
    // remplacait le tableau local par celui du serveur. Une video deposee sur
    // ce telephone et dont l'envoi n'etait pas encore parti — ou avait ete
    // REFUSE par la defense en profondeur de _doPushOne — disparaissait a la
    // premiere descente. Elle ne restait alors nulle part : ni chez le coach,
    // qui ne l'avait jamais recue, ni chez l'athlete, a qui l'app avait pourtant
    // affiche « Video envoyee au coach ». Seul le fichier Cloudinary survivait,
    // orphelin, sans plus rien pour le designer.
    //
    // LE CLOUD PASSE EN PREMIER, comme pour les seances : sa copie porte la
    // correction du coach — feedback, reperes horodates, feedbackSeen — et
    // c'est elle qui doit gagner. La locale ne sert qu'a rattraper ce que le
    // serveur n'a jamais vu.
    const cloudVideos=Array.isArray(cloudUser.videos)?cloudUser.videos:[];
    const localVideos=(Array.isArray(loc?.videos)?loc.videos:[])
      .filter(v=>!(v&&_mort.videos.has(String(v.id))));
    const vidMap=new Map();
    [...cloudVideos,...localVideos].forEach(v=>{if(v?.id&&!vidMap.has(v.id))vidMap.set(v.id,v);});
    const allVideos=[...vidMap.values()].sort((a,b)=>(a.date||0)-(b.date||0));
    // Constantes et analyses ne montent pas dans users/ — elles vivent dans
    // sante_privee, hors de portée du coach. Le dossier distant lu ici ne les
    // porte donc toujours pas, et l'écrasement ci-dessous les effacerait à
    // chaque réveil. On les retient AVANT, on les repose APRÈS — même
    // traitement que les bilans et les séances, pour la même raison.
    // Leur relecture depuis le nœud privé se fait ailleurs, en asynchrone :
    // voir _migrerSantePriveeLocale, appelée au démarrage.
    const locConstantes=loc?.constantes;
    const locAnalyses=loc?.analyses;
    // Non partagée, elle n'est jamais montée : le dossier distant ne la porte
    // donc pas, et l'écrasement ci-dessous l'effacerait à chaque réveil.
    const locContra=(loc&&loc.cycle)?loc.cycle.contraception:undefined;
    // Jamais montée, donc absente du dossier distant : sans cette retenue,
    // l'écrasement l'effacerait à chaque réveil.
    const locGross=loc?loc.grossesse:undefined;
    // Les champs d'identite et de vitrine du coach. Ils MONTENT — la liste
    // CHAMPS_PROFIL_COACH les nomme — mais un dossier pousse par un appareil
    // qui ne les portait pas revient sans eux et les efface en arrivant.
    const locProfil={};
    if(loc) for(const k of CLOUD.CHAMPS_PROFIL_COACH)
      if(loc[k]!==undefined&&loc[k]!==''&&loc[k]!==null) locProfil[k]=loc[k];
    if(!loc||((cloudUser.updatedAt||0)>=(loc.updatedAt||0))){
      merged[email]={...cloudUser};
      delete merged[email].pwd;delete merged[email].pwdHash;
    }
    merged[email].bilans=allBilans;
    merged[email].sessions=allSessions;
    merged[email].videos=allVideos;
    if(locConstantes!==undefined) merged[email].constantes=locConstantes;
    if(locAnalyses!==undefined) merged[email].analyses=locAnalyses;
    if(locGross!==undefined&&merged[email]&&merged[email].grossesse===undefined)
      merged[email].grossesse=locGross;
    if(locContra!==undefined&&merged[email]&&(merged[email].cycle||{}).contraception===undefined){
      merged[email].cycle={...(merged[email].cycle||{}),contraception:locContra};
    }
    // ABSENT N'EST PAS VIDE : on ne repose que ce que le distant IGNORE. Un
    // champ vide cote distant est un champ efface volontairement ailleurs, et
    // cet effacement doit atteindre cet appareil.
    if(merged[email]) for(const k in locProfil)
      if(merged[email][k]===undefined) merged[email][k]=locProfil[k];
  },
  // Les blocs masqués vivent hors de users/ : sans cette lecture, un athlète
  // qui change d'appareil retrouvait son dossier SANS eux — exactement ce que
  // ce nœud existe pour éviter.
  async pullSantePrivee(email){
    const key=email.replace(/\./g,',');
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return null;
      const r=await fetch(this._urlSantePrivee(key)+'?auth='+token,{signal:ctrl.signal});
      if(r.ok){
        const t=await r.text();
        try{ _quotaCompter('in',t.length); }catch(e){}
        const d=t?JSON.parse(t):null;
        if(d) return d;
      }
    }catch(e){}
    return null;
  },
  // SUPPRIME LE DOSSIER D'UN ATHLETE DANS LA BASE. Rend true, ou false.
  //
  // ⚠ L'ORDRE COMPTE, ET IL N'EST PAS INTERCHANGEABLE. La regle d'ecriture de
  // /users/$emailKey accorde le droit au coach QUE DESIGNE LE DOSSIER
  // EXISTANT — `data.child('coachEmailKey')`. Detacher d'abord, supprimer
  // ensuite, c'est se retirer soi-meme le droit de supprimer : la requete
  // repartirait en 401 et le dossier resterait, orphelin, dans la base.
  // On supprime donc TANT QUE le lien est encore la.
  async supprimerDossier(email){
    const key=String(email||'').replace(/\./g,',');
    if(!key) return false;
    try{
      const token=await this._getToken();
      if(!token) return false;
      const url=this._fbUrl.replace('users.json','users/'+key+'.json');
      const r=await fetch(url+'?auth='+token,{method:'DELETE'});
      return r.ok;
    }catch(e){ console.error('[RepCore] suppression dossier:',e); return false; }
  },
  // Le dernier statut de lecture de chaque dossier — 200, 401, « réseau »…
  // Il ne sert qu'a dire POURQUOI un envoi a ete remis (voir « PAS D'ENVOI A
  // L'AVEUGLE » dans _doPushOne) : un 401 et une coupure ne se reparent pas
  // pareil.
  _lectures:{},
  // ══ LIRE LES DROITS (build 1425, lot 0) ═════════════════════════════════════════
  // Le noeud droits/<cle> : le palier et son echeance, poses par le serveur.
  // Rend {ok:true,droits} quand le serveur a repondu (droits peut etre null —
  // « rien d'ouvert » est une reponse), {ok:false} quand on n'a pas pu lire.
  // ⚠ LES DEUX NE SE CONFONDENT PAS : un 401 sur des regles pas encore
  //   deployees n'est pas « cette personne n'a aucun droit ».
  async pullDroits(email){
    const key=String(email||'').replace(/[.]/g,',');
    if(!key) return {ok:false,raison:'sans adresse'};
    const base=this._fbUrl.replace('users.json','droits/'+key+'.json');
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return {ok:false,raison:'non authentifie'};
      const r=await fetch(base+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) return {ok:false,raison:'HTTP '+r.status};
      const txt=await r.text();
      try{ _quotaCompter('in',txt.length); }catch(e){}
      const d=txt?JSON.parse(txt):null;
      return {ok:true,droits:(d&&typeof d==='object')?d:null};
    }catch(e){ return {ok:false,raison:'reseau'}; }
  },
  // L'interrupteur de la bascule : posé par le script de rattrapage
  // (remplir-paiements.mjs --ecrire) une fois droits/ rempli pour les abonnés
  // d'avant. true, false (absent), ou null quand la lecture échoue.
  async pullDroitsServeur(){
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return null;
      const r=await fetch(this._fbUrl.replace('users.json','reglages_publics/droitsServeur.json')+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) return null;
      const d=await r.json();
      // {actif, v} : `v` vaut 2 une fois remplir-droits.mjs passé (30/09/2026).
      return {actif:!!(d&&Number(d.le)>0),v:Number(d&&d.v)||0};
    }catch(e){ return null; }
  },
  // ══ LE REGISTRE DES COACHS (30/09/2026) ══════════════════════════════════
  // coachs_registre/<cle> : {plan, actifJusqu, le}, ecrit par le Worker seul.
  // Meme contrat que pullDroits : {ok:true, registre|null} quand le serveur a
  // repondu, {ok:false} sinon — « pas au registre » n'est pas « illisible ».
  async pullCoachRegistre(email){
    const key=String(email||'').toLowerCase().replace(/[.]/g,',');
    if(!key) return {ok:false,raison:'sans adresse'};
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return {ok:false,raison:'non authentifie'};
      const r=await fetch(this._fbUrl.replace('users.json','coachs_registre/'+key+'.json')+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) return {ok:false,raison:'HTTP '+r.status};
      const txt=await r.text();
      try{ _quotaCompter('in',txt.length); }catch(e){}
      const d=txt?JSON.parse(txt):null;
      return {ok:true,registre:(d&&typeof d==='object')?d:null};
    }catch(e){ return {ok:false,raison:'reseau'}; }
  },
  // ══ ECRIRE UN DROIT, DEPUIS L’APPLICATION (24/09/2026) ══════════════════
  //
  // ⚠ C’EST LA SEULE ECRITURE DE CE NOEUD DANS TOUT LE FICHIER, et la regle ne
  //   l’accorde qu’a l’adresse du createur. LA GARDE EST REPETEE ICI : sans
  //   elle, un autre compte enverrait la requete, Firebase la refuserait, et le
  //   seul retour serait « HTTP 401 » — un echec illisible la ou il faut une
  //   phrase claire. C’est la meme defense en profondeur que toggleSubStatus.
  //
  // PATCH ET NON PUT : le noeud porte aussi l’essai (essaiOuvertLe,
  // essaiFinit). Un PUT les effacerait en suspendant un acces, et la personne
  // se verrait offrir un second essai de trente jours.
  //
  // `champs === null` SUPPRIME LE NOEUD. C’est « rouvrir » : on n’ecrit pas une
  // date par-dessus, on rend la main au dossier, qui sait deja jusqu’a quand va
  // le pack ou l’abonnement.
  async poserDroits(email,champs){
    const mail=String(email||'').trim().toLowerCase();
    if(!mail||mail.indexOf('@')<0) return {ok:false,raison:'adresse incomplete'};
    if(!currentUser||currentUser.email!==CREATOR_EMAIL)
      return {ok:false,raison:'reserve au createur'};
    if(champs!==null&&(!champs||typeof champs!=='object'))
      return {ok:false,raison:'rien a ecrire'};
    const base=this._fbUrl.replace('users.json','droits/'+mail.replace(/[.]/g,',')+'.json');
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),8000);
    try{
      const token=await this._getToken();
      if(!token) return {ok:false,raison:'non authentifie'};
      const corps=(champs===null)?'':JSON.stringify(champs);
      const r=await fetch(base+'?auth='+token,(champs===null)
        ?{method:'DELETE',signal:ctrl.signal}
        :{method:'PATCH',headers:{'Content-Type':'application/json'},
          body:corps,signal:ctrl.signal});
      try{ _quotaCompter('out',corps.length+base.length); }catch(e){}
      if(!r.ok) return {ok:false,raison:'HTTP '+r.status};
      return {ok:true};
    }catch(e){ return {ok:false,raison:'reseau'}; }
  },
  // `opts.etag` (30/09/2026) : demande l'ETag du nœud (en-tête
  // X-Firebase-ETag) et rend {doc, etag} — doc null pour un nœud vide, etag
  // null si la lecture a échoué. Sans l'option, la forme de toujours : le
  // dossier, ou null. _doPushOne s'en sert pour un PUT conditionnel (if-match).
  async pullUser(email,opts){
    const avecEtag=!!(opts&&opts.etag);
    const key=email.replace(/\./g,',');
    const base=this._fbUrl.replace('users.json','users/'+key+'.json');
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      const url=token?base+'?auth='+token:base;
      const r=await fetch(url,avecEtag?{signal:ctrl.signal,headers:{'X-Firebase-ETag':'true'}}:{signal:ctrl.signal});
      this._lectures[email]=r.status;
      if(r.ok){
        // .text() puis JSON.parse plutôt que .json() : c'est le seul moyen
        // de connaître la taille reçue quand content-length manque, ce qui
        // est le cas sous compression.
        const t=await r.text();
        try{ _quotaCompter('in',t.length); }catch(e){}
        const d=t?JSON.parse(t):null;
        if(avecEtag) return {doc:d||null,etag:(r.headers&&r.headers.get('ETag'))||null};
        if(d) return d;
      }
    }catch{ this._lectures[email]='réseau'; }
    return avecEtag?{doc:null,etag:null}:null;
  },
  // ── Profil coach visible par ses athlètes ────────────────────────────────
  // La règle de /users ne va que dans un sens : un coach lit ses athlètes,
  // l'athlète NE PEUT PAS lire son coach. Le code tentait pourtant
  // syncUser(coachEmail) depuis l'athlète, requête refusée en silence : sur le
  // téléphone du coach tout s'affichait (son dossier est en local), sur celui
  // de l'athlète ni la photo, ni la team, ni les bannières n'arrivaient jamais.
  //
  // On ne relâche pas la règle de /users pour autant : elle donnerait à chaque
  // athlète l'accès aux séances, bilans, nutrition et liste de clients du
  // coach. On publie à la place un nœud séparé qui ne contient QUE ce qui est
  // destiné à être vu, lisible par les seuls athlètes rattachés.
  // chargesSchema : la grille de charges articulaires du coach. Elle doit
  // atteindre le téléphone de l'athlète, sinon aucun avertissement de santé
  // ne peut se déclencher de son côté. C'est un jugement de métier publié
  // volontairement, au même titre que la photo ou la bannière.
  // 'phone' RESTE pour les dossiers non migrés : le retirer casserait un test
  // existant et priverait d'un repli les profils déjà publiés. Il ne devient
  // plus jamais un lien sans 'contact.consentAt' — c'est contactNumero qui
  // décide, pas la présence du champ.
  // canalDernier et canalEpingle DOIVENT figurer ici. pushProfilCoach fait un
  // PUT du profil ENTIER reconstruit depuis cette seule liste : un champ ecrit
  // separement dans coach_public serait efface a la prochaine sauvegarde de
  // profil, sans erreur ni trace. La banniere epinglee aurait disparu le jour
  // ou le coach change sa photo.
  CHAMPS_PROFIL_COACH:['fname','lname','teamName','catchphrase','coachPhoto',
    // Vitrine : ce que l'athlete lit en touchant la carte de son coach.
    // 'logo' EST PUBLIE COMME LA SIGNATURE, et pour la meme raison : il ne
    // sert a rien sur l'appareil du coach. Il est lu chez l'ATHLETE, par
    // l'image de seance qu'il telecharge — donc il doit passer par
    // coach_public, seul noeud du coach que l'athlete a le droit de lire.
    // Oublier ce mot ici ne casserait rien de visible : le logo resterait en
    // local, et l'image sortirait sans lui, sans un mot.
    // vitrineProgrammes : les programmes que le coach met en vente, reduits a
    // ce qu'il faut pour dessiner une carte. Ce champ est DERIVE de
    // coachPrograms et recalcule par pushProfilCoach juste avant l'envoi —
    // l'oublier ici ne casserait rien de visible : la vitrine resterait vide
    // chez l'athlete, sans un mot, exactement comme le logo avant lui.
    'bio','vision','photoVitrine','signature','logo','cartePro','diplomes','promoBanners','vitrineProgrammes','phone','chargesSchema','contact','canalDernier','canalEpingle','dispo'],
  // ── Santé privée : ce que le coach ne voit pas, et qui survit quand même ──
  // La règle de /users donne au coach un accès LECTURE ET ÉCRITURE sur le
  // dossier entier de ses athlètes, sans granularité. Les blocs non partagés
  // étaient donc SUPPRIMÉS avant l'envoi, faute de mieux — et chaque lot
  // concerné portait la même contrepartie en commentaire : « non partagée,
  // elle ne survit pas à un changement d'appareil ».
  //
  // Ce nœud-ci la répare. Même confidentialité, mais sauvegardée : les règles
  // n'y mentionnent pas coachEmailKey, donc le coach ne peut ni le lire, ni y
  // écrire, ni savoir qu'il existe.
  //
  // ON NE DÉPLACE AUCUN CHAMP. Les blocs restent là où huit lots livrés les
  // ont mis ; ce qui change, c'est leur DESTINATION à l'envoi. Une couche
  // de lecture, pas une migration.
  _urlSantePrivee(key){ return this._fbUrl.replace('users.json','sante_privee/'+key+'.json'); },
  // ══ LA BOITE DU COACH (30/09/2026) ═════════════════════════════════════
  // /boite_coach/<coachKey>/<athleteKey> = updatedAt du dossier que l'athlete
  // vient d'ecrire. Le coach ecoute SA boite par UN flux (BOITE_COACH) au lieu
  // d'attendre la releve de cinq minutes : une seance terminee lui arrive en
  // quelques secondes, pour une connexion par coach et non par athlete.
  //
  // APRES LE PUT DU DOSSIER, et seulement de l'appareil de l'athlete : la regle
  // verifie que users/<athleteKey>/coachEmailKey designe bien ce coach, et ce
  // champ doit donc deja etre au serveur. Le coach qui pousse le dossier d'un
  // athlete ne se previent pas lui-meme.
  //
  // NON BLOQUANT, ERREURS AVALEES : la boite n'est qu'un signal. S'il se perd,
  // la releve de cinq minutes rattrape — le dossier, lui, est deja parti.
  _urlBoiteCoach(coachKey,cle){ return this._fbUrl.replace('users.json','boite_coach/'+coachKey+(cle?'/'+cle:'')+'.json'); },
  _signalerCoach(email,safe,safeKey,token){
    try{
      if(typeof currentUser!=='object'||!currentUser||currentUser.email!==email) return false;
      const ck=safe&&safe.coachEmailKey, maj=Number(safe&&safe.updatedAt)||0;
      if(!ck||!maj||!token||!safeKey) return false;
      const o={method:'PUT',headers:{'Content-Type':'application/json'},body:String(maj)};
      if(document.hidden) o.keepalive=true;
      Promise.resolve().then(()=>fetch(this._urlBoiteCoach(ck,safeKey)+'?auth='+token,o)).catch(()=>{});
      return true;
    }catch(e){ return false; }
  },
  // Les souscriptions Web Push : /push/<emailKey>/<id>. Hors de /users, que
  // le PUT du dossier entier effacerait (voir pushAbonner).
  _urlPush(key,id){ return this._fbUrl.replace('users.json','push/'+key+'/'+id+'.json'); },
  async enregistrerPush(email,id,data){
    const key=String(email||'').replace(/\./g,',');
    if(!key||!/^[a-z0-9]{6,24}$/.test(id)) return false;
    try{
      const token=await this._getToken();
      if(!token) return false;
      const r=await fetch(this._urlPush(key,id)+'?auth='+token,{method:'PUT',
        headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
      return r.ok;
    }catch(e){ return false; }
  },
  async supprimerPush(email,id){
    const key=String(email||'').replace(/\./g,',');
    if(!key||!/^[a-z0-9]{6,24}$/.test(id)) return false;
    try{
      const token=await this._getToken();
      if(!token) return false;
      return (await fetch(this._urlPush(key,id)+'?auth='+token,{method:'DELETE'})).ok;
    }catch(e){ return false; }
  },
  _urlProfilCoach(key){ return this._fbUrl.replace('users.json','coach_public/'+key+'.json'); },
  _urlBoutique(id){ return this._fbUrl.replace('users.json',
    'boutique'+(id?('/'+encodeURIComponent(id)):'')+'.json'); },
  // ── LA BOUTIQUE PUBLIQUE ──────────────────────────────────────────────
  //
  // TOUT LE MONDE LIT, LE CREATEUR SEUL ECRIT — la regle RTDB le tient, pas
  // l'interface. Ce noeud existe pour UNE raison : le prix qu'un athlete voit
  // doit etre celui que le coach a pose. Sans lui, le prix ne pourrait vivre
  // que dans le code, et le changer demanderait un deploiement.
  async lireBoutique(){
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),8000);
    try{
      const token=await this._getToken();
      if(!token) return null;
      const r=await fetch(this._urlBoutique()+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) return null;
      const t=await r.text();
      try{ _quotaCompter('in',t.length); }catch(e){}
      const d=JSON.parse(t||'null');
      return (d&&typeof d==='object')?d:null;
    }catch(e){ return null; }
  },
  // UN PROGRAMME A LA FOIS, par PUT : ecrire tout le noeud d'un coup
  // effacerait ce qu'un autre appareil vient d'y poser.
  // ⚠ DEUX ECRITURES (01/10/2026) : la FICHE dans boutique/<id> (lue par
  //   tous), les SEANCES dans boutique_contenu/<id> (acheteurs et createur).
  //   Le contenu d'abord : une fiche qui annonce aContenu sans contenu
  //   livrerait un programme vide.
  _urlContenuBoutique(id){ return this._fbUrl.replace('users.json','boutique_contenu/'+encodeURIComponent(id)+'.json'); },
  async ecrireProgrammeBoutique(id,obj){
    if(!id||!obj) return false;
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),12000);
    try{
      const token=await this._getToken();
      if(!token) return false;
      const fiche=Object.assign({},obj); delete fiche.seances;
      if(typeof obj.seances==='string'&&obj.seances){
        const c=JSON.stringify({seances:obj.seances,maj:Number(obj.maj)||Date.now()});
        try{ _quotaCompter('out',c.length); }catch(e){}
        const rc=await fetch(this._urlContenuBoutique(id)+'?auth='+token,{method:'PUT',body:c,signal:ctrl.signal});
        if(!rc.ok) return false;
        fiche.aContenu=true;
        try{ _poserContenuLocal(id,{seances:obj.seances,maj:Number(obj.maj)||Date.now()}); }catch(e){}
      }
      const corps=JSON.stringify(fiche);
      try{ _quotaCompter('out',corps.length); }catch(e){}
      const r=await fetch(this._urlBoutique(id)+'?auth='+token,
        {method:'PUT',body:corps,signal:ctrl.signal});
      return r.ok;
    }catch(e){ return false; }
  },
  // Le contenu d'un programme : {ok:true, contenu|null} quand le serveur a
  // repondu (un 401 = pas achete : contenu null, refuse true), {ok:false} sinon.
  async lireContenuBoutique(id){
    if(!id) return {ok:false};
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),10000);
    try{
      const token=await this._getToken();
      if(!token) return {ok:false};
      const r=await fetch(this._urlContenuBoutique(id)+'?auth='+token,{signal:ctrl.signal});
      if(r.status===401||r.status===403) return {ok:true,contenu:null,refuse:true};
      if(!r.ok) return {ok:false};
      const t=await r.text();
      try{ _quotaCompter('in',t.length); }catch(e){}
      const d=JSON.parse(t||'null');
      return {ok:true,contenu:(d&&typeof d==='object')?d:null};
    }catch(e){ return {ok:false}; }
  },
  // LES SEANCES SEULES, par PATCH. Un modele retouche met a jour ce qu'il
  // livre sans toucher au titre, au prix ni au visuel : un PUT reecrirait la
  // fiche entiere depuis le cache de CET appareil, qui peut dater d'avant un
  // changement de prix fait ailleurs.
  async majSeancesProgrammeBoutique(id,seances){
    if(!id||typeof seances!=='string') return false;
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),12000);
    try{
      const token=await this._getToken();
      if(!token) return false;
      const maj=Date.now();
      const corps=JSON.stringify({seances:seances,maj});
      try{ _quotaCompter('out',corps.length); }catch(e){}
      const rc=await fetch(this._urlContenuBoutique(id)+'?auth='+token,
        {method:'PUT',body:corps,signal:ctrl.signal});
      if(!rc.ok) return false;
      // La fiche suit : sa date dit aux acheteurs de relire le contenu.
      const r=await fetch(this._urlBoutique(id)+'?auth='+token,
        {method:'PATCH',body:JSON.stringify({maj,aContenu:true}),signal:ctrl.signal});
      return r.ok;
    }catch(e){ return false; }
  },
  async supprimerProgrammeBoutique(id){
    if(!id) return false;
    const ctrl=new AbortController(); setTimeout(()=>ctrl.abort(),8000);
    try{
      const token=await this._getToken();
      if(!token) return false;
      const r=await fetch(this._urlBoutique(id)+'?auth='+token,
        {method:'DELETE',signal:ctrl.signal});
      // Le contenu part avec la fiche.
      try{ await fetch(this._urlContenuBoutique(id)+'?auth='+token,{method:'DELETE',signal:ctrl.signal}); }catch(e){}
      try{ _poserContenuLocal(id,null); }catch(e){}
      return r.ok;
    }catch(e){ return false; }
  },

  // ── La file du PROFIL PUBLIC ──────────────────────────────────────────
  // DISTINCTE de rc_sync_queue, et ce n’est pas un détail : une clé posée
  // dans la file existante ferait renvoyer le DOSSIER du coach par
  // _doPushOne, vers /users. La vitrine, elle, vit dans coach_public. Deux
  // destinations, deux files.
  //
  // UNE seule valeur et non une liste : il n’y a qu’un coach connecté par
  // appareil. Une liste laisserait croire le contraire.
  _QUEUE_PROFIL:'rc_sync_queue_profil',
  _fileProfil(){ try{ return localStorage.getItem(this._QUEUE_PROFIL)||''; }catch(e){ return ''; } },
  _enfilerProfil(email){ try{ if(email) localStorage.setItem(this._QUEUE_PROFIL,email); }catch(e){} },
  _defilerProfil(){ try{ localStorage.removeItem(this._QUEUE_PROFIL); }catch(e){} },

  // LÈVE au lieu de rendre false, comme _canalPut et alimentsCoachPut.
  //
  // Elle rendait false sans un mot — jeton manquant, réseau coupé, Firebase
  // qui refuse — et ses appelants annonçaient « ✓ » sur la foi du seul
  // enregistrement LOCAL. Le coach lisait « Photo enregistrée ✓ » pendant que
  // ses athlètes continuaient de voir l’ancienne. Même faute que _doPushOne
  // avant son audit, et toastSync a besoin d’un REJET pour dire autre chose.
  //
  // Chaque échec ENFILE : le profil repartira au retour du réseau, sans que
  // le coach ait à rouvrir l’écran où il a saisi.
  // La vitrine telle qu'elle est EN LIGNE. Rend null si elle est injoignable —
  // et pushProfilCoach repart alors de la memoire seule, comme avant : mieux
  // vaut republier ce qu'on sait que ne rien republier du tout.
  //
  // ⚠ ELLE NE S'APPELLE PAS pullProfilCoach, ET C'EST DELIBERE. Ce nom EXISTE
  // DEJA sur cet objet, 130 lignes plus bas : il prend une CLEF (adresse a
  // virgules) la ou celle-ci prend une adresse, et il MET EN CACHE le resultat
  // dans rc_coach_profil — un cache destine a l'appareil de l'ATHLETE, qui
  // reecrirait ici toute la vitrine du coach dans un stockage local deja
  // sature. Deux clefs du meme nom dans un objet litteral : la derniere gagne,
  // sans erreur, sans avertissement. La premiere version de ce correctif a
  // vecu ainsi, sans jamais s'appliquer.
  async _lireVitrineDistante(email){
    if(!email) return null;
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return null;
      const r=await fetch(this._urlProfilCoach(email.replace(/\./g,','))+'?auth='+token,
        {signal:ctrl.signal});
      if(!r.ok) return null;
      const t=await r.text();
      try{ _quotaCompter('in',t.length); }catch(e){}
      return t?JSON.parse(t):null;
    }catch(e){ return null; }
  },
  async pushProfilCoach(user){
    const u=user||currentUser;
    if(!u||u.role!=='coach'||!u.email) throw new Error('Profil public : aucun coach à publier.');
    // ⚠ LA VITRINE DES PROGRAMMES SE RECALCULE ICI, ET NULLE PART AILLEURS.
    // C'est un champ DERIVE de coachPrograms : le poser a la main sur chacun
    // des chemins qui publient — enregistrer une fiche, renommer un modele,
    // supprimer un programme, la file de reprise — aurait garanti qu'un de ces
    // chemins finirait par envoyer une liste perimee. Calcule au dernier
    // instant, il ne peut pas etre en retard.
    //
    // UN TABLEAU VIDE EST UNE VALEUR, PAS UNE ABSENCE : il EFFACE la vitrine
    // quand le coach retire son dernier programme. C'est pour cela qu'on
    // l'ecrit toujours, meme vide, plutot que de sauter le champ.
    try{ u.vitrineProgrammes=vitrineProgrammesDe(u); }catch(e){}
    const token=await this._getToken();
    if(!token){
      this._enfilerProfil(u.email);
      throw new Error('Non connecté : le profil public n\'a pas été publié.');
    }
    // ⚠ CE PUT RECONSTRUISAIT LE PROFIL ENTIER DEPUIS LA SEULE MEMOIRE, et
    // c'est la seconde cause de disparition — la plus silencieuse des deux.
    //
    // `coach_public` est remplace en bloc a CHAQUE sauvegarde : identite,
    // disponibilite, telephone, contact, banniere. Tout champ absent de
    // `currentUser` a cet instant precis disparaissait donc de la vitrine, sans
    // erreur ni trace. Une seule sauvegarde de la disponibilite, faite depuis
    // un appareil dont le dossier en memoire ne portait pas encore la photo,
    // effacait la photo, la signature, la carte pro et les diplomes pour TOUS
    // les athletes.
    //
    // ON REPART DONC DU PROFIL DISTANT, et on n'y superpose que ce que cet
    // appareil CONNAIT. La distinction est celle de la fusion des dossiers, et
    // elle est exactement la bonne ici :
    //   · undefined  → cet appareil ne sait pas. On garde ce qui est en ligne.
    //   · ''         → un effacement VOLONTAIRE (le bouton ✕ de la vitrine).
    //                  Il doit passer, sinon plus rien ne s'efface jamais.
    const distant=await this._lireVitrineDistante(u.email);
    const profil={};
    if(distant&&typeof distant==='object')
      for(const c of this.CHAMPS_PROFIL_COACH)
        if(distant[c]!==undefined&&distant[c]!==null) profil[c]=distant[c];
    for(const c of this.CHAMPS_PROFIL_COACH) if(u[c]!==undefined&&u[c]!==null) profil[c]=u[c];
    profil.maj=Date.now();
    let r;
    try{
      r=await fetch(this._urlProfilCoach(u.email.replace(/\./g,','))+'?auth='+token,
        {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(profil)});
    }catch(e){
      this._enfilerProfil(u.email);
      throw new Error('Réseau : le profil public n\'a pas été publié.');
    }
    if(!r.ok){
      this._enfilerProfil(u.email);
      throw new Error('Publication du profil refusée ('+r.status+').');
    }
    this._defilerProfil();
    // LA VITRINE PUBLIQUE (/coach/<slug>) suit le profil, sans le retenir.
    try{ publierVitrinePublique(u).catch(()=>{}); }catch(e){}
    return true;
  },

  // ══════ L'ANNUAIRE D'UN COACH ══════════════════════════════════════════
  // Signalé par Kevin le 25/08/2026 : son second élève existe, mais sur son
  // TÉLÉPHONE — l'ordinateur d'où il regarde son tableau de bord ne l'avait
  // jamais vu.
  //
  // LE COACH NE POUVAIT DÉCOUVRIR PERSONNE. syncRelevantUsers ne rafraîchit que
  // les athlètes DÉJÀ présents dans le stockage de l'appareil, et
  // _rafraichirCodesEleves ne connaît que les invitations émises par lien.
  // Un élève inscrit sur son propre téléphone n'entrait donc dans aucun des
  // deux, et n'existait nulle part côté coach.
  //
  // ET LA CHERCHER CÔTÉ SERVEUR EST IMPOSSIBLE, DÉLIBÉRÉMENT. Les règles
  // n'accordent la lecture que de /users/<clef> précise, jamais de /users :
  // une requête `orderBy=coachEmailKey` exigerait un .read sur la collection
  // entière, c'est-à-dire l'ouvrir à tous les comptes authentifiés. Le coach
  // peut lire le dossier de SES athlètes, mais il faut qu'il connaisse leur
  // adresse — et c'est exactement ce qui manquait.
  //
  // D'où ce petit annuaire. C'EST L'ATHLÈTE QUI S'Y INSCRIT, pas le coach qui
  // l'y ajoute : les règles n'acceptent l'écriture que du titulaire de
  // l'adresse, et seulement si son propre dossier désigne déjà ce coach. Un
  // coach ne peut pas s'y déclarer les élèves d'un autre. Même patron que
  // canaux/$coachKey/reactions, dont il reprend la forme mot pour mot.
  //
  // DEUX CHAMPS, ET RIEN D'AUTRE : l'adresse et une date. Le nom, l'âge, les
  // bilans vivent dans le dossier que le coach ira chercher ensuite ; les
  // recopier ici les mettrait à un second endroit sans rien apporter.
  _urlAnnuaire(coachKey,athleteKey){
    return this._fbUrl.replace('users.json','annuaire_coach/'+coachKey
      +(athleteKey?'/'+athleteKey:'')+'.json');
  },
  // Côté athlète. Idempotent et minuscule : on le repose à chaque ouverture
  // plutôt que de tenir un drapeau qui finirait par mentir après un changement
  // de coach. Ne lève jamais — c'est du confort pour le coach, pas une étape
  // du parcours de l'athlète.
  async pushAnnuaire(user){
    try{
      const u=user||currentUser;
      if(!u||!u.email||u.role==='coach') return false;
      const ck=cleCoachDe(u);
      if(!ck) return false;
      const token=await this._getToken();
      if(!token) return false;
      const r=await fetch(this._urlAnnuaire(ck,u.email.replace(/\./g,','))+'?auth='+token,
        {method:'PUT',headers:{'Content-Type':'application/json'},
         body:JSON.stringify({email:u.email,maj:Date.now()})});
      return !!(r&&r.ok);
    }catch(e){ return false; }
  },
  // ── À QUI APPARTIENT repcore/<id>/… CHEZ CLOUDINARY (27/09/2026) ─────────
  // Le serveur léger ne supprime un média que pour le compte que
  // /medias_proprio/<id> désigne, ou pour son coach. Ce compte l'écrit LUI-MÊME,
  // une seule fois : la règle refuse toute réécriture et toute autre valeur que
  // sa propre clé. À la création du compte, et au démarrage pour ceux d'avant.
  //
  // Un refus (401) veut dire « déjà posé » : on ne le retente pas à chaque
  // ouverture. Si c'était l'œuvre d'un autre compte, c'est le serveur qui le
  // verra (deux dossiers portant le même id), pas l'app.
  async poserProprioMedias(user){
    try{
      const u=user||currentUser;
      if(!u||!u.email||!u.id) return false;
      const id=String(u.id);
      if(!/^[A-Za-z0-9_-]{1,39}$/.test(id)) return false;
      const drapeau='rc_medias_proprio_'+u.email;
      try{ if(localStorage.getItem(drapeau)===id) return true; }catch(e){}
      const token=await this._getToken();
      if(!token) return false;
      const r=await fetch(this._fbUrl.replace('users.json','medias_proprio/'+id+'.json')+'?auth='+token,
        {method:'PUT',headers:{'Content-Type':'application/json'},
         body:JSON.stringify(String(u.email).toLowerCase().replace(/\./g,','))});
      if(r&&(r.ok||r.status===401||r.status===403)){
        try{ localStorage.setItem(drapeau,id); }catch(e){}
      }
      return !!(r&&r.ok);
    }catch(e){ return false; }
  },
  // ── LES ATHLÈTES QUE CE COACH RECONNAÎT ────────────────────────────────
  // coachEmailKey est écrit par l'athlète, qui peut y mettre n'importe qui :
  // le serveur léger exige AUSSI que le coach l'ait inscrit ici avant de le
  // laisser supprimer un média de cet athlète. La règle n'accepte l'entrée que
  // si le dossier de l'athlète désigne déjà ce coach. Une fois par session.
  async inscrireClientCoach(athleteEmail,oui){
    try{
      const u=currentUser;
      if(!u||u.role!=='coach'||!u.email||!athleteEmail) return false;
      const ck=String(u.email).toLowerCase().replace(/\./g,',');
      const ak=String(athleteEmail).toLowerCase().replace(/\./g,',');
      this._clientsInscrits=this._clientsInscrits||{};
      const vu=ak+(oui===false?':non':':oui');
      if(this._clientsInscrits[vu]) return true;
      const token=await this._getToken();
      if(!token) return false;
      const r=await fetch(this._fbUrl.replace('users.json','coachs/'+ck+'/clients/'+ak+'.json')+'?auth='+token,
        {method:oui===false?'DELETE':'PUT',headers:{'Content-Type':'application/json'},
         body:oui===false?undefined:'true'});
      if(r&&r.ok){ this._clientsInscrits[vu]=true; delete this._clientsInscrits[ak+(oui===false?':oui':':non')]; }
      return !!(r&&r.ok);
    }catch(e){ return false; }
  },
  // Côté coach. Rend les adresses inscrites, ou [] — jamais null : l'appelant
  // boucle dessus, et distinguer « aucun élève » de « lecture en échec » n'y
  // changerait rien.
  async pullAnnuaire(user){
    try{
      const u=user||currentUser;
      if(!u||u.role!=='coach'||!u.email) return [];
      const token=await this._getToken();
      if(!token) return [];
      const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),8000);
      const r=await fetch(this._urlAnnuaire(u.email.replace(/\./g,','))+'?auth='+token,
        {signal:ctrl.signal});
      if(!r.ok) return [];
      const t=await r.text();
      try{ _quotaCompter('in',t.length); }catch(e){}
      const d=t?JSON.parse(t):null;
      if(!d||typeof d!=='object') return [];
      return _annuaireAdresses(d);
    }catch(e){ return []; }
  },
  async pullProfilCoach(key){
    if(!key) return null;
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      if(!token) return null;
      const r=await fetch(this._urlProfilCoach(key)+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) return null;
      const d=await r.json();
      if(!d) return null;
      // MEME PIEGE, AUTRE NOEUD. `diplomes`, `promoBanners` et
      // `vitrineProgrammes` sont des listes dans coach_public, et Firebase les
      // rend en objet des qu'un rang manque — un diplome retire du milieu
      // suffit. Leurs lecteurs font `.filter` et `.forEach` : la vitrine
      // tombait. Et trois autres lisent `.length`, qui vaut `undefined` sur un
      // objet : la vitrine se croyait vide et ne s'affichait pas, sans erreur
      // ni trace.
      try{ _aplatirChamp(d,'diplomes'); _aplatirChamp(d,'promoBanners');
           _aplatirChamp(d,'vitrineProgrammes'); }catch(e){}
      // Rangé HORS de currentUser : la photo du coach est en base64 et les
      // bannières peuvent être lourdes. Dans le dossier de l'athlète, elles
      // repartiraient vers Firebase à chaque synchronisation, dupliquées
      // autant de fois qu'il y a d'athlètes.
      try{ localStorage.setItem('rc_coach_profil',JSON.stringify({key,d})); }catch(e){}
      return d;
    }catch(e){ return null; }
  },
  // ── Canal du coach ────────────────────────────────────────────────────────
  // Un noeud A PART de coach_public, et c'est tout l'intérêt : coach_public est
  // retéléchargé EN ENTIER à chaque ouverture de l'accueil athlète, pour la
  // photo et la phrase du coach. Le fil, lui, ne descend que quand l'onglet
  // s'ouvre. Le plafond du plan Spark est un volume mensuel — c'est cette
  // différence-là qui décide s'il est franchi.
  //
  // Trois sous-noeuds, trois portées de lecture différentes, imposées par les
  // règles : messages et compteurs sont lus par le groupe, reactions ne l'est
  // que par son auteur et par le coach. Il n'y a donc AUCUN appel qui tire le
  // canal entier — il n'existe pas de .read sur /canaux/{coach}.
  _urlCanal(key,sous){ return this._fbUrl.replace('users.json','canaux/'+key+'/'+sous+'.json'); },

  // ── Les aliments du coach ────────────────────────────────────────────
  // MEME RAISON QUE LE CANAL de ne pas vivre dans coach_public : ce dernier
  // est retelecharge EN ENTIER a chaque ouverture de l accueil athlete. Ici,
  // rien ne descend tant que la recherche d aliments n est pas ouverte.
  _urlAlimentsCoach(key){ return this._fbUrl.replace('users.json','aliments_coach/'+key+'.json'); },

  // LEVE quand la requete echoue, et ne rend null QUE si le noeud est vide.
  // Meme faute a ne pas refaire que _canalGet : avaler l erreur confondrait
  // « ton coach n a rien saisi » et « je n ai pas pu demander ».
  async alimentsCoachGet(key){
    if(!key) throw new Error('Aucun coach rattaché.');
    const ctrl=new AbortController();
    const minuteur=setTimeout(()=>ctrl.abort(),8000);
    try{
      const token=await this._getToken();
      if(!token) throw new Error('Session expirée.');
      const r=await fetch(this._urlAlimentsCoach(key)+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) throw new Error('Aliments du coach : '+r.status);
      return await r.json();
    } finally { clearTimeout(minuteur); }
  },

  // Ecriture par le coach, sur SA propre cle. LEVE au lieu de rendre false :
  // une publication qui echoue en silence ferait croire au coach que ses
  // athletes voient ses aliments.
  async alimentsCoachPut(key,liste){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté : les aliments n\'ont pas pu être publiés.');
    const r=await fetch(this._urlAlimentsCoach(key)+'?auth='+token,
      {method:'PUT',headers:{'Content-Type':'application/json'},
       body:JSON.stringify(liste&&liste.length?liste:null)});
    if(!r.ok) throw new Error('Publication refusée ('+r.status+').');
    return true;
  },

  // LÈVE quand la requête échoue, et ne rend null QUE si Firebase a répondu
  // « ce nœud est vide ». Avaler l'erreur confondait « ton coach n'a rien
  // publié » et « je n'ai pas pu demander » : l'athlète hors ligne lisait
  // « Rien pour le moment », et c'est le coach qui en portait le blâme. Même
  // faute que _doPushOne, qui affichait « ✓ sauvegardé » sans rien envoyer.
  async _canalGet(key,sous){
    if(!key) throw new Error('Canal introuvable.');
    const ctrl=new AbortController();
    const minuteur=setTimeout(()=>ctrl.abort(),8000);
    try{
      const token=await this._getToken();
      if(!token) throw new Error('Session expirée.');
      const r=await fetch(this._urlCanal(key,sous)+'?auth='+token,{signal:ctrl.signal});
      if(!r.ok) throw new Error('Canal : '+r.status);
      return await r.json();
    } finally { clearTimeout(minuteur); }
  },

  // LÈVE au lieu de renvoyer false. Les écritures du coach passent par
  // toastSync, qui a besoin d'une promesse REJETÉE pour dire « pas enregistré » :
  // _doPushOne a déjà coûté un audit entier pour avoir résolu en silence quand
  // rien ne partait, et affiché « ✓ sauvegardé » trente fois pour rien.
  async _canalPut(key,sous,valeur,methode){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté : le canal n\'a pas pu être écrit.');
    const r=await fetch(this._urlCanal(key,sous)+'?auth='+token,{
      method:methode||'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(valeur)});
    if(!r.ok){
      let msg=''+r.status;
      try{const d=await r.json();msg=d.error||msg;}catch(e){}
      throw new Error('Canal : '+msg);
    }
    return true;
  },

  pullCanalMessages(key){ return this._canalGet(key,'messages'); },
  // Les défis seuls, par l'index 'type' (règles : .indexOn) — l'accueil ne
  // tire pas tout le fil pour un rappel.
  async pullDefisCanal(key){
    const token=await this._getToken();
    if(!token) throw new Error('Session expirée.');
    const r=await fetch(this._urlCanal(key,'messages')+'?auth='+token+'&orderBy=%22type%22&equalTo=%22defi%22');
    if(!r.ok) throw new Error('Défis : '+r.status);
    return await r.json();
  },
  // Une écriture MULTI-CHEMINS à la racine ({'a/b':v, 'c/d':null}) : une
  // réservation et sa page partent ensemble, et les règles les jugent
  // ensemble. true ou false, sans lever.
  async racinePatch(chemins){
    const token=await this._getToken();
    if(!token) return false;
    const r=await fetch(this._fbUrl.replace('users.json','.json')+'?auth='+token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(chemins)});
    return r.ok;
  },
  // Comme racinePatch, mais rend le statut HTTP (0 : pas de jeton, pas de
  // réseau) : un refus des règles (401/403) ne se confond plus avec une
  // requête mal formée (400) ni avec une session tombée.
  async racinePatchStatut(chemins){
    const token=await this._getToken().catch(()=>null);
    if(!token) return 0;
    try{
      const r=await fetch(this._fbUrl.replace('users.json','.json')+'?auth='+token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(chemins)});
      return r.status;
    }catch(e){ return 0; }
  },
  // ── Le parrainage : /parrainage/<sous>. get rend null sur un refus (les
  // règles cachent /codes) ; put/patch rendent true ou false, sans lever.
  _urlParrainage(sous){ return this._fbUrl.replace('users.json','parrainage'+(sous?'/'+sous:'')+'.json'); },
  async parrainageGet(sous){
    const token=await this._getToken();
    if(!token) return null;
    const r=await fetch(this._urlParrainage(sous)+'?auth='+token);
    if(!r.ok) return null;
    return await r.json();
  },
  async parrainagePut(sous,valeur){
    const token=await this._getToken();
    if(!token) return false;
    const r=await fetch(this._urlParrainage(sous)+'?auth='+token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(valeur)});
    return r.ok;
  },
  async parrainagePatch(chemins){
    const token=await this._getToken();
    if(!token) return false;
    const r=await fetch(this._urlParrainage('')+'?auth='+token,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(chemins)});
    return r.ok;
  },
  // L'attribution (administrateur) : un nœud, à partir d'un jour.
  async attribLire(noeud,depuis){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté.');
    const r=await fetch(this._fbUrl.replace('users.json','attribution/'+noeud+'.json')+'?auth='+token
      +'&orderBy=%22%24key%22&startAt=%22'+encodeURIComponent(depuis)+'%22');
    if(!r.ok) throw new Error('Attribution : '+r.status);
    return await r.json();
  },
  // ── Les ambassadeurs ──
  async ambPublicGet(code){
    const r=await fetch(this._fbUrl.replace('users.json','ambassadeurs_publics/'+encodeURIComponent(code)+'.json'));
    return r.ok?await r.json():null;
  },
  async ambDemande(moi,d){
    const token=await this._getToken();
    if(!token) return false;
    const r=await fetch(this._fbUrl.replace('users.json','ambassadeurs_demandes/'+moi+'.json')+'?auth='+token,
      {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
    return r.ok;
  },
  // Réservé à l'administrateur (règles) : les fiches, statistiques et commissions.
  async ambListe(){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté.');
    const r=await fetch(this._fbUrl.replace('users.json','ambassadeurs.json')+'?auth='+token);
    if(!r.ok) throw new Error('Ambassadeurs : '+r.status);
    return await r.json();
  },
  // Réservé à l'administrateur (règles) : les cinquante dernières lignes du
  // journal des remboursements, rétrofacturations et litiges PayPal.
  async journalPaypal(){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté.');
    const r=await fetch(this._fbUrl.replace('users.json','paypal_journal.json')+'?auth='+token
      +'&orderBy=%22%24key%22&limitToLast=50');
    if(!r.ok) throw new Error('Journal : '+r.status);
    return (await r.json())||{};
  },
  // UN ÉVÉNEMENT POUR LE SERVEUR LÉGER : /evenements/<id>, écrit une fois
  // (règles : `par` est la clé du compte connecté). true ou false, sans lever.
  // ⚠ AVEC SON VERROU, DANS LA MÊME REQUÊTE : evenements_attente/<par>/<type>/
  //   <cible> = {id, at: heure du serveur}. Les règles refusent l'un sans
  //   l'autre, et un deuxième tant que le premier attend ou date de moins de
  //   30 s. Un refus n'est pas une panne : le serveur a déjà de quoi faire.
  evenementPoser(id,ev){
    return this.racinePatch({['evenements/'+id]:ev,
      ['evenements_attente/'+ev.par+'/'+ev.type+'/'+ev.cible]:{id,at:{'.sv':'timestamp'}}});
  },
  // Réservé à l'administrateur (règles) : ce que le serveur léger a rangé
  // après cinq échecs (événements, sous-tâches, travaux du jour).
  async evenementsKo(){
    const token=await this._getToken();
    if(!token) throw new Error('Non connecté.');
    const r=await fetch(this._fbUrl.replace('users.json','evenements_ko.json')+'?auth='+token
      +'&orderBy=%22%24key%22&limitToLast=50');
    if(!r.ok) throw new Error('Échecs : '+r.status);
    return (await r.json())||{};
  },
  async pullDefisResultats(moi){
    const token=await this._getToken();
    if(!token) throw new Error('Session expirée.');
    const r=await fetch(this._fbUrl.replace('users.json','defis_resultats/'+moi+'.json')+'?auth='+token);
    if(!r.ok) throw new Error('Résultats : '+r.status);
    return await r.json();
  },
  pullCanalCompteurs(key){ return this._canalGet(key,'compteurs'); },
  // Réservé au coach : les règles refusent ce chemin à un athlète.
  pullCanalReactions(key){ return this._canalGet(key,'reactions'); },
  // L'athlète ne lit QUE sa propre feuille — d'où l'indexation par athlète puis
  // par message : une requête rend toutes ses réactions, au lieu d'une par
  // message affiché.
  pullMesReactions(key,athleteKey){ return this._canalGet(key,'reactions/'+athleteKey); },

  ecrireMessageCanal(key,msgId,msg){ return this._canalPut(key,'messages/'+msgId,msg); },
  // PATCH et non PUT : le PUT sur /messages remplacerait tout le fil. Sert à
  // dépingler l'ancien et épingler le nouveau d'une seule écriture.
  patcherMessagesCanal(key,patch){ return this._canalPut(key,'messages',patch,'PATCH'); },
  async supprimerMessageCanal(key,msgId){
    await this._canalPut(key,'messages/'+msgId,null,'DELETE');
    // Les compteurs du message disparaissent avec lui : les laisser ferait
    // grossir un noeud que plus rien ne lit. Cet appel-ci peut échouer sans
    // conséquence visible, le message n'est déjà plus affiché.
    try{ await this._canalPut(key,'compteurs/'+msgId,null,'DELETE'); }catch(e){}
    return true;
  },

  poserReaction(key,athleteKey,msgId,emoji){
    return this._canalPut(key,'reactions/'+athleteKey+'/'+msgId,emoji);
  },
  retirerReaction(key,athleteKey,msgId){
    return this._canalPut(key,'reactions/'+athleteKey+'/'+msgId,null,'DELETE');
  },
  // L'incrément est calculé PAR LE SERVEUR : deux athlètes qui réagissent dans
  // la même seconde s'ajoutent tous les deux. Un lire-puis-écrire côté client
  // en aurait perdu un.
  bougerCompteur(key,msgId,emoji,delta){
    return this._canalPut(key,'compteurs/'+msgId+'/'+encodeURIComponent(emoji),
      {'.sv':{increment:delta}});
  },
  // Réservé au coach : les règles ne bornent son écriture ni à +1 ni à -1,
  // justement pour qu'il puisse réparer un compteur ayant dérivé.
  fixerCompteur(key,msgId,emoji,valeur){
    return this._canalPut(key,'compteurs/'+msgId+'/'+encodeURIComponent(emoji),valeur);
  },

  // Sonde de fraicheur : un entier, pas un dossier. Le dossier complet d'un
  // athlete actif pese plusieurs dizaines de kilo-octets ; son updatedAt en
  // pese une vingtaine. C'est ce rapport qui fait tout le gain.
  async pullUpdatedAt(email){
    const key=email.replace(/\./g,',');
    const base=this._fbUrl.replace('users.json','users/'+key+'/updatedAt.json');
    const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),6000);
    try{
      const token=await this._getToken();
      const r=await fetch(token?base+'?auth='+token:base,{signal:ctrl.signal});
      if(r.ok){const v=await r.json();return typeof v==='number'?v:null;}
    }catch{}
    return null;
  },
  // Renvoie TRUE si quelque chose a change, FALSE sinon. Les appelants s'en
  // servent pour ne pas repeindre un ecran identique.
  // N3.6 — L'HEURE DE LA DERNIERE DESCENTE, PAR ATHLETE.
  // La synchronisation est un SONDAGE : cinq minutes en marche normale, trente
  // en quota degrade. Sur PC l'onglet du coach reste visible, donc le raccourci
  // du retour au premier plan ne se declenche jamais. Le coach publiait un
  // programme, appelait son athlete, et celui-ci ne le voyait pas avant cinq
  // minutes — sans qu'aucun ecran ne dise pourquoi.
  // On ne change PAS la mecanique de fond : ni listener Firebase, ni
  // bibliotheque, ni dependance — le plan Spark et le budget de quota
  // l'interdisent. On rend simplement compte de ce que le sondage a fait, et
  // on offre un geste pour ne pas l'attendre.
  //
  // « Descente » COMPTE AUSSI QUAND RIEN NE CHANGE : verifier et trouver le
  // dossier a jour est une descente reussie. C'est meme le cas ordinaire, et
  // l'afficher comme un echec serait faux.
  _descentes:{},
  _noterDescente(email,change){
    try{
      if(!email) return;
      this._descentes[email]={ts:Date.now(),change:!!change};
    }catch(e){}
  },
  derniereDescente(email){
    try{ return (this._descentes||{})[email]||null; }catch(e){ return null; }
  },
  // `force` : on descend le dossier SANS regarder les horodatages. Reserve a
  // l'ouverture d'une fiche par le coach — c'est le geste qui repare un
  // appareil rendu aveugle par un envoi rate avant le correctif B1.3, et le
  // seul moment ou une lecture de plus se justifie.
  //
  // `_dansLeTour` : appelee depuis un envoi de ce meme dossier, qui tient deja
  // la file.
  async syncUser(email,force,_dansLeTour){
    if(!_dansLeTour) return this._aTonTour(email,()=>this.syncUser(email,force,true));
    const distantAt=await this.pullUpdatedAt(email);
    // ⚠ LE RACCOURCI COMPARE LE SERVEUR A CE QU'ON EN A VU, PAS A SA PROPRE
    //   COPIE. Il comparait l'horodatage distant a l'horodatage LOCAL, et
    //   renoncait a descendre des que le local etait plus recent. Or le local
    //   devient plus recent au moindre geste — une pesee, une serie : mesure
    //   faite au banc, l'athlete qui se pesait apres la modification de son
    //   coach ne la recevait plus JAMAIS.
    //
    //   La bonne question est « le serveur a-t-il change depuis la derniere
    //   version que j'ai integree ? ». La base garde cet horodatage-la.
    //   Sans base, on descend : c'est le prix d'une premiere synchronisation.
    const _b=this._lireBase(email);
    // ET LA COPIE LOCALE EN DERIVE BIEN : une ecriture perimee a pu la ramener
    // a une version anterieure (voir _baseDe). Il faut alors redescendre pour
    // la recoller, meme si le serveur n'a pas bouge.
    const _m=(()=>{ try{ const d=(DB.get('users')||{})[email]; return d?d._syncMaj:undefined; }catch(e){ return undefined; } })();
    if(!force&&distantAt!==null&&_b&&_b.maj===distantAt&&(_m==null||_m===distantAt)){ this._noterDescente(email,false); return false; }
    const cloudUser=await this.pullUser(email);
    if(!cloudUser) return false;
    // LE COACH INSCRIT DANS SA LISTE l'athlète dont le dossier, tel que le
    // serveur le rend, le désigne. C'est ce qui l'autorise à supprimer les
    // médias de cet athlète chez Cloudinary (voir inscrireClientCoach).
    try{
      if(currentUser&&currentUser.role==='coach'&&email!==currentUser.email
         &&String(cloudUser.coachEmailKey||'').toLowerCase()===String(currentUser.email||'').toLowerCase().replace(/\./g,','))
        this.inscrireClientCoach(email).catch(()=>{});
    }catch(e){}
    // ⚠ rc_users EST LU ICI, APRES LES DEUX ALLERS-RETOURS, et non en tete. Il
    //   etait lu avant, puis reecrit EN ENTIER apres : tout ce qui s'etait
    //   ecrit entre-temps disparaissait — un geste du coach, et surtout la
    //   descente d'un autre dossier, puisque syncRelevantUsers les lance
    //   toutes en meme temps. Mesure au banc : le dossier du coach descendait,
    //   puis celui de l'athlete l'effacait. La base, elle, disait « integre »,
    //   et l'appareil ne le redescendait plus jamais. Lu ici, la lecture, la
    //   fusion, l'ecriture et la base tiennent dans le meme instant.
    const local=JSON.parse(localStorage.getItem('rc_users')||'{}');
    const merged=Object.assign({},local);
    // Les cles du dossier AVANT la fusion : celles qu'elle retire ont ete
    // supprimees par l'autre appareil, et currentUser doit les perdre aussi.
    const _clesAvant=Object.keys((local&&local[email])||{});
    // L'empreinte d'avant, seulement si ce dossier est a l'ecran : voir
    // _planifierRepeint.
    const _hAvant=_repeintUtile(email)?syncEmpreintes((local&&local[email])||{})['']:null;
    // LA FUSION PEUT LEVER, ET SON ECHEC NE DOIT PLUS DISPARAITRE. Personne
    // n'attend le resultat de syncUser : une exception y devient un rejet non
    // capture, l'ecriture qui suit n'a pas lieu, et l'utilisateur voit un badge
    // « Synchronise » sur une synchro qui ne s'est jamais faite. C'est la meme
    // lecon que le quota ci-dessous, et elle vaut pour tout ce bloc.
    try{
      this._mergeUser(merged,email,cloudUser);
    }catch(e){
      console.error('[RepCore] fusion du dossier '+email+' :',e);
      this._setSyncStatus(false);
      this._noterDescente(email,false);
      return false;
    }
    // DB.set et non localStorage.setItem : lui seul gere le debordement de
    // quota. L'ecriture brute levait une QuotaExceededError dans une fonction
    // async dont personne n'attend le resultat — donc une unhandled rejection,
    // et une synchro silencieusement perdue.
    // LA LIGNEE : cette copie derive desormais de cette version du serveur.
    if(merged[email]&&typeof merged[email]==='object')
      merged[email]._syncMaj=Number(cloudUser.updatedAt)||0;
    // La base dont derive le dossier EN MEMOIRE, lue avant que _poserBase ne
    // l'avance : sert si l'ecriture locale echoue (voir plus bas).
    const _bCour=(typeof currentUser==='object'&&currentUser&&currentUser.email===email)
      ?(()=>{ try{ return this._baseDe(email,currentUser); }catch(e){ return null; } })():null;
    const _okLocal=DB.set('users',merged);
    // La base devient la version du serveur qu'on vient d'integrer — APRES la
    // fusion, qui avait besoin de l'ancienne.
    this._poserBase(email,cloudUser);
    // ⚠ ET currentUser SUIT, ICI ET PAS CHEZ LES APPELANTS. La boucle de cinq
    //   minutes le faisait deja ; le retour au premier plan, qui appelle la
    //   meme descente, ne le faisait pas — la copie de travail restait
    //   perimee, et le prochain saveUser remettait l'ancienne valeur en place.
    //
    //   ⚠ ET CE QUE L'AUTRE A SUPPRIME DISPARAIT AUSSI. Object.assign n'efface
    //   rien : le coach levait un drapeau — `delete u.drapeauGeneral` —, le
    //   dossier stocke de l'athlete le perdait, mais son ecran le gardait, son
    //   entrainement restait suspendu, et son prochain enregistrement le
    //   renvoyait au serveur. Mesure au banc. On ne retire que les cles que
    //   la fusion vient d'enlever : les champs de travail de currentUser, que
    //   le dossier stocke ne porte pas, ne sont pas touches.
    //
    //   ⚠ QUOTA PLEIN : merged vient d'une copie locale PERIMEE (l'ecriture
    //   d'avant a echoue), et l'y recopier effacerait de currentUser la seance
    //   qui n'existe qu'en memoire. On fusionne alors a trois voies — base,
    //   memoire, serveur — et on ne retire que ce que la fusion retire.
    if(typeof currentUser==='object'&&currentUser&&currentUser.email===email&&merged[email]){
      try{
        const cible=(_okLocal===false)
          ?syncFusion(_bCour?_bCour.h:null,currentUser,merged[email])
          :merged[email];
        Object.assign(currentUser,cible);
        for(const k of _clesAvant) if(!(k in cible)) delete currentUser[k];
        DB.setLocal('session',currentUser); }catch(e){}
    }
    // ET L'ECRAN SUIT, s'il montre ce dossier et que la descente l'a change.
    try{ if(_hAvant!==null&&_hAvant!==syncEmpreintes(merged[email]||{})['']) _planifierRepeint(email); }catch(e){}
    this._noterDescente(email,true);
    return true;
  },
  // Sync ciblée — coach : lui-même + ses athlètes uniquement ; athlète : lui-même + son coach
  async syncRelevantUsers(){
    if(!currentUser) return;
    // ══ LES DROITS DESCENDENT AVEC LE RESTE (build 1425, lot 0) ═══════════════════
    // Meme cycle que les dossiers : au demarrage, au retour au premier plan,
    // et toutes les cinq minutes. Un palier qui change — un abonnement qui
    // s'arrete, un code de coach qui ouvre — se voit donc sans rechargement.
    // ⚠ ON NE BLOQUE PAS LA SYNCHRO DES DOSSIERS SUR CETTE LECTURE : elle
    //   echoue tant que les regles ne sont pas deployees, et les dossiers,
    //   eux, doivent continuer de descendre.
    let _palAvant=null;
    try{ _palAvant=palierDe(currentUser); }catch(e){}
    try{ await rafraichirDroits(currentUser); }catch(e){}
    // LE REGISTRE DES COACHS, au meme rythme : pour un coach, c'est lui qui dit
    // le plan ; pour tout compte, s'il est coach (30/09/2026).
    try{ if(currentUser.role==='coach'||droitsV2Actif()) await rafraichirCoachRegistre(currentUser); }catch(e){}
    try{ if(_palAvant!==null&&palierDe(currentUser)!==_palAvant) _planifierRepeint(currentUser.email); }catch(e){}
    const users=DB.get('users')||{};
    const pulls=[];
    if(currentUser.role==='coach'){
      pulls.push(this.syncUser(currentUser.email));
      // MEME PREDICAT QUE LE TABLEAU DE BORD. Filtrer sur le seul coachId
      // laissait hors synchro les athletes rattaches par coachEmailKey :
      // affiches mais jamais rafraichis, donc figes sur ce qu on avait.
      const athletes=Object.values(users).filter(u=>u.email&&_estMonAthlete(u,currentUser));
      for(const a of athletes) pulls.push(this.syncUser(a.email));
    } else {
      pulls.push(this.syncUser(currentUser.email));
      const coachEmail=Object.keys(users).find(k=>users[k]?.id===currentUser.coachId)
        ||currentUser.coachEmailKey?.replace(/,/g,'.');
      if(coachEmail) pulls.push(this.syncUser(coachEmail));
    }
    // Rend s'il y a eu du nouveau : le retour au premier plan en a besoin pour
    // savoir s'il doit repeindre (voir _descenteAuRetour).
    const _r=await Promise.all(pulls);
    return _r.some(x=>x===true);
  },

  // Upload vidéo vers Firebase Storage
  async uploadVideo(file,userId){
    const token=await this._getToken();
    if(!token) throw new Error('Non authentifié');
    const ts=Date.now();
    const path=`videos/${userId}/${ts}_${file.name}`;
    const bucket=STORAGE_BUCKET;
    return new Promise((resolve,reject)=>{
      const xhr=new XMLHttpRequest();
      xhr.open('POST',`https://firebasestorage.googleapis.com/v0/b/${bucket}/o?uploadType=media&name=${encodeURIComponent(path)}`);
      xhr.setRequestHeader('Authorization','Bearer '+token);
      xhr.setRequestHeader('Content-Type',file.type||'video/mp4');
      xhr.upload.onprogress=e=>{
        if(e.lengthComputable){
          const el=document.getElementById('vid-upload-progress');
          if(el) el.textContent=Math.round(e.loaded/e.total*100)+'%';
        }
      };
      xhr.onload=()=>{
        if(xhr.status===200){
          const d=JSON.parse(xhr.responseText);
          resolve(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(d.name)}?alt=media&token=${d.downloadTokens}`);
        } else {
          reject(new Error('Erreur '+xhr.status+' : '+xhr.responseText));
        }
      };
      xhr.onerror=()=>reject(new Error('Erreur réseau'));
      xhr.send(file);
    });
  },

  // Générer le QR code pour ouvrir l'app sur un autre appareil (sync Firebase auto)
  // QR genere LOCALEMENT depuis ce lot. Il passait par un service tiers qui
  // recevait l'adresse IP de chaque personne ouvrant cette fenetre, pour
  // dessiner des carres noirs. L'encodeur vit dans vendor/qr.js : meme taille,
  // meme niveau de correction M, meme rendu.
  showQR(){
    const url=APP_BASE_URL;
    const modal=document.createElement('div');
    modal.style.cssText='position:fixed;inset:0;background:var(--scrim);z-index:var(--z-modal);display:flex;align-items:center;justify-content:center';
    modal.innerHTML=`<div style="background:#111;border:1px solid #222;border-radius:var(--r-4);padding:28px;text-align:center;max-width:300px;width:90%">
      <div style="font-size:var(--fs-md);font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px">Scanner sur un autre appareil</div>
      <div id="qr-zone" style="width:220px;height:220px;border-radius:var(--r-3);background:#fff;padding:8px;margin:0 auto;display:flex;align-items:center;justify-content:center"></div>
      <p style="font-size:var(--fs-xs);color:#888;margin-top:12px;line-height:1.6">Ouvre l'app RepCore sur ton téléphone, scanne ce QR → sync configurée automatiquement</p>
      <button onclick="this.closest('div').parentElement.remove()" style="margin-top:16px;background:var(--red);border:none;color:var(--text);padding:10px 24px;border-radius:var(--r-2);font-family:Montserrat,sans-serif;font-size:var(--fs-sm);font-weight:700;cursor:pointer">Fermer</button>
    </div>`;
    document.body.appendChild(modal);
    // APRES insertion dans le DOM : un canvas a besoin d'un parent rendu.
    // Et si l'encodeur manque, on donne l'adresse en clair plutot qu'un carre
    // blanc — un QR absent ne doit pas etre un cul-de-sac.
    try{
      const z=modal.querySelector('#qr-zone');
      const cv=(window.RepCoreQR&&RepCoreQR.versCanvas)?RepCoreQR.versCanvas(url,204):null;
      if(z&&cv){ cv.style.width='204px'; cv.style.height='204px'; z.appendChild(cv); }
      else if(z){ z.innerHTML='<div style="font-size:var(--fs-xs);color:var(--text-faint);text-align:center;padding:12px;line-height:1.6">QR indisponible sur cet appareil. Ouvre cette adresse sur l&#39;autre :<br><b style="color:#111;word-break:break-all">'+escapeHtml(url)+'</b></div>'; }
    }catch(e){}
  }
};

