// LES TEXTES DE L'APP, TELS QU'ILS ARRIVENT A L'ECRAN (07/10/2026).
//
//   node scripts/i18n_extraire.mjs <dossier d'acorn> [sortie.json]
//
// L'app est ecrite en francais, dans le code. Pour la traduire sans reecrire
// vingt mille chaines, on ne touche PAS au code : un traducteur, a l'ecran,
// remplace chaque texte affiche par sa traduction (app/rc-core, rcI18n). Ce
// script dresse la liste de ces textes, que les dictionnaires app/i18n/*.json
// traduisent.
//
// CE QU'IL SORT : des SEGMENTS, c'est-a-dire ce qu'un noeud de texte du DOM (ou
// un attribut title / placeholder / aria-label / alt) portera une fois la page
// rendue. Deux formes :
//   - exact  : « Annuler », « Gérer mes séances » ;
//   - motif  : « {0} séances cette semaine », ou {0} est ce que le code y met
//              (un nombre, un nom). Tire des concatenations et des gabarits.
// Les balises sont retirees : `'<b>'+n+'</b> kg de '+x` donne « {0} » (ignore)
// et « kg de {0} ».
//
// acorn n'est pas une dependance du depot : on donne le dossier ou il est
// installe (le miroir de test fait de meme).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [dossierAcorn, sortie] = process.argv.slice(2);
if (!dossierAcorn) { console.error('usage : node scripts/i18n_extraire.mjs <dossier ou acorn est installe> [sortie.json]'); process.exit(2); }
const req = createRequire(path.join(path.resolve(dossierAcorn), 'package.json'));
const acorn = req('acorn'), walk = req('acorn-walk');

const VAR = '\u0001', COUPE = '\u0002';
const ENTITES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê', rsquo: '’', laquo: '«', raquo: '»', hellip: '…', middot: '·', times: '×', rarr: '→', larr: '←', deg: '°', euro: '€', ndash: '–', mdash: '—', thinsp: ' ' };
const decoder = (s) => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&([a-z]+);/gi, (m, n) => (n in ENTITES ? ENTITES[n] : m));
// LA MEME NORMALISATION QUE LE TRADUCTEUR (rcI18nNorme) : espaces de toute
// sorte ramenes a une espace, bords rognes.
export const norme = (s) => String(s).replace(/[\s   ​⁠]+/g, ' ').trim();

const MOTS_FR = new Set('de la le les un une des et à a en pour sur par ton ta tes ce cette ces pas est du au aux avec ou qui que ne se son sa ses mon ma mes tu il elle on nous vous dans plus sans sous entre vers chez très déjà encore aucun aucune rien tout toute tous toutes'.split(' '));
function retenir(seg) {
  const stat = seg.split(VAR).join(' ');
  const lettres = (stat.match(/\p{L}/gu) || []).length;
  if (lettres < 3 || !/\p{L}{3,}/u.test(stat)) return false;
  if (seg.length > 600) return false;
  // Du code, du style, une adresse, un chemin, une clef.
  if (/[{};]|=>|\bfunction\b|\bvar\(--|https?:\/\/|\.(js|css|png|webp|jpg|json|html|mp4|woff2)\b|^\s*[.#][\w-]+\s*$|\bdata:image|rgba?\(|@media|!important/.test(stat)) return false;
  if (/^[\w$.-]+$/.test(stat.trim()) && /[_$.]|[a-z][A-Z]/.test(stat)) return false;
  // Un reste de balise (un attribut et sa valeur) : pas un texte.
  if (/[\w-]+\s*=\s*["']/.test(seg) || /^\s*\/?>/.test(seg)) return false;
  const mots = stat.trim().split(/\s+/);
  const aAccent = /[àâäçéèêëîïôöùûüÿœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ’«»]/.test(stat);
  if (mots.length === 1 && !seg.includes(VAR)) {
    const m = mots[0];
    if (aAccent && /^[\p{L}’'-]+[.:!?…]?$/u.test(m)) return true;
    if (/^[A-Z][a-z’'-]{2,}[.,:!?…]?$/.test(m)) return true;       // Annuler, Bonsoir,
    if (/^[A-Z]{3,}[.:!?…]?$/.test(m)) return true;                 // SUIVANT
    return false;
  }
  // Tout en minuscules sans accent : une liste de classes ou de clefs, sauf mot de liaison francais.
  if (!aAccent && mots.every((m) => /^[a-z0-9-]+$/.test(m)) && !mots.some((m) => MOTS_FR.has(m))) return false;
  // Un motif dont le fixe est trop court matcherait n'importe quoi.
  if (seg.includes(VAR) && lettres < 4) return false;
  return true;
}
const ATTRS = /\b(?:title|placeholder|aria-label|alt|data-tip|data-titre|label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const vus = new Map();   // segment normalise -> { n, ou }
function deposer(brut, ou) {
  // Une suite de variables n'en fait qu'une.
  let seg = norme(decoder(brut)).replace(new RegExp('(?:' + VAR + '\\s*)+', 'g'), (m) => VAR + (/\s$/.test(m) ? ' ' : ''));
  seg = norme(seg);
  // Les variables de bord ne servent a rien : « {0} Annuler » se lit « Annuler » si le bord est une balise fermee… on les garde,
  // sauf quand le segment n'est QUE cela.
  if (!seg || seg === VAR) return;
  if (!retenir(seg)) return;
  const e = vus.get(seg); if (e) e.n++; else vus.set(seg, { n: 1, ou });
}
function traiterChaine(s, ou) {
  // Hors des balises de style et de script embarquees.
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, COUPE).replace(/<script\b[\s\S]*?<\/script>/gi, COUPE).replace(/<svg\b[\s\S]*?<\/svg>/gi, COUPE).replace(/<!--[\s\S]*?-->/g, COUPE);
  let m; ATTRS.lastIndex = 0;
  while ((m = ATTRS.exec(s))) deposer(m[1] != null ? m[1] : m[2], ou);
  for (const seg of s.replace(/<[^<>]*>/g, COUPE).split(COUPE)) deposer(seg, ou);
}

// ── Le JavaScript ──────────────────────────────────────────────────────────
function aplatir(n) {
  if (!n) return [VAR];
  if (n.type === 'Literal') return typeof n.value === 'string' ? [n.value] : [VAR];
  if (n.type === 'TemplateLiteral') {
    const out = [];
    n.quasis.forEach((q, i) => { out.push(q.value.cooked == null ? '' : q.value.cooked); if (i < n.expressions.length) out.push(...aplatirDans(n.expressions[i])); });
    return out;
  }
  if (n.type === 'BinaryExpression' && n.operator === '+') return [...aplatir(n.left), ...aplatir(n.right)];
  return [VAR];
}
// Dans un gabarit, une expression qui est elle-meme une chaine s'aligne ; tout le reste est une variable.
const aplatirDans = (e) => (e.type === 'Literal' && typeof e.value === 'string') || e.type === 'TemplateLiteral' || (e.type === 'BinaryExpression' && e.operator === '+') ? aplatir(e) : [VAR];
const estChaine = (n) => (n.type === 'Literal' && typeof n.value === 'string') || n.type === 'TemplateLiteral' || (n.type === 'BinaryExpression' && n.operator === '+');
function extraireJs(fichier) {
  const src = fs.readFileSync(fichier, 'utf8');
  const arbre = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'script' });
  const nom = path.basename(fichier).replace(/\.\d+\.js$/, '.js');
  // Le numero de ligne d'une position, par dichotomie (le fichier fait 130 000 lignes).
  const debuts = [0]; for (let i = src.indexOf('\n'); i >= 0; i = src.indexOf('\n', i + 1)) debuts.push(i + 1);
  const ligne = (pos) => { let a = 0, b = debuts.length - 1; while (a < b) { const m = (a + b + 1) >> 1; if (debuts[m] <= pos) a = m; else b = m - 1; } return a + 1; };
  const visiter = (n, anc) => {
    const p = anc[anc.length - 2];
    // Maximal : pas un morceau d'une chaine plus grande.
    if (p && ((p.type === 'BinaryExpression' && p.operator === '+') || p.type === 'TemplateLiteral')) return;
    if (p) {
      // Une clef, une comparaison, un selecteur : pas un texte.
      if (p.type === 'BinaryExpression' && /^[!=]==?$/.test(p.operator)) return;
      if (p.type === 'SwitchCase' && p.test === n) return;
      if (p.type === 'Property' && p.key === n) return;
      if (p.type === 'MemberExpression' && p.property === n) return;
      if (p.type === 'CallExpression' && p.callee && p.callee.type === 'MemberExpression') {
        const f = p.callee.property && (p.callee.property.name || p.callee.property.value);
        const o = p.callee.object && p.callee.object.name;
        if (o === 'console' || /^(getElementById|querySelector|querySelectorAll|getAttribute|removeAttribute|hasAttribute|add|remove|toggle|contains|closest|matches|indexOf|includes|startsWith|endsWith|getItem|setItem|removeItem|addEventListener|removeEventListener|createElement|split|join|replace|test|match|localeCompare|toLocaleDateString|toLocaleString|toLocaleTimeString|ref|child)$/.test(String(f))) return;
        if (f === 'setAttribute' && p.arguments[0] === n) return;
      }
    }
    const morceaux = aplatir(n);
    if (!morceaux.some((x) => x !== VAR && /\p{L}{2,}/u.test(x))) return;
    traiterChaine(morceaux.join(''), nom + ':' + ligne(n.start));
  };
  walk.ancestor(arbre, { Literal: (n, a) => { if (typeof n.value === 'string') visiter(n, a); }, TemplateLiteral: visiter, BinaryExpression: (n, a) => { if (n.operator === '+' && (estChaine(n.left) || estChaine(n.right))) visiter(n, a); } });
}
// ── Le HTML statique ───────────────────────────────────────────────────────
function extraireHtml(fichier) {
  const h = fs.readFileSync(fichier, 'utf8');
  traiterChaine(h, path.relative(RACINE, fichier).replace(/\\/g, '/'));
}

const app = path.join(RACINE, 'app');
extraireJs(path.join(app, fs.readdirSync(app).find((f) => /^rc-core\.\d+\.js$/.test(f))));
extraireJs(path.join(app, 'motion-lab.js'));
extraireHtml(path.join(app, 'index.html'));
extraireHtml(path.join(RACINE, 'i', 'index.html'));

const liste = [...vus.entries()].map(([s, e]) => ({ s: s.split(VAR).map((x, i, t) => (i < t.length - 1 ? x + '{' + i + '}' : x)).join(''), motif: s.includes(VAR), n: e.n, ou: e.ou }));
liste.sort((a, b) => (a.s < b.s ? -1 : 1));
const exacts = liste.filter((x) => !x.motif).length;
console.log(liste.length + ' segments : ' + exacts + ' exacts, ' + (liste.length - exacts) + ' motifs ; ' + liste.reduce((t, x) => t + x.s.length, 0) + ' caracteres.');
if (sortie) fs.writeFileSync(sortie, JSON.stringify(liste, null, 0));
