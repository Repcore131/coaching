// LE LIEN D'INVITATION, DE BOUT EN BOUT (05/10/2026).
//
// Le coach génère un lien par inviterAthlete (fetch remplacé : rien ne part) ;
// l'athlète, sur un autre appareil, l'ouvre : la page /i/ montre le tuto,
// « Ouvrir RepCore » mène à l'Espace athlète, code pré-rempli, et la bannière
// nomme le coach — lu dans /rc_codes/<code>, que la sonde sert elle-même.
// Sortie 0 si tout y est, sans coachpkg dans le lien et sans erreur de page.
//
//   python3 -m http.server 8799 --bind 127.0.0.1 &      (à la racine du dépôt)
//   node scripts/verif/lien-invitation.mjs [dossier-captures]
import { createRequire } from 'node:module';
import { existsSync, readdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const OUT = process.argv[2] || '';
let executablePath;
const pwb = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
if (existsSync(pwb)) { const d = readdirSync(pwb).find((x) => /^chromium-\d+$/.test(x)); const p = d && pwb + '/' + d + '/chrome-linux/chrome'; if (p && existsSync(p)) executablePath = p; }
const b = await pw.chromium.launch({ executablePath, args:['--no-sandbox'] });
// ── 1. LE COACH génère le lien (fetch stubbé : rien ne part).
const cc = await b.newContext({ viewport:{width:390,height:844} });
await cc.route(u=>!u.toString().startsWith('http://127.0.0.1:8799/'), r=>r.abort());
const pc = await cc.newPage();
await pc.goto('http://127.0.0.1:8799/app/'); await pc.waitForTimeout(2500);
const gen = await pc.evaluate(async()=>{
  window.fetch=async(url,o)=>new Response(JSON.stringify({name:'ok'}),{status:200,headers:{'Content-Type':'application/json'}});
  CLOUD._getToken=async()=>'jeton-test'; window.saveUser=()=>true;
  currentUser={id:'c-kevin',email:'kevin@repcore.test',role:'coach',fname:'Kevin',lname:'G',code:'GCP-KEV1',studentCodes:[]};
  const r=await inviterAthlete('Léa','Martin');
  return {ok:r.ok,raison:r.raison,lien:r.lien,token:r.invitation&&r.invitation.token};
});
console.log('1. lien généré :',gen.lien,'('+(gen.lien||'').length+' car.)',gen.ok?'':gen.raison);
// ── 2. L'ATHLÈTE l'ouvre (autre appareil : stockage vierge). /rc_codes/<code> est servi par la sonde.
const ca = await b.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
await ca.route(u=>!u.toString().startsWith('http://127.0.0.1:8799/'), r=>{
  if(/rc_codes/.test(r.request().url())) return r.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({coachId:'c-kevin',coachName:'Kevin G',type:'athlete',active:true,redeemed:false,expiry:Date.now()+30*864e5,months:3})});
  return r.abort();
});
const pa = await ca.newPage(); const err=[]; pa.on('pageerror',e=>err.push(e.message));
await pa.goto(gen.lien); await pa.waitForTimeout(600);
const tuto = await pa.evaluate(()=>({url:location.pathname+location.search, titre:(document.querySelector('h1')||{}).textContent, texte:document.body.innerText.slice(0,160).replace(/\s+/g,' ')}));
console.log('2. page /i/ :',JSON.stringify(tuto));
if (OUT) await pa.screenshot({path:OUT+'/inv-i.png'});
// « Ouvrir RepCore » (s'il n'a pas déjà redirigé de lui-même).
if(/\/i\//.test(new URL(pa.url()).pathname)){ const go=pa.locator('#go'); if(await go.count()&&await go.isVisible()) { await go.tap(); console.log('   → touché « Ouvrir RepCore »'); } }
await pa.waitForURL(/\/app\//,{timeout:8000}).catch(()=>{});
await pa.waitForTimeout(3000);
const r = await pa.evaluate(()=>({url:location.pathname+location.search, ecran:(document.querySelector('.screen.active')||{}).id,
  code:(document.getElementById('ae-code')||{}).value, banniere:(document.getElementById('ae-coach-banner')||{}).textContent,
  bannVue:(document.getElementById('ae-coach-banner')||{style:{}}).style.display}));
console.log('3. app :',JSON.stringify(r),'· erreurs :',err.length?err:'aucune');
if (OUT) await pa.screenshot({path:OUT+'/inv-app.png'});
await b.close();
process.exit(gen.ok&&!/coachpkg/.test(gen.lien)&&r.ecran==='s-athlete-entry'&&r.code===gen.token&&/Kevin G/.test(r.banniere||'')&&!err.length?0:1);
