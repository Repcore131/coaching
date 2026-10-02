#!/usr/bin/env node
// ══ LES IMAGES DE LA FICHE PLAY STORE, GÉNÉRÉES (02/10/2026) ═════════════
//
// Six captures 1080×1920 et la bannière 1024×500, en JPEG (la Play Console
// refuse un PNG avec couche alpha, et Chrome en produit), dans
// android/fiche-store/fr-FR/images/ (format fastlane). Chaque capture pose une
// VRAIE image de l'app (app/img/vente, ou l'écran Espace coach de l'app
// elle-même) dans un téléphone, sous un titre court, sur le fond de la marque.
// L'icône 512×512 est android/store_icon.png, recopiée.
//
// ⚠ 1080×1920 ET NON 1080×2340 : la Play Console refuse une capture dont le
//   grand côté dépasse le double du petit (2340 / 1080 = 2,17).
//
// Il faut un serveur sur le dépôt et un Chromium sans tête (comme la suite) :
//   python3 -m http.server 8799 &
//   <chromium> --headless --remote-debugging-port=9223 &
//   node scripts/captures-store.mjs [http://localhost:8799] [9223]
import { writeFileSync, copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../', import.meta.url));
const [,, BASE = 'http://localhost:8799', PORT = '9223'] = process.argv;
const DEST = RACINE + 'android/fiche-store/fr-FR/images/';

// Le titre (deux lignes au plus), l'image et son cadrage.
export const CAPTURES = [
  { f: '1_seance.jpg', titre: 'La bonne charge,<em>à chaque série.</em>', img: 'app/img/vente/seance-charge.webp' },
  { f: '2_nutrition.jpg', titre: 'Ta nutrition,<em>même hors ligne.</em>', img: 'app/img/vente/nutrition-journal.webp', haut: true },
  { f: '3_progression.jpg', titre: 'Ta progression,<em>semaine après semaine.</em>', img: 'app/img/vente/evolution-poids.webp' },
  { f: '4_correction.jpg', titre: 'Ta technique corrigée,<em>image par image.</em>', img: 'app/img/vente/correction.webp', clip: true },
  { f: '5_exercices.jpg', titre: '400+ exercices<em>filmés et expliqués.</em>', img: 'app/img/vente/exercice-tirage.webp', clip: true },
  { f: '6_coach.jpg', titre: 'Pour les coachs :<em>toi, tu coaches.</em>', img: 'COACH' },
];

const t = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p = {}) => new Promise((res, rej) => { const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('délai ' + m)); } }, 60000); });
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
await new Promise((r) => { ws.onopen = r; });
const ev = async (x) => (await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true })).result.value;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const taille = (w, h, s) => cmd('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: s || 1, mobile: false });
const photo = async (f) => Buffer.from((await cmd('Page.captureScreenshot', f === 'png' ? { format: 'png' } : { format: 'jpeg', quality: 92 })).data, 'base64');

// 1. L'écran Espace coach, tel que l'app l'affiche (360×780, 600×1300 en sortie).
await cmd('Emulation.setUserAgentOverride', { userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36' });
await taille(360, 780, 600 / 360);
await cmd('Page.navigate', { url: BASE + '/app/index.html' });
await pause(5000);
await ev(`(async()=>{ try{ go('s-coach-entry'); }catch(e){} await new Promise(r=>setTimeout(r,1200)); return 1; })()`);
const coach = 'data:image/png;base64,' + (await photo('png')).toString('base64');

// 2. Les compositions.
const css = `@font-face{font-family:'Bebas Neue';src:url('${BASE}/app/fonts/bebasneue-400-latin.woff2') format('woff2')}
@font-face{font-family:'Montserrat';font-weight:100 900;src:url('${BASE}/app/fonts/montserrat-var-latin.woff2') format('woff2')}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:#080808}
body{background:radial-gradient(ellipse 80% 55% at 50% 22%,rgba(224,32,32,.28),transparent 70%),#080808;font-family:Montserrat,sans-serif;color:#fff;
  display:flex;flex-direction:column;align-items:center}
h1{font-family:'Bebas Neue',Impact,sans-serif;font-weight:400;font-size:112px;line-height:.98;letter-spacing:2px;text-align:center;text-transform:uppercase;margin-top:120px;padding:0 60px}
h1 em{display:block;font-style:normal;color:#E02020}
.tel{margin-top:64px;width:600px;height:1300px;border-radius:84px;padding:16px;background:linear-gradient(145deg,#2a2a2a,#0e0e0e);
  box-shadow:0 0 0 2px #333,0 60px 120px -30px rgba(0,0,0,.95),0 0 160px -20px rgba(224,32,32,.35);position:relative}
.tel::before{content:'';position:absolute;top:34px;left:50%;transform:translateX(-50%);width:30%;height:40px;border-radius:24px;background:#000;z-index:2}
.tel img{width:100%;height:100%;object-fit:cover;object-position:top;border-radius:70px;display:block;background:#0b0b0b}
.clip{margin-top:80px;width:760px;height:1300px;border-radius:40px;overflow:hidden;border:2px solid #2a2a2a;box-shadow:0 60px 120px -30px rgba(0,0,0,.95),0 0 160px -20px rgba(224,32,32,.4)}
.clip img{width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block}
.marque{position:absolute;bottom:44px;font-family:'Bebas Neue',Impact,sans-serif;font-size:44px;letter-spacing:8px;color:rgba(255,255,255,.6)}`;
mkdirSync(DEST + 'phoneScreenshots', { recursive: true });
await taille(1080, 1920, 1);
for (const c of CAPTURES) {
  const src = c.img === 'COACH' ? coach : BASE + '/' + c.img;
  const corps = c.clip ? `<div class="clip"><img src="${src}"></div>` : `<div class="tel"><img src="${src}"></div>`;
  await cmd('Page.navigate', { url: BASE + '/legal.html' });  // même origine : about:blank ne charge rien de localhost
  await pause(800);
  await ev(`document.open();document.write(${JSON.stringify(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><h1>${c.titre}</h1>${corps}<div class="marque">REPCORE</div></body></html>`)});document.close();1`);
  await ev(`(async()=>{ await document.fonts.ready; await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}))); return 1; })()`);
  await pause(300);
  writeFileSync(DEST + 'phoneScreenshots/' + c.f, await photo());
  console.log('écrit phoneScreenshots/' + c.f);
}
// 3. La bannière 1024×500 : og-vente.jpg recadrée (fond opaque, sans alpha).
await taille(1024, 500, 1);
await cmd('Page.navigate', { url: BASE + '/legal.html' });  // même origine : about:blank ne charge rien de localhost
await pause(800);
await ev(`document.open();document.write(${JSON.stringify(`<!doctype html><html><head><style>*{margin:0}html,body{width:1024px;height:500px;overflow:hidden;background:#080808}img{width:1024px;height:500px;object-fit:cover;display:block}</style></head><body><img src="${BASE}/app/img/vente/og-vente.jpg"></body></html>`)});document.close();1`);
await ev(`(async()=>{ await Promise.all([...document.images].map(i=>i.complete?1:new Promise(r=>{i.onload=i.onerror=r;}))); return 1; })()`);
await pause(300);
writeFileSync(DEST + 'featureGraphic.jpg', await photo());
console.log('écrit featureGraphic.jpg');
copyFileSync(RACINE + 'android/store_icon.png', DEST + 'icon.png');
console.log('copié icon.png (android/store_icon.png)');
await fetch(`http://127.0.0.1:${PORT}/json/close/${t.id}`);
process.exit(0);
