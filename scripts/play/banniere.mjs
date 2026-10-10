#!/usr/bin/env node
// LA BANNIÈRE DE LA FICHE GOOGLE PLAY (1024 × 500) — polices et icône de l'app.
//   node scripts/play/banniere.mjs   →  docs/play/banniere-1024x500.png
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch (e) { pw = createRequire(process.env.PLAYWRIGHT_MODULE || '/opt/node-tools/node_modules/')('playwright'); }
const r = (f) => new URL('../../' + f, import.meta.url);
const b64 = (f) => readFileSync(r(f)).toString('base64');
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Bebas;src:url(data:font/woff2;base64,${b64('app/fonts/bebasneue-400-latin.woff2')})}
@font-face{font-family:Mont;src:url(data:font/woff2;base64,${b64('app/fonts/montserrat-var-latin.woff2')});font-weight:100 900}
html,body{margin:0;width:1024px;height:500px;background:#080808;overflow:hidden}
.f{position:absolute;inset:0;background:radial-gradient(circle at 78% 50%,rgba(220,20,20,.35),transparent 55%),linear-gradient(90deg,#080808 40%,#120404)}
.i{position:absolute;right:96px;top:110px;width:280px;height:280px;border-radius:56px;box-shadow:0 20px 60px rgba(220,20,20,.35)}
.t{position:absolute;left:72px;top:118px;color:#fff}
h1{font-family:Bebas;font-size:132px;letter-spacing:4px;margin:0;line-height:1}
p{font-family:Mont;font-weight:600;font-size:30px;margin:14px 0 0;color:#ddd;line-height:1.35}
.r{color:#ff3030}
</style><div class="f"></div><img class="i" src="data:image/png;base64,${b64('android/store_icon.png')}">
<div class="t"><h1>REPCORE</h1><p>Programme de musculation,<br>suivi de charge <span class="r">et cycle.</span></p></div>`;
const lancer = { args: ['--no-sandbox'] };
if (process.env.PLAYWRIGHT_CHROMIUM) lancer.executablePath = process.env.PLAYWRIGHT_CHROMIUM;
const navigateur = await pw.chromium.launch(lancer);
const p = await navigateur.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await p.setContent(html); await p.waitForTimeout(500);
await p.screenshot({ path: new URL('../../docs/play/banniere-1024x500.png', import.meta.url).pathname });
await navigateur.close();
console.log('docs/play/banniere-1024x500.png');
