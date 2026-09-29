// ══════════════════════════════════════════════════════════════════════════
//  UN DOCUMENT DE docs/offre EN PDF
// ══════════════════════════════════════════════════════════════════════════
//
//  POURQUOI CE SCRIPT EXISTE. Les PDF de docs/offre ont tous ete imprimes par
//  Chrome (leur producteur dit « Skia/PDF »), a la main, un par un. Le jour ou
//  le texte change, personne ne sait plus comment refaire le PDF — et le PDF
//  ment pendant des mois a cote de son Markdown a jour.
//
//      node scripts/doc_pdf.mjs docs/offre/DEFIS_AMIS.md
//
//  Il rend DEFIS_AMIS.pdf a cote, et garde le HTML intermediaire en memoire :
//  rien d'autre n'arrive sur le disque.
//
//  ⚠ LE MARKDOWN RECONNU EST UN SOUS-ENSEMBLE, et c'est deliberé : titres,
//    paragraphes, listes, tableaux, blocs de code, gras, italique, code en
//    ligne, liens, traits. Assez pour ces documents, assez peu pour tenir en
//    cent lignes qu'on relit.
//
//  ⚠ AUCUNE DEPENDANCE. Ni npm, ni reseau : Chrome est deja la (le banc s'en
//    sert), et il sait imprimer.
// ══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SRC = process.argv[2];
if (!SRC) { console.error('  Usage : node scripts/doc_pdf.mjs <fichier.md>'); process.exit(2); }
const MD = fs.readFileSync(SRC, 'utf8');
const SORTIE = SRC.replace(/\.md$/i, '') + '.pdf';

// ── LE MARKDOWN, EN HTML ────────────────────────────────────────────────
const ech = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Les marques en ligne, dans cet ordre : le code d'abord, pour qu'un `*` dans
// du code ne devienne pas de l'italique.
function ligne(s) {
  const codes = [];
  let t = ech(s).replace(/`([^`]+)`/g, (m, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return t.replace(/\u0000(\d+)\u0000/g, (m, i) => '<code>' + codes[Number(i)] + '</code>');
}
function enHtml(md) {
  const out = [];
  const l = md.replace(/\r\n/g, '\n').split('\n');
  let i = 0, liste = null;
  const fermer = () => { if (liste) { out.push('</' + liste + '>'); liste = null; } };
  while (i < l.length) {
    const x = l[i];
    if (/^```/.test(x)) {
      fermer(); const bloc = [];
      i++; while (i < l.length && !/^```/.test(l[i])) bloc.push(l[i++]);
      i++; out.push('<pre>' + ech(bloc.join('\n')) + '</pre>'); continue;
    }
    if (/^\|/.test(x) && /^\|[\s:|-]+\|?\s*$/.test(l[i + 1] || '')) {
      fermer();
      const cell = r => r.replace(/^\||\|$/g, '').split('|').map(c => ligne(c.trim()));
      out.push('<table><thead><tr>' + cell(x).map(c => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>');
      i += 2;
      while (i < l.length && /^\|/.test(l[i])) out.push('<tr>' + cell(l[i++]).map(c => '<td>' + c + '</td>').join('') + '</tr>');
      out.push('</tbody></table>'); continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(x);
    if (h) { fermer(); const n = h[1].length; out.push('<h' + n + '>' + ligne(h[2]) + '</h' + n + '>'); i++; continue; }
    if (/^---+\s*$/.test(x)) { fermer(); out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(x)) { fermer(); out.push('<blockquote>' + ligne(x.replace(/^>\s?/, '')) + '</blockquote>'); i++; continue; }
    const li = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(x);
    if (li) {
      const type = /\d/.test(li[1]) ? 'ol' : 'ul';
      if (liste !== type) { fermer(); out.push('<' + type + '>'); liste = type; }
      out.push('<li>' + ligne(li[2]) + '</li>'); i++; continue;
    }
    if (!x.trim()) { fermer(); i++; continue; }
    fermer();
    const p = [x]; i++;
    while (i < l.length && l[i].trim() && !/^(#{1,4}\s|```|\||>|\s*([-*]|\d+\.)\s|---+\s*$)/.test(l[i])) p.push(l[i++]);
    out.push('<p>' + ligne(p.join(' ')) + '</p>');
  }
  fermer();
  return out.join('\n');
}

// ── LA FEUILLE DE STYLE ─────────────────────────────────────────────────
// Le rouge de l'app, du papier blanc, et des titres qui ne se coupent pas en
// bas de page. Segoe UI et Consolas : les memes que les PDF deja publies.
const STYLE = `
@page { size: A4; margin: 17mm 16mm 16mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", system-ui, sans-serif; color: #1a1a1a; font-size: 10.5pt;
  line-height: 1.55; margin: 0; }
h1 { font-size: 21pt; font-weight: 900; letter-spacing: -.4pt; margin: 0 0 2mm;
  text-transform: uppercase; color: #0d0d0d; }
h1 + p em, h1 + p { color: #6b6b6b; font-size: 9pt; margin: 0 0 6mm; }
h2 { font-size: 13pt; font-weight: 800; margin: 9mm 0 3mm; padding-bottom: 1.5mm;
  border-bottom: 2px solid #e02020; text-transform: uppercase; letter-spacing: .3pt;
  break-after: avoid; }
h3 { font-size: 11pt; font-weight: 800; margin: 6mm 0 2mm; color: #b4121a; break-after: avoid; }
h4 { font-size: 10pt; font-weight: 700; margin: 4mm 0 1.5mm; color: #333; break-after: avoid; }
p { margin: 0 0 3mm; text-align: justify; }
ul, ol { margin: 0 0 3mm; padding-left: 6mm; }
li { margin-bottom: 1.2mm; }
strong { color: #0d0d0d; }
code { font-family: Consolas, "Courier New", monospace; font-size: 9pt; background: #f2f2f2;
  padding: .3mm 1mm; border-radius: 1mm; color: #a01018; }
pre { font-family: Consolas, "Courier New", monospace; font-size: 8.5pt; background: #f7f7f7;
  border-left: 2.5mm solid #e02020; padding: 3mm 4mm; margin: 0 0 4mm; white-space: pre-wrap;
  line-height: 1.45; break-inside: avoid; }
pre code { background: none; padding: 0; color: #1a1a1a; }
table { width: 100%; border-collapse: collapse; margin: 0 0 4mm; font-size: 9pt; break-inside: avoid; }
th { background: #1a1a1a; color: #fff; text-align: left; padding: 2mm 2.5mm; font-weight: 700;
  font-size: 8.5pt; text-transform: uppercase; letter-spacing: .3pt; }
td { padding: 2mm 2.5mm; border-bottom: .5px solid #ddd; vertical-align: top; }
tr:nth-child(even) td { background: #fafafa; }
blockquote { margin: 0 0 4mm; padding: 2.5mm 4mm; background: #fff6f6; border-left: 2.5mm solid #e02020;
  color: #4a1a1a; break-inside: avoid; }
hr { border: none; border-top: .5px solid #ddd; margin: 6mm 0; }
a { color: #b4121a; text-decoration: none; }
h2, h3, h4, table, pre, blockquote { page-break-inside: avoid; }
`;

const HTML = '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">'
  + '<title>' + ech(path.basename(SRC, '.md')) + '</title><style>' + STYLE + '</style></head><body>'
  + enHtml(MD) + '</body></html>';

// ── CHROME IMPRIME ──────────────────────────────────────────────────────
const PORT = 9700 + Math.floor(Math.random() * 200);
const prof = path.join(process.env.TEMP || '.', 'profil-docpdf-' + PORT);
fs.rmSync(prof, { recursive: true, force: true });
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${prof}`, '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

let seq = 0;
const send = await (async () => {
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/version`); break; } catch (e) { await new Promise(r => setTimeout(r, 250)); } }
  const lst = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const ws = new WebSocket(lst.find(x => x.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const att = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { const { r, j } = att.get(m.id); att.delete(m.id); m.error ? j(new Error(m.error.message)) : r(m.result); } };
  return (method, params = {}) => new Promise((r, j) => { const id = ++seq; att.set(id, { r, j }); ws.send(JSON.stringify({ id, method, params })); });
})();
await send('Page.enable');
// Par data: URL — rien n'est ecrit sur le disque, et Chrome n'a aucun serveur
// a joindre.
await send('Page.navigate', { url: 'data:text/html;charset=utf-8,' + encodeURIComponent(HTML) });
await new Promise(r => setTimeout(r, 1200));
const pdf = await send('Page.printToPDF', {
  printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-size:7pt;color:#999;font-family:Segoe UI,sans-serif;'
    + 'padding:0 16mm;display:flex;justify-content:space-between">'
    + '<span>' + ech(path.basename(SRC, '.md')).replace(/_/g, ' ') + ' · RepCore</span>'
    + '<span class="pageNumber"></span></div>',
});
fs.writeFileSync(SORTIE, Buffer.from(pdf.data, 'base64'));
const ko = Math.round(fs.statSync(SORTIE).size / 1024);
console.log('  ' + SORTIE + '  (' + ko + ' Ko)');

// ⚠ ON REGARDE CE QU'ON LIVRE. Un PDF ne se relit pas dans un terminal :
//   `--apercu` rend la page en A4 a l'ecran et en garde une image, la seule
//   facon de voir qu'un tableau deborde ou qu'un titre est seul en bas de page.
if (process.argv.includes('--apercu')) {
  const PNG = SORTIE.replace(/\.pdf$/, '') + '-apercu.png';
  await send('Emulation.setDeviceMetricsOverride',
    { width: 794, height: 1123, deviceScaleFactor: 1.4, mobile: false });
  await new Promise(r => setTimeout(r, 700));
  const img = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  fs.writeFileSync(PNG, Buffer.from(img.data, 'base64'));
  console.log('  ' + PNG);
}
try { chrome.kill(); } catch (e) {}
process.exit(0);
