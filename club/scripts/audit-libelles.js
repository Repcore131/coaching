#!/usr/bin/env node
/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — inventaire des libellés à renommer ════════════════════════════
// Lit le fichier HTML unique de Fit Pulse (node club/outils/build-single.mjs),
// extrait toutes les chaînes de l'interface (textes du HTML, chaînes entre
// guillemets, apostrophes et accents graves du JavaScript : fonctions render,
// NAV, DEFAULT_KPIS, DEFAULT_TASKS, LEVELS, titres des pages, toasts, modales…)
// et les compare à la liste des termes interdits, sans tenir compte de la casse
// ni des accents. Ne modifie rien.
//   node scripts/audit-libelles.js fitpulse.html [sortie.csv]
// Sortie : scripts/libelles-a-renommer.csv (chaîne ; ligne ; fonction ; terme interdit trouvé).
// Un terme présent ailleurs (commentaire, nom de variable) est aussi listé, avec
// la fonction « hors interface », pour que l'inventaire soit complet.
'use strict';
const fs = require('fs');
const path = require('path');

const INTERDITS = ['Rookie', 'Performer', 'Warrior', 'Légende', 'ELITE', 'RISING', 'STARTER', 'Action Rétention', 'Défis flash', 'Feed', 'Mes clubs', 'Bilan du jour',
  'Mission accomplie', 'restants en', 'pour être dans les temps', 'avant l\'étape des', 'En léger retard', 'Très en retard', 'Organigramme', 'Historique des saisies', 'Récaps',
  'Matching', 'Déposer un fichier CSV', 'Enregistrement automatique', 'Rien à traiter sur cette vue', 'base nette', 'clients actifs nets', 'un grand club n\'est pas avantagé',
  'mini-défi', 'Ton score global', 'Ton meilleur KPI', 'Tes trophées', 'Ton résumé', 'À mi-chemin', 'Accomplissements', 'Premier 100', 'Bandeau en direct', 'Champion',
  'Invités > Contrats', 'Homme 1', 'Femme 1', 'glisser-déposer', 'Check passage du matin', 'Wizville', 'Pilotage commercial'];

// Comparaison sans casse ni accents, apostrophes et espaces unifiés.
const plat = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘`´]/g, '\'').replace(/[  \s]+/g, ' ').toLowerCase();
const motif = t => new RegExp(`(^|[^a-z0-9])${plat(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`);
const MOTIFS = INTERDITS.map(t => ({ t, re: motif(t) }));
const trouves = s => { const p = plat(s); return MOTIFS.filter(m => m.re.test(p)).map(m => m.t); };

// ── Lecture du JavaScript : chaînes, gabarits, commentaires, expressions régulières ──
function chaines(src, ligne0, onStr, onAutre) {
  let i = 0, ligne = ligne0; const n = src.length; let dernier = ''; // dernier jeton significatif (expression régulière ou division)
  const avance = c => { if (c === '\n') ligne++; };
  const lireChaine = q => { const deb = ligne; let out = ''; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { out += src[i + 1] === 'n' ? '\n' : src[i + 1]; avance(src[i + 1]); i += 2; continue; } avance(src[i]); out += src[i++]; } i++; return { out, deb }; };
  const lireGabarit = () => {
    // morceaux de texte d'un gabarit ; les ${…} sont lus récursivement (chaînes imbriquées comprises)
    const deb = ligne; let out = ''; i++;
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { out += src[i + 1]; avance(src[i + 1]); i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { out += '…'; i += 2; let prof = 1; const debExpr = i; while (i < n && prof > 0) { const c = src[i]; if (c === '{') prof++; else if (c === '}') { prof--; if (!prof) break; } else if (c === '\'' || c === '"') { const s = lireChaine(c); onStr(s.out, s.deb); continue; } else if (c === '`') { const s = lireGabarit(); onStr(s.out, s.deb); continue; } else if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; } avance(c); i++; } void debExpr; i++; continue; }
      avance(src[i]); out += src[i++];
    }
    i++; return { out, deb };
  };
  while (i < n) {
    const c = src[i];
    if (c === '\n') { ligne++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { const d = i; while (i < n && src[i] !== '\n') i++; onAutre(src.slice(d, i), ligne); continue; }
    if (c === '/' && src[i + 1] === '*') { const d = i, dl = ligne; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { avance(src[i]); i++; } i += 2; onAutre(src.slice(d, i), dl); continue; }
    if (c === '\'' || c === '"') { const s = lireChaine(c); onStr(s.out, s.deb); dernier = 'v'; continue; }
    if (c === '`') { const s = lireGabarit(); onStr(s.out, s.deb); dernier = 'v'; continue; }
    if (c === '/' && !/[\w)\]$]/.test(dernier)) { // expression régulière
      i++; let cl = false; while (i < n && (src[i] !== '/' || cl)) { if (src[i] === '\\') i++; else if (src[i] === '[') cl = true; else if (src[i] === ']') cl = false; else if (src[i] === '\n') break; i++; } i++; while (/[a-z]/i.test(src[i] || '')) i++; dernier = 'v'; continue;
    }
    if (!/\s/.test(c)) dernier = c;
    if (/[A-Za-z_$]/.test(c)) { const d = i; while (i < n && /[\w$]/.test(src[i])) i++; const mot = src.slice(d, i); onAutre(mot, ligne, true); dernier = 'w'; continue; }
    i++;
  }
}
// Fonction englobante : la dernière déclaration vue au-dessus de la ligne.
function indexFonctions(src, ligne0) {
  const L = []; const re = /(?:^|\n)[ \t]*(?:async\s+)?function\s+([\w$]+)|(?:^|\n)[ \t]*(PAGES\.[\w$]+|ACTIONS\.[\w$]+)\s*=|(?:^|\n)[ \t]*(?:const|let|var)\s+([A-Z_][A-Z0-9_]+|[\w$]+)\s*=\s*(?:\(|async|\[|\{|[\w$]+\s*=>)|(?:^|\n)[ \t]+(render|mount)\s*\(/g;
  let m; while ((m = re.exec(src))) { const nom = m[1] || m[2] || m[3] || m[4]; const l = ligne0 + src.slice(0, m.index + (m[0].startsWith('\n') ? 1 : 0)).split('\n').length - 1; L.push([l, m[4] && L.length ? `${L[L.length - 1][1].split('.')[0].replace(/\s.*/, '')}.${m[4]}` : nom]); }
  return l => { let r = 'niveau du fichier'; for (const [x, nom] of L) { if (x > l) break; r = nom; } return r; };
}
// Une chaîne d'interface : du texte (au moins une lettre), pas un sélecteur, un chemin ou du CSS.
const estTexte = s => /\p{L}/u.test(s) && !/^[#.]?[\w-]+$/.test(s.trim()) || /^[A-ZÀ-Ý][\p{L}]+$/u.test(s.trim());

function auditer(html) {
  const out = []; const vu = new Set();
  const ajoute = (chaine, ligne, fonction, termes) => termes.forEach(t => { const k = `${ligne}|${t}|${chaine}`; if (!vu.has(k)) { vu.add(k); out.push({ chaine: chaine.replace(/\s+/g, ' ').trim().slice(0, 300), ligne, fonction, terme: t }); } });
  const reScript = /<script\b[^>]*>([\s\S]*?)<\/script>/gi; let m; let fin = 0; const morceauxHtml = [];
  while ((m = reScript.exec(html))) { morceauxHtml.push([fin, m.index]); const debut = m.index + m[0].indexOf('>') + 1; const ligne0 = html.slice(0, debut).split('\n').length; const js = m[1]; const fn = indexFonctions(js, ligne0);
    chaines(js, ligne0, (s, l) => { const t = trouves(s); if (t.length) ajoute(s, l, estTexte(s) ? fn(l) : `${fn(l)} (code)`, t); }, (s, l, ident) => { const t = trouves(ident ? s.replace(/([a-z])([A-Z])/g, '$1 $2') : s); if (t.length) ajoute(s, l, 'hors interface', t); });
    fin = reScript.lastIndex; }
  morceauxHtml.push([fin, html.length]);
  // Texte du HTML hors scripts (titre, méta, balises).
  for (const [a, b] of morceauxHtml) { const bloc = html.slice(a, b); bloc.split('\n').forEach((x, k) => { const texte = x.replace(/<[^>]+>/g, ' ') + ' ' + [...x.matchAll(/(?:content|title|alt|placeholder|aria-label)="([^"]*)"/g)].map(y => y[1]).join(' '); const t = trouves(texte); if (t.length) ajoute(texte, html.slice(0, a).split('\n').length + k, 'HTML', t); }); }
  return out.sort((x, y) => x.ligne - y.ligne);
}
const csv = rows => ['chaîne;ligne;fonction;terme interdit trouvé', ...rows.map(r => [r.chaine, r.ligne, r.fonction, r.terme].map(v => { const s = String(v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(';'))].join('\n') + '\n';

if (require.main === module) {
  const fichier = process.argv[2]; if (!fichier) { console.error('Usage : node scripts/audit-libelles.js fitpulse.html [sortie.csv]'); process.exit(2); }
  const html = fs.readFileSync(fichier, 'utf8'); const rows = auditer(html);
  const sortie = process.argv[3] || path.join(__dirname, 'libelles-a-renommer.csv'); fs.writeFileSync(sortie, csv(rows));
  const parTerme = {}; rows.forEach(r => { parTerme[r.terme] = (parTerme[r.terme] || 0) + 1; });
  const presents = INTERDITS.filter(t => motif(t).test(plat(html)));
  const manques = presents.filter(t => !parTerme[t]);
  console.log(`${rows.length} occurrence(s) de ${Object.keys(parTerme).length} terme(s) interdit(s) → ${sortie}`);
  Object.entries(parTerme).sort((a, b) => b[1] - a[1]).forEach(([t, k]) => console.log(`  ${t} : ${k}`));
  if (manques.length) { console.error('Termes présents dans le fichier mais non relevés : ' + manques.join(', ')); process.exit(1); }
  process.exitCode = rows.some(r => !/hors interface|\(code\)/.test(r.fonction)) ? 3 : 0; // 3 : termes interdits encore visibles
}
module.exports = { auditer, INTERDITS, plat, trouves };
