#!/usr/bin/env node
// ══ CE QUE L'ASSISTANT DE LA PAGE D'ACCUEIL A LE DROIT DE DIRE ═════════════
//
// POURQUOI (11/10/2026). L'assistant de questions-réponses (cloudflare/src/
// chat.js) ne répond qu'à partir de ce texte. Écrit à la main, il dirait un
// jour un prix que tarifs.json ne dit plus. Il est donc FABRIQUÉ, à partir de :
//   • tarifs.json : les prix, l'essai, le parrainage, les formules de coaching ;
//   • index.html : la FAQ (<section id="faq">, chaque <details>) ;
//   • terms.html : les CGV, sections 3 à 8 (ce qui est vendu, prix, résiliation,
//     rétractation, remboursement, avertissement de santé).
//
// SORTIES (identiques, deux formes) :
//   • docs/base-chat.md          — à relire par un humain ;
//   • cloudflare/src/base-chat.js — la même chaîne, importée par le Worker.
//
//   node scripts/base-chat.mjs             fabrique
//   node scripts/base-chat.mjs --verifier  sort en erreur si l'une est en retard
//
// scripts/tarifs.mjs la refabrique après chaque changement de prix, et un test
// du Worker (cloudflare/test/chat.test.mjs) compare la base embarquée à une
// base fraîche : un prix changé sans relancer le script fait échouer les tests.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../', import.meta.url));
export const SORTIE_MD = RACINE + 'docs/base-chat.md';
export const SORTIE_JS = RACINE + 'cloudflare/src/base-chat.js';
const lire = (f) => readFileSync(RACINE + f, 'utf8');

const ENTITES = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç', ecirc: 'ê' };
/** PURE. Le texte d'un fragment HTML : balises retirées, entités décodées, espaces resserrés. */
export function texteDe(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITES[n.toLowerCase()] !== undefined ? ENTITES[n.toLowerCase()] : m))
    .replace(/[ \t  ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
const euros = (n) => { const v = Number(n) || 0; return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ',')) + ' €'; };

/** PURE. La FAQ de la page d'accueil : [{q, r}]. */
export function faqDe(html) {
  const i = html.indexOf('<section id="faq">');
  if (i < 0) return [];
  const sec = html.slice(i, html.indexOf('</section>', i));
  const out = [];
  for (const m of sec.matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g))
    out.push({ q: texteDe(m[1]), r: texteDe(m[2]) });
  return out;
}

/** PURE. Les sections 3 à 8 des CGV, sans les avertissements de brouillon. */
export function cgvDe(html) {
  const sans = html.replace(/<div class="warn">[\s\S]*?<\/div>/g, '');
  const parts = sans.split(/<h2[^>]*>/).slice(1);
  const out = [];
  for (const p of parts) {
    const titre = texteDe(p.slice(0, p.indexOf('</h2>')));
    const n = parseInt(titre, 10);
    if (!(n >= 3 && n <= 8)) continue;
    let corps = p.slice(p.indexOf('</h2>') + 5);
    corps = corps.split(/<p style="margin-top:40px/)[0];
    out.push({ titre, texte: texteDe(corps.replace(/<\/p>/g, '\n')) });
  }
  return out;
}

/** PURE. Les prix et offres, en phrases, depuis tarifs.json. */
export function prixDe(T) {
  const l = [];
  const sansEng = Number(T.engagementMois) === 0;
  l.push('- Essai gratuit : ' + T.essai.mois + ' mois (' + T.essai.jours + ' jours), toute l’application ouverte (formule Ultime), ' + (T.essai.carte ? 'carte bancaire demandée.' : 'sans carte bancaire.'));
  l.push('- Essentielle : ' + euros(T.essentielle.mois) + ' par mois, ou ' + euros(T.essentielle.an) + ' pour l’année réglée en une fois.');
  l.push('- Ultime : ' + euros(T.ultime.mois) + ' par mois, ou ' + euros(T.ultime.an) + ' pour l’année réglée en une fois.');
  l.push('- Abonnement ' + (sansEng ? 'sans engagement : résiliable à tout moment, effet à la fin de la période payée.' : 'avec engagement de ' + T.engagementMois + ' mois.'));
  const ep = T.essai_parrainage || {};
  l.push('- Invité par un ami (lien ou code de parrainage) : ' + (T.essai.mois + (Number(ep.moisEnPlus) || 0)) + ' mois d’essai au lieu de ' + T.essai.mois + '.');
  if (ep.moisParrain) l.push('- La personne qui invite gagne ' + ep.moisParrain + ' mois au premier paiement de la personne invitée, une fois par personne invitée' + (ep.mentorPayants ? ', et un mois d’Ultime à ' + ep.mentorPayants + ' personnes invitées devenues payantes.' : '.'));
  if (T.ultime_demi && T.ultime_demi.premierMois) l.push('- Offre possible avec certains codes ambassadeur ou à la fin d’un suivi : premier mois d’Ultime à ' + euros(T.ultime_demi.premierMois) + ', puis le prix normal.');
  if (T.coach) l.push('- Pour les coachs qui suivent des athlètes dans l’app : Libre ' + euros(T.coach.libre) + ', Coach ' + euros(T.coach.coach) + ' par mois, Pro ' + euros(T.coach.pro) + ' par mois.');
  const C = T.coaching || {};
  if (C.boutique_prog) l.push('- Programme de la boutique : à partir de ' + euros(C.boutique_prog.prix) + ', le programme reste à vie, avec ' + (C.boutique_prog.mois * 30) + ' jours d’application complète.');
  const f = (k, quoi) => {
    const x = C[k]; if (!x || !x.prix) return;
    l.push('- ' + (x.lib || k) + ' (' + quoi + ') : ' + euros(x.prix) + ', ' + x.mois + ' mois. ' + String(x.comprend || '') + (x.reponse ? ' ' + x.reponse : ''));
  };
  l.push('');
  l.push('Coaching par Kevin Guellec (coach sportif diplômé d’État), paiement unique, sans abonnement :');
  f('coaching_essentiel', 'avec suivi'); f('coaching_transfo', 'avec suivi'); f('coaching_evolution', 'avec suivi');
  f('programme_perso', 'sans suivi'); f('revision_prog', 'sans suivi');
  return l.join('\n');
}

/** PURE. La base entière, en Markdown. */
export function construireBase({ tarifs, index, terms }) {
  const faq = faqDe(index).map((x) => '### ' + x.q + '\n' + x.r).join('\n\n');
  const cgv = cgvDe(terms).map((x) => '### ' + x.titre + '\n' + x.texte).join('\n\n');
  return [
    '# Base de connaissances de l’assistant RepCore',
    '',
    'FICHIER FABRIQUÉ par scripts/base-chat.mjs depuis tarifs.json, la FAQ de index.html et les CGV (terms.html). Ne pas le modifier à la main.',
    '',
    '## RepCore en bref',
    'RepCore est une application de musculation créée par Kevin Guellec, coach sportif diplômé d’État. Elle s’ouvre dans le navigateur (https://repcore-sync.web.app) et s’installe sur l’écran d’accueil.',
    'Essai gratuit : https://repcore-sync.web.app/app/#install',
    'Questions fréquentes : https://repcore-sync.web.app/#faq',
    'Écrire à Kevin : guellec.coachingpro@gmail.com',
    'Conditions générales : https://repcore-sync.web.app/terms.html',
    '',
    '## Prix et offres (tarifs.json)',
    prixDe(tarifs),
    '',
    '## Questions fréquentes (page d’accueil)',
    faq,
    '',
    '## Conditions générales de vente (extraits)',
    cgv,
    '',
  ].join('\n');
}

export function baseFraiche() {
  return construireBase({ tarifs: JSON.parse(lire('tarifs.json')), index: lire('index.html'), terms: lire('terms.html') });
}
export const enJs = (md) => '// FICHIER FABRIQUÉ par scripts/base-chat.mjs (ne pas modifier) : la base de\n'
  + '// connaissances de l’assistant (docs/base-chat.md), embarquée dans le Worker.\n'
  + 'export default ' + JSON.stringify(md) + ';\n';

/** Fabrique (ou vérifie) les deux sorties. Rend la liste de celles qui étaient en retard. */
export function fabriquer(verifier) {
  const md = baseFraiche();
  const retard = [];
  for (const [f, contenu] of [[SORTIE_MD, md], [SORTIE_JS, enJs(md)]]) {
    let avant = null; try { avant = readFileSync(f, 'utf8'); } catch (e) { avant = null; }
    if (avant === contenu) continue;
    retard.push(f.slice(RACINE.length));
    if (!verifier) writeFileSync(f, contenu);
  }
  return retard;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verifier = process.argv.includes('--verifier');
  const r = fabriquer(verifier);
  if (verifier && r.length) { console.error('Base de l’assistant en retard : ' + r.join(', ') + ' — lance node scripts/base-chat.mjs'); process.exit(1); }
  console.log(r.length ? (verifier ? '' : 'Fabriqué : ' + r.join(', ')) : 'La base de l’assistant suit les pages.');
}
