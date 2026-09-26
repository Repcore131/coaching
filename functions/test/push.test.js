// Banc de test des fonctions push, Firebase simulé en mémoire : node functions/test/push.test.js
const Module=require('module');
const store={};
const get=(p)=>p.split('/').filter(Boolean).reduce((o,k)=>o==null?undefined:o[k],store);
const set=(p,v)=>{ const ks=p.split('/').filter(Boolean); let o=store; for(let i=0;i<ks.length-1;i++){ o[ks[i]]=o[ks[i]]||{}; o=o[ks[i]]; } if(v===null||v===undefined) delete o[ks[ks.length-1]]; else o[ks[ks.length-1]]=JSON.parse(JSON.stringify(v)); };
const snap=(v)=>({val:()=>v===undefined?null:v,exists:()=>v!=null,forEach(fn){ if(v&&typeof v==='object') Object.keys(v).forEach(k=>fn({val:()=>v[k]})); }});
const ref=(p)=>({ get:async()=>snap(get(p)), set:async(v)=>set(p,v), remove:async()=>set(p,null), update:async(v)=>{ for(const k in v) set(p+'/'+k,v[k]); },
  transaction:async(fn)=>{ const r=fn(get(p)); if(r===undefined) return {committed:false}; set(p,r); return {committed:true}; },
  orderByKey(){return this;}, limitToLast(){return this;}, toString:()=>'https://x.firebaseio.com/'+p });
const envoyes=[];
let statut=null;
const mocks={
  'firebase-admin':{initializeApp(){}, database:()=>({ref}), credential:{applicationDefault:()=>({getAccessToken:async()=>({access_token:'t'})})}},
  'firebase-functions/v2/https':{onCall:(o,f)=>f||o,onRequest:(o,f)=>f||o,HttpsError:class extends Error{}},
  'firebase-functions/params':{defineSecret:(n)=>({value:()=>'secret-'+n})},
  'firebase-functions/v2':{setGlobalOptions(){}},
  'firebase-functions/v2/scheduler':{onSchedule:(o,f)=>f},
  'firebase-functions/v2/database':{onValueCreated:(o,f)=>f,onValueWritten:(o,f)=>f},
  'web-push':{setVapidDetails(){}, async sendNotification(sub,charge){ if(statut){ const e=new Error('x'); e.statusCode=statut; throw e; } envoyes.push([sub.endpoint,JSON.parse(charge)]); }}
};
const orig=Module._load;
Module._load=function(req,...a){ if(mocks[req]) return mocks[req]; return orig.call(this,req,...a); };
global.fetch=async()=>({ok:false});
const F=require(require('path').join(__dirname,'..','index.js'));
const assert=(c,m)=>{ if(!c){ console.log('ECHEC:',m); process.exitCode=1; } else console.log('ok  :',m); };
(async()=>{
  // Heures : on force l'horloge.
  const RealNow=Date.now;
  const a=(iso)=>{ Date.now=()=>Date.parse(iso); };
  set('push/lea,t/a1',{endpoint:'https://p/1',keys:{p256dh:'x',auth:'y'}});
  set('push/lea,t/a2',{endpoint:'https://p/2',keys:{p256dh:'x',auth:'y'}});
  // 1. Réponse du coach, 14 h à Paris : part, sur les deux appareils.
  a('2026-09-28T12:00:00Z');
  await F.pushReponseCoachBilan({data:{before:{val:()=>null},after:{val:()=>'Beau travail'}},params:{uid:'lea,t',i:'3'}});
  assert(envoyes.length===2&&envoyes[0][1].title==='Ton coach a répondu à ton bilan','réponse du coach envoyée sur les 2 appareils');
  // 2. Plafond : un second push le même jour ne part pas.
  await F.pushReponseCoachRite({data:{before:{val:()=>null},after:{val:()=>'ok'}},params:{uid:'lea,t',i:'1'}});
  assert(envoyes.length===2,'plafond : 1 push par jour');
  // 3. Heures calmes : 22 h 30 à Paris le lendemain → mis de côté, puis parti à 8 h 05.
  a('2026-09-29T20:30:00Z');
  await F.pushReponseCoachBilan({data:{before:{val:()=>null},after:{val:()=>'La nuit'}},params:{uid:'lea,t',i:'4'}});
  assert(envoyes.length===2&&get('push_attente/lea,t'),'heures calmes : rien ne part, le message attend');
  a('2026-09-30T06:05:00Z');
  await F.pushApresHeuresCalmes();
  assert(envoyes.length===4&&!get('push_attente/lea,t'),'8 h 05 : le message mis de côté part');
  // 4. Type coupé par l'athlète.
  a('2026-10-01T12:00:00Z');
  set('users/lea,t/pushPrefs',{coach:false});
  await F.pushReponseCoachBilan({data:{before:{val:()=>null},after:{val:()=>'x'}},params:{uid:'lea,t',i:'5'}});
  assert(envoyes.length===4,'type coupé dans les réglages : rien ne part');
  set('users/lea,t/pushPrefs',null);
  // 5. Déjà répondu (modification d'une réponse) : pas de nouveau push.
  await F.pushReponseCoachBilan({data:{before:{val:()=>'avant'},after:{val:()=>'après'}},params:{uid:'lea,t',i:'5'}});
  assert(envoyes.length===4,'une réponse modifiée ne renvoie rien');
  // 6. Abonnements expirés (410) : supprimés, et la place du jour est rendue.
  statut=410;
  await F.pushReponseCoachBilan({data:{before:{val:()=>null},after:{val:()=>'x'}},params:{uid:'lea,t',i:'6'}});
  assert(!Object.keys(get('push/lea,t')||{}).length,'410 : les abonnements expirés sont supprimés');
  assert(!get('push_log/lea,t'),'rien n’est parti : le plafond du jour est rendu');
  statut=null;
  // 7. Série en danger : jeudi, semaine non validée.
  set('push/tom,t/b1',{endpoint:'https://p/3',keys:{p256dh:'x',auth:'y'}});
  set('users/tom,t',{streak:6,streakWeek:'2026-09-21',fname:'Tom'});
  a('2026-10-01T16:00:00Z'); // jeudi 1er octobre, 18 h Paris
  await F.pushSerieEnDanger();
  const s=envoyes.find(x=>x[0]==='https://p/3');
  assert(s&&s[1].title==='Ta série de 6 semaines est en danger'&&s[1].url==='./?wo=1','série en danger envoyée');
  // Semaine déjà validée : rien.
  set('push_log/tom,t',null); const n0=envoyes.length;
  set('users/tom,t/streakWeek','2026-09-28');
  await F.pushSerieEnDanger();
  assert(envoyes.length===n0,'semaine validée : pas de rappel');
  // 8. Défi du Canal : aux athlètes de l'annuaire, seulement si defi:true.
  set('annuaire_coach/kev,t',{'tom,t':{email:'tom@t'}});
  a('2026-10-02T12:00:00Z');
  await F.pushDefiCanal({data:{val:()=>({titre:'Info',texte:'x'})},params:{coach:'kev,t',msg:'m1'}});
  assert(envoyes.length===n0,'un message ordinaire du Canal ne notifie pas');
  await F.pushDefiCanal({data:{val:()=>({titre:'100 pompes',texte:'Cette semaine',defi:true})},params:{coach:'kev,t',msg:'m2'}});
  assert(envoyes.length===n0+1&&envoyes[envoyes.length-1][1].title==='Nouveau défi : 100 pompes','défi du Canal envoyé');
  Date.now=RealNow;
})();
