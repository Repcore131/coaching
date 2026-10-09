// L'ATLAS DES SCHÉMAS EN FICHIERS (build 1963).
//
// Exécute app/rc-schemas.js TEL QUEL — le même code que l'app — et écrit
// chaque entrée de ATLAS_SCHEMAS dans app/img/schemas/ :
//   <cle>.svg   toujours ;
//   <cle>.webp  quand Playwright est disponible : le SVG est peint dans un
//               <canvas> de Chromium, puis encodé en WebP par le navigateur.
//
//   node scripts/generer_atlas.mjs [--sortie DOSSIER] [--verif] [--sans-webp]
//
// --verif rejoue les invariants géométriques (longueurs conservées, barre à
// l'aplomb du milieu du pied, buste qui s'incline avec le fémur) et compare
// les SVG livrés à ce que le code produit : sortie non nulle s'ils ont dérivé.
//
// Playwright n'est PAS une dépendance du dépôt : RC_PLAYWRIGHT peut pointer
// vers son module (…/node_modules/playwright/index.mjs), RC_CHROMIUM vers un
// exécutable Chromium. Sans eux, seuls les SVG sont écrits, et on le dit.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const SORTIE = path.resolve(opt('--sortie') || path.join(RACINE, 'app/img/schemas'));
const VERIF = args.includes('--verif');

export function chargerSchemas() {
  const ctx = {};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RACINE, 'app/rc-schemas.js'), 'utf8'), ctx, { filename: 'rc-schemas.js' });
  return ctx.RCSchemas;
}

/** Les invariants : rend la liste des écarts (vide si tout tient). */
export function invariants(R) {
  const fautes = [];
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  for (const e of R.ATLAS_SCHEMAS) {
    const cas = e.comparer && e.comparer.length ? e.comparer : [{ params: {}, options: {} }];
    for (const c of cas) {
      const s = R.silhouette(Object.assign({}, e.params, c.params || {}));
      const p = R.POSES[e.pose](s, Object.assign({}, e.options, c.options || {}));
      if (!p.meta || !p.meta.ok) { fautes.push(e.cle + ' : pose impossible'); continue; }
      for (const g of p.segs) {
        if (g[2] == null) continue;
        const ecart = Math.abs(d(p.pts[g[0]], p.pts[g[1]]) - g[2]);
        if (ecart > 1e-6) fautes.push(e.cle + ' : ' + g[0] + '–' + g[1] + ' s’écarte de ' + ecart.toFixed(3) + ' cm');
      }
      if ((e.pose === 'squat' || e.pose === 'souleve') && Math.abs(p.pts.barre.x - p.pts.milieuPied.x) > 1e-6)
        fautes.push(e.cle + ' : la barre n’est pas à l’aplomb du milieu du pied');
    }
  }
  const buste = (f) => R.POSES.squat(R.silhouette({ femur: f }), {}).meta.buste;
  const l = [0.21, 0.23, 0.245, 0.26, 0.28].map(buste);
  for (let i = 1; i < l.length; i++) if (!(l[i] > l[i - 1])) fautes.push('le buste ne s’incline pas avec le fémur : ' + l.join(', '));
  return fautes;
}

async function webp(svgs) {
  let pw = null;
  try { pw = await import(process.env.RC_PLAYWRIGHT ? pathToFileURL(process.env.RC_PLAYWRIGHT).href : 'playwright'); } catch (e) { return null; }
  const chromium = pw.chromium || (pw.default && pw.default.chromium);
  const b = await chromium.launch(process.env.RC_CHROMIUM ? { executablePath: process.env.RC_CHROMIUM } : {});
  try {
    const page = await b.newPage();
    const out = {};
    for (const [cle, svg] of Object.entries(svgs)) {
      out[cle] = await page.evaluate(async (s) => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
        await img.decode();
        const c = document.createElement('canvas');
        // En double densité : les fiches s'affichent sur des écrans denses.
        c.width = img.naturalWidth * 2; c.height = img.naturalHeight * 2;
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        return c.toDataURL('image/webp', 0.9);
      }, svg);
    }
    return out;
  } finally { await b.close(); }
}

async function principal() {
  const R = chargerSchemas();
  const fautes = invariants(R);
  if (fautes.length) { console.error('INVARIANTS ROMPUS :\n  ' + fautes.join('\n  ')); process.exit(1); }
  const svgs = {};
  for (const e of R.ATLAS_SCHEMAS) svgs[e.cle] = R.dessinerAtlas(e.cle);
  if (VERIF) {
    const derive = Object.keys(svgs).filter((k) => {
      const f = path.join(SORTIE, k + '.svg');
      return !fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== svgs[k];
    });
    if (derive.length) { console.error('SVG ABSENTS OU DÉRIVÉS : ' + derive.join(', ') + ' (relancer node scripts/generer_atlas.mjs)'); process.exit(1); }
    console.log('atlas ok : ' + Object.keys(svgs).length + ' schémas, invariants tenus');
    return;
  }
  fs.mkdirSync(SORTIE, { recursive: true });
  for (const [k, s] of Object.entries(svgs)) fs.writeFileSync(path.join(SORTIE, k + '.svg'), s);
  const w = args.includes('--sans-webp') ? null : await webp(svgs);
  if (w) for (const [k, u] of Object.entries(w)) fs.writeFileSync(path.join(SORTIE, k + '.webp'), Buffer.from(u.split(',')[1], 'base64'));
  console.log(Object.keys(svgs).length + ' SVG écrits' + (w ? ' et ' + Object.keys(w).length + ' WebP' : ' (WebP : Playwright introuvable, voir RC_PLAYWRIGHT)') + ' dans ' + path.relative(RACINE, SORTIE));
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) await principal();
