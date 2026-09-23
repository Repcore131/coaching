// OU EST LE CODE DE L'APP, DEPUIS LE BUILD 1417.
//
// Il n'est plus dans app/index.html : le gros du JavaScript vit dans
// app/rc-core.<build>.js et la feuille de styles dans app/rc-style.<build>.css,
// servis `immutable` pour un an sous un nom qui porte le build. C'est ce qui
// evite de renvoyer 1,9 Mo compresses a chaque ouverture de l'app.
//
// `sourceProd()` rend la page RECONSTITUEE — index.html avec ses deux actifs
// remis EN LIGNE, A LEUR PLACE. C'est exactement ce que voit _prodSrc() dans la
// suite de tests. A leur place et non concatenes en queue : des controles
// lisent cette source comme une PAGE, et recollee bout a bout elle n'en est
// plus une.
//
// Le pendant Python est scripts/source_prod.py.
import {readFileSync, existsSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';

const RACINE = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..');
const APP = join(RACINE, 'app');
export const INDEX = join(APP, 'index.html');

export function sourceProd() {
  let s = readFileSync(INDEX, 'utf8');
  for (const [re, ouvrant, fermant] of [
    [/<link rel="stylesheet" href="\.\/(rc-style\.\d+\.css)">/, '<style>', '</style>'],
    [/<script src="\.\/(rc-core\.\d+\.js)"><\/script>/, '<script>', '</script>'],
  ]) {
    const m = s.match(re);
    if (!m) continue;
    const p = join(APP, m[1]);
    if (!existsSync(p)) { console.error('actif introuvable : ' + p); process.exit(1); }
    s = s.slice(0, m.index) + ouvrant + readFileSync(p, 'utf8') + fermant + s.slice(m.index + m[0].length);
  }
  return s;
}

// Le fichier qui PORTE le gros script — a viser quand on ecrit dans le code.
export function fichierCode() {
  const m = readFileSync(INDEX, 'utf8').match(/<script src="\.\/(rc-core\.\d+\.js)"><\/script>/);
  const p = m ? join(APP, m[1]) : null;
  return p && existsSync(p) ? p : INDEX;
}
