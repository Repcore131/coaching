// DE L'ACCUEIL À LA PREMIÈRE SÉRIE, EN 5 TOUCHES AU PLUS (05/10/2026).
//
// Un athlète NEUF et SANS COACH, posé dans le stockage local (la question des
// jours et le parcours automatique déjà vus, pour partir de l'accueil) :
// « Lance ta première séance », trois réponses, « Démarrer ma première séance ».
// Sortie 0 si la première série est à l'écran en 5 touches au plus, sans erreur
// de page. Réseau extérieur coupé.
//
//   python3 -m http.server 8799 --bind 127.0.0.1 &      (à la racine du dépôt)
//   node scripts/verif/premiere-serie.mjs [http://127.0.0.1:8799] [dossier-captures]
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const BASE = process.argv[2] || 'http://127.0.0.1:8799';
const OUT = process.argv[3] || '';
let executablePath;
const pwb = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
if (existsSync(pwb)) { const d = readdirSync(pwb).find((x) => /^chromium-\d+$/.test(x)); const p = d && pwb + '/' + d + '/chrome-linux/chrome'; if (p && existsSync(p)) executablePath = p; }
const b = await pw.chromium.launch({ executablePath, args:['--no-sandbox'] });
const ctx = await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, isMobile:true, hasTouch:true, timezoneId:'Europe/Paris', locale:'fr-FR' });
await ctx.route(u=>!u.toString().startsWith(BASE+'/'), r=>r.abort());
const p = await ctx.newPage();
const erreurs=[]; p.on('pageerror',e=>erreurs.push(e.message));
await p.goto(BASE+'/app/'); await p.waitForTimeout(2500);
await p.evaluate(()=>{
  const u={id:'neuf',email:'neuf@repcore.test',role:'athlete',fname:'Sam',lname:'Neuf',gender:'H',birthdate:'1996-03-02',
    createdAt:Date.now(),sessions:[],bilans:[],weightLog:[],onboarded:true,
    sessions_config:_seancesViergesSemaine().map(s=>Object.assign(s,{_essai:true})),
    consent:{health:true,cgu:true,policyVersion:POLICY_VERSION,at:Date.now()},status:'AUTONOMIE_PREMIUM',paymentStatus:'active',abonnement:{formule:'ultime'}};
  localStorage.setItem('rc_session',JSON.stringify(u)); localStorage.setItem('rc_users',JSON.stringify({[u.email]:u}));
  // De L'ACCUEIL : la question des jours et le parcours automatique déjà vus.
  localStorage.setItem('rc_jours_vu_'+u.email,'1'); localStorage.setItem('rc_premiere_seance_'+u.email,'1');
});
await p.reload(); await p.waitForTimeout(3000);
const ecran=()=>p.evaluate(()=>(document.querySelector('.screen.active')||{}).id);
console.log('départ :',await ecran());
let touches=0;
const toucher=async(sel,nom)=>{ await p.locator(sel).first().tap(); touches++; await p.waitForTimeout(700); console.log(touches+'. '+nom+' → '+await ecran()); };
await toucher('button.pd-ligne:has-text("Lance ta première séance")','Lance ta première séance');
await toucher('#ps-corps .ps-choix','objectif');
await toucher('#ps-corps .ps-choix','fréquence');
await toucher('#ps-corps .ps-choix','lieu');
if (OUT) await p.screenshot({path:OUT+'/ps-seance.png'});
await toucher('button:has-text("Démarrer ma première séance")','Démarrer ma première séance');
await p.waitForTimeout(1500);
const serie=await p.evaluate(()=>{ const tr=document.querySelector('#sets-body-0 tr'); if(!tr) return null; const r=tr.getBoundingClientRect();
  return {visible:r.width>0&&r.height>0&&r.top<window.innerHeight, exo:(document.querySelector('#wo-ex-name,.wo-ex-name,#s-workout h1, #s-workout h2')||{}).textContent||''}; });
if (OUT) await p.screenshot({path:OUT+'/ps-serie.png'});
console.log('écran final :',await ecran(),'· première série :',JSON.stringify(serie),'· touches :',touches,'· erreurs :',erreurs.length?erreurs:'aucune');
await b.close();
process.exit(serie&&serie.visible&&touches<=5&&!erreurs.length?0:1);
