// Lot D (identité produit, sobriété, ton, marque blanche, visuels, capture). Vrai code de l'appli.
//   TZ=Europe/Paris node --test club/tests/lotd.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const DIR = new URL('..', import.meta.url);
const lire = f => readFileSync(new URL(f, DIR), 'utf8');
const CSS = lire('pulse.css');
const JS = readdirSync(DIR.pathname).filter(f => f.endsWith('.js') && f !== 'sw.js').map(f => [f, lire(f)]);
const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] }, v: { id: 'v', first: 'Sam', last: 'B', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra, qui = 'u') => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.${qui};`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));
// Date figée dans le contexte de l'appli (today, curMonth et Date.now suivent).
const figer = (run, a, m, j, h = 10) => run(`(() => { const D0 = globalThis.__D0 || Date; globalThis.__D0 = D0; const T = new D0(${a}, ${m - 1}, ${j}, ${h}).getTime(); globalThis.Date = class extends D0 { constructor(...x) { if (x.length) super(...x); else super(T); } static now() { return T; } }; REV++; })()`);

test('feuille de styles : ni biais, ni dégradé radial, ni ombre de texte, ni flou, ni italique', () => {
  for (const m of ['skewX', 'radial-gradient', 'text-shadow', 'blur(']) assert.equal(CSS.split(m).length - 1, 0, m);
  assert.equal((CSS.match(/italic/g) || []).length, 0);
  assert.doesNotMatch(CSS, /Barlow|Montserrat|Anton/);
  assert.doesNotMatch(lire('fonts.css'), /Barlow|Montserrat|Anton/);
});
test('échelle typographique : 12, 13, 14, 16, 20, 24, 32 seulement', () => {
  const tailles = new Set([...CSS.matchAll(/font(?:-size)?:[^;}]*?(\d+)px/g)].map(m => Number(m[1])).concat([...CSS.matchAll(/var\(--t-(\d+)\)/g)].map(m => Number(m[1]))));
  for (const t of tailles) assert.ok([12, 13, 14, 16, 20, 24, 32].includes(t), `taille ${t}px hors échelle`);
});
test('capitales réservées à .eyebrow et .label (et au champ du code)', () => {
  const regles = CSS.split('\n').filter(l => /text-transform:\s*uppercase/.test(l));
  for (const r of regles) assert.match(r, /^\s*(\.eyebrow|\.login2 \.code-input)/, r.slice(0, 80));
});
test('jetons produit : clair par défaut, sombre par préférence et par choix', () => {
  assert.match(CSS, /--fp-ink: #15171C; --fp-graphite: #3A3F4A; --fp-grey: #5E6470; --fp-line: #E4E5E8; --fp-bg: #F6F6F4; --fp-surface: #FFFFFF; --fp-signal: #2B4BDB;/);
  assert.match(CSS, /@media \(prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\)/);
  assert.match(CSS, /:root\[data-theme="dark"\] \{ --bg: #0F1115; --surface: #171A20; --surface-2: #1E222A; --line: #262A33; --text: #ECEDEF; --muted: #9AA0AB; --fp-signal: #7D93FF; --ok: #3FB36B; --warn: #E09A3E; --bad: #F0645A;/);
});
test('contrastes des jetons : texte et texte secondaire à 4,5:1 au moins, clair et sombre', () => {
  const run = chargerAppli(base());
  for (const [t, f] of [['#15171C', '#F6F6F4'], ['#5E6470', '#F6F6F4'], ['#5E6470', '#FFFFFF'], ['#2B4BDB', '#FFFFFF'], ['#ECEDEF', '#0F1115'], ['#9AA0AB', '#171A20'], ['#7D93FF', '#171A20'], ['#157F3B', '#FFFFFF'], ['#A15C00', '#FFFFFF'], ['#B42318', '#FFFFFF'], ['#3FB36B', '#171A20'], ['#E09A3E', '#171A20'], ['#F0645A', '#171A20']]) {
    const c = run(`contraste('${t}', '${f}')`); assert.ok(c >= 4.5, `${t} sur ${f} : ${c.toFixed(2)}`);
  }
});
test('anciens noms PARKPULSE_* et parkpulse.* : seulement dans les replis', () => {
  for (const [f, s] of JS) for (const l of s.split('\n').filter(x => /parkpulse/i.test(x))) assert.match(l, /Repli|const CFG = window\.FITPULSE_CONFIG|startsWith\('parkpulse\.'\)/, `${f} : ${l.trim().slice(0, 90)}`);
  assert.doesNotMatch(lire('index.html'), /parkpulse/i);
});
test('jaune historique (#FFD600, #FFD200) : seulement dans la migration et la scène de capture', () => {
  for (const [f, s] of JS) for (const l of s.split('\n').filter(x => /#?FFD[26]00/i.test(x))) assert.ok(/ni\.theme|captureThemes|const L = \[\['FFD600'|accents FFD600/.test(l), `${f} : ${l.trim().slice(0, 90)}`);
  assert.doesNotMatch(CSS, /FFD[26]00/i);
});
test('accent du club : texte du bouton et texte coloré à 4,5:1, en clair et en sombre', () => {
  const run = chargerAppli(base());
  for (const a of ['#FFD600', '#F28C00', '#D6004C', '#0066B3', '#2B4BDB', '#7C3AED', '#12B3A8']) for (const sombre of [false, true]) {
    const v = J(run, `accentVars('${a}', ${sombre})`);
    assert.ok(run(`contraste('${v['--accent']}', '${v['--accent-ink']}')`) >= 4.5, `${a} bouton ${sombre ? 'sombre' : 'clair'}`);
    assert.ok(run(`contraste('${v['--accent-text']}', '${sombre ? '#171A20' : '#FFFFFF'}')`) >= 4.5, `${a} texte ${sombre ? 'sombre' : 'clair'} : ${v['--accent-text']}`);
  }
});
test('résolution du thème : club, puis réseau, puis produit ; migration du club historique', () => {
  const run = appli({ org: { id: 'o', name: 'Réseau', theme: { accent: '#0066B3' } }, clubs: { k: { id: 'k', name: 'Club' }, niort: { id: 'niort', name: 'Club historique' } } });
  assert.equal(run('accentDe(S.clubs.k)'), '#0066B3');
  run(`S.clubs.k.theme = { accent: '#D6004C', displayName: 'Club Sud' }; REV++`);
  assert.equal(run('accentDe(S.clubs.k)'), '#D6004C'); assert.equal(run('nomAffiche(S.clubs.k)'), 'Club Sud');
  assert.deepEqual(J(run, 'S.clubs.niort.theme'), { displayName: 'Club historique', accent: '#FFD600', logo: null });
  const vide = appli({}); assert.equal(vide('accentDe(S.clubs.k)'), null);
});
test('couleur proche d’un statut : avertissement', () => {
  const run = chargerAppli(base());
  assert.equal(run(`procheStatut('#1FA34A')`), 'ok'); assert.equal(run(`procheStatut('#C0281C')`), 'bad'); assert.equal(run(`procheStatut('#0066B3')`), null); assert.equal(run(`procheStatut('#808080')`), null);
});
test('logo SVG : script et attributs d’événement refusés avec un message clair', () => {
  const run = chargerAppli(base());
  assert.match(run(`svgRefus('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')`), /SVG refusé : il contient du script/);
  assert.match(run(`svgRefus('<svg onload="x()"><rect/></svg>')`), /SVG refusé/);
  assert.match(run(`svgRefus('<svg><a href="javascript:x()"><rect/></a></svg>')`), /SVG refusé/);
  assert.equal(run(`svgRefus('<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#000"/></svg>')`), '');
  assert.match(run(`svgRefus('<html></html>')`), /pas un SVG/);
});
test('chiffres avec leur unité : fmtU', () => {
  const run = chargerAppli(base());
  assert.equal(run(`fmtU(30, 'contrats')`), '30 contrats'); assert.equal(run(`fmtU(1, 'contrats')`), '1 contrat'); assert.equal(run(`fmtU(1, 'avis')`), '1 avis');
  assert.equal(run(`fmtU(1240, 'nutrition')`).replace(/\s/g, ' '), '1 240 €');
});
test('phrases de rythme : « Il manque… au jj/mm » et « En avance de… »', () => {
  const run = chargerAppli(base());
  assert.equal(run(`paceMessage({ k: S.kpis.contrats, real: 3, target: 20, pct: 0.15 }, 0.29, '2026-10-09')`), 'Il manque 3 contrats pour tenir le rythme au 09/10');
  assert.equal(run(`paceMessage({ k: S.kpis.contrats, real: 9, target: 20, pct: 0.45 }, 0.29, '2026-10-09')`), 'En avance de 3 contrats sur le rythme');
});
test('projection des paliers : pas avant le 5 du mois', () => {
  const run = appli({ paliers: { k: { '2026-10': { contrats: [{ target: 30 }] } } }, entries: { e1: { id: 'e1', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-10-01', value: 1, source: 'manual' } } });
  figer(run, 2026, 10, 1);
  const h = run(`palierRace('k', '2026-10', 'contrats')`);
  assert.doesNotMatch(h, /class="c-proj"/); assert.match(h, /Projection disponible le 5/); assert.match(h, /P1 : 30 contrats/);
  figer(run, 2026, 10, 9); assert.match(run(`palierRace('k', '2026-10', 'contrats')`), /class="c-proj"/);
});
test('entonnoir des résiliations : zéro, pas de barre ; le nombre reste', () => {
  const run = appli({ resiliations: { r1: { id: 'r1', clubId: 'k', client: 'A', date: '2026-10-02', status: 'nouvelle' } } });
  const h = run(`resFunnel('k', '2026-10')`);
  assert.equal((h.match(/<i style="width:/g) || []).length, 1); assert.match(h, /0 dossier/);
});
test('compte à rebours en jours ouvrés restants', () => {
  const run = chargerAppli(base());
  assert.equal(run(`compteRebours('2026-10-09').texte`), '20 jours ouvrés restants');
});
test('textes affichés : ni « ! », ni termes de jeu ou anciens libellés', () => {
  const req = createRequire(import.meta.url); let acorn; try { acorn = req('/opt/node-tools/node_modules/acorn'); } catch (e) { acorn = null; }
  const interdits = /pour être dans les temps|étape des|Mission accomplie|Rookie|Warrior|RISING|STARTER|Toucher pour continuer|glisser-déposer \(poignée\)|météo des paliers|Un toucher = enregistré|Belle journée|Série en cours, continuez/;
  for (const [f, s] of JS) {
    assert.doesNotMatch(s, interdits, f);
    assert.doesNotMatch(s, /mascot\(|moodOf\(|tierName|saisies-tab/, f);
    if (!acorn) continue;
    const walk = req('/opt/node-tools/node_modules/acorn-walk'); const ast = acorn.parse(s, { ecmaVersion: 'latest' });
    walk.full(ast, n => { const t = n.type === 'Literal' && typeof n.value === 'string' ? n.value : n.type === 'TemplateElement' ? n.value.cooked : null; if (t) assert.doesNotMatch(t, /[A-Za-zÀ-ÿ0-9)»’.]\s?!(?!=|important)(\s|$|<|['"`»)])/, `${f} : ${t.slice(0, 60)}`); });
  }
});
test('toasts de résultat : un nombre ou un nom, jamais de « ! »', () => {
  const resultat = /(enregistr|ajout|copi|créé|appliqu|effac|publi|rétabli|restaur|partag|noté|réparti|archiv|réactiv|validé|rattach|prêt|terminé|transmis|remis|pris en compte|mis à jour|annulé|sauvé|récupéré)/i;
  const erreur = /non enregistr|rien à|impossible|invalide|obligatoire|refus|incorrect|choisissez|indiquez|saisissez|renseignez|ajoutez d|seul |gardez|complétez|pas de |aucun|vous ne|il faut|cette |sélectionné/i;
  for (const [f, s] of JS) for (const m of s.matchAll(/\b(toast|toastUndo)\(\s*(['`])((?:\\.|(?!\2).)*)\2/g)) {
    const t = m[3]; assert.doesNotMatch(t, /!/, `${f} : ${t}`);
    if (resultat.test(t) && !erreur.test(t)) assert.match(t, /\d|\$\{/, `${f} : toast sans nombre ni nom « ${t} »`);
  }
});
test('célébration : seulement le palier d’équipe, une fois par palier et par mois ; le reste en toasts', () => {
  const run = appli({}); run(`globalThis.T = []; toast = m => T.push(m); globalThis.N = 0; document.body.appendChild = () => { N++; }; document.createElement = () => ({ style: {}, dataset: {}, setAttribute() {}, addEventListener() {}, remove() {}, innerHTML: '' }); setTimeout = () => 0;`);
  run(`celebrate('Palier 1 atteint', 'Contrats signés : 30 contrats', { kind: 'team', cle: ['k', '2026-10', 'contrats', 1] })`);
  run(`celebrate('Palier 1 atteint', 'Contrats signés : 30 contrats', { kind: 'team', cle: ['k', '2026-10', 'contrats', 1] })`);
  assert.equal(run('N'), 1); assert.equal(run(`S.celebrated.k['2026-10'].contrats`), 1);
  run(`celebrate('Impayé récupéré', '120 €, Léa Martin', { kind: 'win' }); celebrate('Impayé récupéré', '45 €, Paul Roy', { kind: 'win' }); celebrate('Client sauvé', 'Léa Martin reste au club', { kind: 'win' })`);
  assert.equal(run('N'), 1); assert.equal(run('T.length'), 3); assert.match(run('T[0]'), /^Impayé récupéré : 120/);
});
test('réactions Bravo, Fort, Merci : les anciennes (pictogrammes, Vu, Question) sont reprises sans perte', () => {
  const run = appli({});
  const r = J(run, `reactionsDe({ '\\u{1F525}': { a: true }, '\\u{1F4AA}': { b: true, a: true }, '\\u{1F44F}': { c: true }, '\\u{1F44D}': { d: true }, question: { e: true }, vu: { f: 1 } })`);
  assert.deepEqual(r, { bravo: ['c'], fort: ['a', 'b'], merci: ['d', 'e', 'f'] });
  run(`S.reactions.x = { '\\u{1F525}': { u: true } }; REV++`);
  const ops = J(run, `reactOps(['reactions', 'x'], S.reactions.x, 'fort')`);
  assert.deepEqual(ops, [[['reactions', 'x', 'fort', 'u'], null], [['reactions', 'x', '\u{1F525}', 'u'], null]]);
  const h = run(`reactBtns('react', 'x', { bravo: { u: 1 } })`);
  assert.match(h, /Bravo <span class="num">1<\/span>/); assert.match(h, /data-noms="Bravo : /); assert.doesNotMatch(h, /\p{Extended_Pictographic}/u);
});
test('niveaux : Recrue, Confirmé, Expert, Référent ; insignes 24 et 64 px', () => {
  const run = chargerAppli(base());
  assert.deepEqual(J(run, 'LEVELS.map(l => [l.label, l.min])'), [['Recrue', 0], ['Confirmé', 2], ['Expert', 6], ['Référent', 12]]);
  assert.equal(run('zoneDe(3).label'), 'Confirmé');
  assert.match(run(`zoneBadge(zoneDe(12), 64)`), /width="64"[\s\S]*var\(--accent\)/);
});
test('états vides : image, phrase et bouton', () => {
  const run = chargerAppli(base());
  const h = run(`emptyState({ img: 'eur', title: 'Aucun dossier', text: 'Rien à relancer.', action: '<a class="btn sm" href="#/imports">Ouvrir</a>' })`);
  assert.match(h, /empty-img e3/); assert.match(h, /empty-t">Aucun dossier/); assert.match(h, /<p>Rien à relancer\.<\/p>/); assert.match(h, /class="btn sm"/);
  const appels = JS.flatMap(([, s]) => [...s.matchAll(/emptyBox\(\{ art: '\w+'/g)]); assert.ok(appels.length >= 16, `${appels.length} états vides`);
  assert.equal(typeof run('emptyState()'), 'object'); // sans argument : l'état initial de la base
});
test('visuels de marque : chaque PNG sous 120 Ko, icônes de navigation redessinées', () => {
  const dir = new URL('assets/brand/', DIR);
  for (const f of readdirSync(dir)) if (/\.(png|webp)$/.test(f)) assert.ok(statSync(new URL(f, dir)).size < 120 * 1024, f);
  const run = chargerAppli(base());
  for (const k of ['home', 'target', 'ranking', 'callback', 'door', 'coinsback', 'magnet', 'import', 'team', 'chat', 'flag', 'report']) assert.ok(run(`ICONS.${k}`).length > 20, k);
  assert.deepEqual(J(run, `NAV.filter(n => ['home', 'relances', 'leaderboard', 'resiliations', 'impayes', 'loyalty', 'imports'].includes(n[0])).map(n => n[2])`), ['home', 'callback', 'ranking', 'door', 'coinsback', 'magnet', 'import']);
});
test('droits : un manager voit les résiliations et impayés ; un commercial ne voit que ses dossiers', () => {
  const extra = { resiliations: { r1: { id: 'r1', clubId: 'k', client: 'A', date: '2026-10-02', status: 'nouvelle', ownerId: 'v' }, r2: { id: 'r2', clubId: 'k', client: 'B', date: '2026-10-03', status: 'nouvelle', ownerId: 'u' } },
    clients: { c1: { id: 'c1', clubId: 'k', name: 'C', balance: 50, dunning: { ownerId: 'v' } }, c2: { id: 'c2', clubId: 'k', name: 'D', balance: 80 } } };
  const m = appli(extra, 'u'); assert.equal(J(m, `resList('k').filter(mesDossiersRes).length`), 2); assert.equal(J(m, `dunRows('k').filter(mesDossiersDun).length`), 2);
  const c = appli(extra, 'v'); assert.deepEqual(J(c, `resList('k').filter(mesDossiersRes).map(r => r.id)`), ['r1']); assert.deepEqual(J(c, `dunRows('k').filter(mesDossiersDun).map(x => x.id)`), ['c1']);
});
test('mode capture : jeu fictif conforme (1 club, 6 commerciaux, 40 adhérents, 7 résiliations dont 2 à 7 jours, impayés de 29 à 240 €)', () => {
  const run = chargerAppli(base()); figer(run, 2026, 10, 13, 9);
  const st = J(run, `(() => { const s = captureState(); const res = Object.values(s.resiliations).filter(r => /^r\\d+$/.test(r.id));
    return { clubs: Object.values(s.clubs).map(c => c.name), membres: Object.values(s.users).filter(u => u.role === 'membre').length, clients: Object.keys(s.clients).length,
      res: res.length, urgentes: res.filter(r => r.effective <= addDays('2026-10-13', 7)).length, imp: Object.values(s.clients).filter(c => c.balance > 0).map(c => c.balance), noms: Object.values(s.users).map(u => u.first + ' ' + u.last) }; })()`);
  assert.deepEqual(st.clubs, ['Club Démo Centre']); assert.equal(st.membres, 6); assert.equal(st.clients, 40); assert.equal(st.res, 7); assert.equal(st.urgentes, 2);
  assert.equal(Math.min(...st.imp), 29); assert.equal(Math.max(...st.imp), 240);
  assert.ok(!st.noms.some(n => /GUELLEC|Kévin/i.test(n)));
  assert.doesNotMatch(run(`JSON.stringify(captureState())`), /Fitness Park|Niort|FPN|GUELLEC/);
});
