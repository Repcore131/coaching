        // ── LA GRILLE RENDUE EN OBJET PAR FIREBASE ───────────────────────
        // Firebase RTDB ne rend un TABLEAU que si les clefs forment une suite
        // pleine depuis 0. Une case tombée — il supprime toute valeur nulle —
        // et sessions_config revient en objet. Trois lecteurs faisaient alors
        // une méthode de tableau dessus, dont `sc.some` dans
        // _seancesCoachRendre : AVANT go(), dans une fonction async, donc en
        // rejet de promesse non traité. « Gérer le programme » ne faisait
        // rien, sans un mot. Reproduit au navigateur avant correctif.
        //
        // On passe par ouvrirSeancesSansBrouillon, le jumeau SYNCHRONE prévu
        // pour cette suite : c'est le même _seancesCoachRendre, donc la même
        // exception. Que la version async la fasse disparaître en rejet est
        // vérifié à part, sur la forme du code.
        const _ouvrirSeances=cfg=>{
          const _sv=currentUser,_se=_coachEditClient,_sc=_progEditorCtx;
          const _cid=currentClientId,_own=getOwnedClient,_su=window.saveUser;
          const msgs=[]; const _t=toast;
          try{
            toast=m=>msgs.push(String(m)); window.saveUser=()=>true;
            currentUser={id:'c1',email:'c@t',role:'coach',fname:'K',exAlias:{},
              exMuscles:{},programs:{},sessions:[],bilans:[],nutrition:{},coachPrograms:[]};
            currentClientId='B';
            getOwnedClient=()=>({id:'B',email:'b@t',role:'athlete',fname:'BOB',
              gender:'H',sessions_config:cfg});
            go('s-coach-home');
            let leve=null;
            try{ ouvrirSeancesSansBrouillon(); }catch(e){ leve=e.message; }
            return {leve, ecran:(document.querySelector('.screen.active')||{}).id,
              msgs, cfg:_coachEditClient&&_coachEditClient.sessions_config};
          } finally { toast=_t; getOwnedClient=_own; currentUser=_sv;
            _coachEditClient=_se; _progEditorCtx=_sc; currentClientId=_cid;
            window.saveUser=_su; }
        };
        ok('Une grille rendue en OBJET par Firebase ouvre quand même l\'écran',(()=>{
          const r=_ouvrirSeances({0:{day:'Lundi',name:'LUN',active:true,
            exercises:[{name:'X',reps:'10'}]}});
          if(r.leve) return _echec('exception : '+r.leve);
          if(r.ecran!=='s-coach-sessions') return _echec('écran = '+r.ecran);
          return Array.isArray(r.cfg)?true:_echec('la grille n\'est pas devenue un tableau');})());
        ok('Une grille en objet à clefs NON CONTIGUËS ouvre aussi',(()=>{
          const r=_ouvrirSeances({0:{day:'Lundi',name:'LUN',active:true,exercises:[]},
                                  3:{day:'Jeudi',name:'JEU',active:true,exercises:[]}});
          if(r.leve) return _echec('exception : '+r.leve);
          return r.ecran==='s-coach-sessions'?true:_echec('écran = '+r.ecran);})());
        ok('openCoachSessions, qui est async, ne perd plus la panne en rejet',(()=>{
          // Une exception dans une fonction async ne remonte pas au clic : elle
          // part en rejet non traité, et l'utilisateur ne voit RIEN. Le try qui
          // entoure _seancesCoachRendre est ce qui ferme ce trou-là.
          const src=String(openCoachSessions);
          if(!/try\s*\{\s*_seancesCoachRendre\(\)/.test(src))
            return _echec('_seancesCoachRendre n\'est plus sous try');
          return /catch\s*\(\s*e\s*\)/.test(src)
            ?true:_echec('aucun catch pour le dire');})());
        ok('Les clefs numériques gardent leur RANG : {0,3} rend lundi et jeudi',(()=>{
          const u={sessions_config:{0:{day:'Lundi',name:'LUN',active:true,exercises:[]},
                                    3:{day:'Jeudi',name:'JEU',active:true,exercises:[]}}};
          const t=_normaliserSessionsConfig(u);
          if(!Array.isArray(t)) return _echec('ce n\'est pas un tableau');
          if(t.length!==7) return _echec('longueur '+t.length);
          if(t[0].name!=='LUN') return _echec('créneau 0 = '+JSON.stringify(t[0].name));
          if(t[3].name!=='JEU') return _echec('créneau 3 = '+JSON.stringify(t[3].name));
          // Tasser les trous décalerait tout le programme d'un jour.
          if(t[1].active||t[2].active) return _echec('les trous ont été tassés');
          return true;})());
        ok('_normaliserSessionsConfig ne touche pas une grille déjà saine',(()=>{
          const u={sessions_config:DAYS.map(day=>({day,name:'',photo:null,
            exercises:[],active:false,notes:'',warmup:''}))};
          const avant=JSON.stringify(u.sessions_config);
          _normaliserSessionsConfig(u);
          return JSON.stringify(u.sessions_config)===avant
            ?true:_echec('la grille a été réécrite');})());
        ok('La grille de l\'athlète PRÉCÉDENT ne reste jamais à l\'écran',(()=>{
          const _sv=currentUser,_se=_coachEditClient,_su=window.saveUser;
          try{
            window.saveUser=()=>true;
            currentUser={id:'c1',email:'c@t',role:'coach',fname:'K',exAlias:{},
              exMuscles:{},programs:{},sessions:[],bilans:[],nutrition:{},coachPrograms:[]};
            _coachEditClient={id:'A',fname:'ALICE',sessions_config:[
              {day:'Lundi',name:'A-LUNDI',active:true,exercises:[{name:'X',reps:'10'}]},
              {day:'Mardi',name:'A-MARDI',active:true,exercises:[{name:'Y',reps:'10'}]}]};
            go('s-coach-sessions'); loadCoachSessionSlots();
            const boite=()=>document.getElementById('coach-session-slots');
            if(!/A-LUNDI/.test(boite().innerHTML)) return _echec('ALICE ne s\'est pas affichée');
            // 1. Grille en objet : elle ne doit plus lever, ni laisser ALICE.
            _coachEditClient={id:'B',fname:'BOB',sessions_config:
              {0:{day:'Lundi',name:'B-LUNDI',active:true,exercises:[]}}};
            loadCoachSessionSlots();
            if(/A-LUNDI|A-MARDI/.test(boite().innerHTML))
              return _echec('les séances d\'ALICE sont encore là');
            if(!/B-LUNDI/.test(boite().innerHTML)) return _echec('BOB ne s\'affiche pas');
            // 2. Athlète SANS grille du tout : on vide, on ne laisse pas BOB.
            _coachEditClient={id:'C',fname:'CHLOE'};
            loadCoachSessionSlots();
            return /B-LUNDI/.test(boite().innerHTML)
              ?_echec('les séances de BOB survivent à un athlète sans grille'):true;
          } catch(e){ return _echec('exception : '+e.message); }
          finally { currentUser=_sv; _coachEditClient=_se; window.saveUser=_su; }})());
        ok('Le filet couvre TOUT le montage, pas seulement le rendu',(()=>{
          // Le premier correctif n'entourait que renderProgEx. _prepProgEditor,
          // la copie des exercices et le titre pouvaient lever juste avant, et
          // le bouton redevenait muet pour exactement la même raison.
          const _sv=currentUser,_se=_coachEditClient,_sc=_progEditorCtx;
          const _pp=_prepProgEditor,_t=toast,_ce=console.error;
          let dit=0;
          try{
            _prepProgEditor=()=>{throw new Error('panne avant le rendu');};
            toast=()=>{dit++;}; console.error=()=>{};
            currentUser={id:'c1',email:'c@t',role:'coach',fname:'K',exAlias:{},
              exMuscles:{},programs:{},sessions:[],bilans:[],nutrition:{},coachPrograms:[]};
            _coachEditClient={id:'a1',fname:'A',sessions_config:[{day:'Lundi',
              name:'ATH',active:true,exercises:[{name:'DC',series:3,reps:'10'}]}]};
            go('s-coach-sessions');
            openCoachSessionExercises(0);
            const ec=(document.querySelector('.screen.active')||{}).id;
            if(ec==='s-coach-program') return _echec('on entre dans un écran à moitié monté');
            return dit>0?true:_echec('aucun message : le bouton reste muet');
          } catch(e){ return _echec('l\'exception ressort jusqu\'au clic : '+e.message); }
          finally { _prepProgEditor=_pp; toast=_t; console.error=_ce;
            currentUser=_sv; _coachEditClient=_se; _progEditorCtx=_sc; }})());
