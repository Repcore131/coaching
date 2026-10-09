#!/usr/bin/env node
// ══ LES PRIX, ÉCRITS UNE SEULE FOIS : tarifs.json ═════════════════════════
//
// POURQUOI. Un prix recopié à la main dans trois fichiers finit par en dire
// trois différents : celui qu'on ne relit pas devient faux. Un seul fichier,
// tarifs.json, et ce script qui le recopie partout où un montant s'affiche.
//
// CE QUE FAIT CE SCRIPT (idempotent) :
//   • app/rc-core.<build>.js — recopie tarifs.json entre /* TARIFS:DEBUT */ et
//     /* TARIFS:FIN */ : OFFRES, COACH_PALIERS et ESSAI_JOURS le lisent.
//     L'app ne le télécharge pas au démarrage : ses prix doivent exister
//     avant le premier écran, hors ligne compris ;
//   • index.html et terms.html — réécrit chaque montant lié à une clé :
//       <b data-tarif="essentielle.mois">…</b>          un prix en euros
//       <span data-nb="essai.moisParraine">…</span>      un nombre
//       <span data-texte="engagement">…</span>          une phrase qui dépend d'un nombre
//                                                       (TEXTES, ci-dessous : « sans
//                                                       engagement » ou « engagement 12 mois »)
//       data-tarif-m="…" / data-tarif-a="…"             les attributs data-m / data-a
//                                                       du même élément (bascule)
//   • index.html, les données structurées (JSON-LD) :
//       <script type="application/ld+json" data-tarifs-offres="Essentielle=essentielle.mois,…">
//         recopie le « price » de chaque Offer nommée ;
//       <script type="application/ld+json" data-faq-depuis="faq">
//         réécrit la FAQPage à partir des <details> visibles de <section id="faq"> :
//         les réponses que lit Google sont celles que lit le visiteur, nombres
//         liés compris (un JSON ne peut pas porter de data-nb) ;
//   Un montant en euros qui n'est lié à AUCUNE clé est refusé par
//   scripts/verif/tarifs.mjs, sauf dans un élément marqué data-hors-tarif
//   (un prix du marché, pas le nôtre) ; et tout montant, lié ou non, doit
//   valoir un prix de tarifs.json ou figurer dans la LISTE_BLANCHE de ce
//   contrôle, qui dit pourquoi.
//
//   node scripts/tarifs.mjs             applique
//   node scripts/tarifs.mjs --verifier  ne change rien, sort en erreur si un fichier est en retard
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../', import.meta.url));
export const PAGES = ['index.html', 'terms.html', 'legal.html', 'aide-apk.html', 'i/index.html', 'c/index.html', 'app/index.html'];

export function lireTarifs() { return JSON.parse(readFileSync(RACINE + 'tarifs.json', 'utf8')); }

// LES MOIS OFFERTS PAR L'ANNÉE RÉGLÉE EN UNE FOIS : ce que douze mensualités
// coûtent de plus que l'annuel, compté en mensualités. Un nombre ENTIER ou
// rien : « 1,4 mois offert » ne se dit pas, et 0 veut dire « pas de remise ».
// Comparé en centimes entiers (24,90 × 12 ne vaut pas 298,80 en flottant).
// ⚠ MÊME CALCUL que moisOffertsAnnuel() dans rc-core : un test les compare.
export const MOIS_PAR_AN = 12;
export function moisOfferts(mois, an) {
  const m = Math.round(Number(mois) * 100), a = Math.round(Number(an) * 100);
  if (!(m > 0) || !(a > 0) || a >= m * MOIS_PAR_AN) return 0;
  const n = (m * MOIS_PAR_AN - a) / m;
  return Math.abs(n - Math.round(n)) * m < 1 ? Math.round(n) : 0;
}
// Ce que les pages affichent sans que ce soit écrit tel quel dans tarifs.json.
const DERIVES = {
  'essai.moisParraine': (T) => T.essai.mois + T.essai_parrainage.moisEnPlus,
  'coaching.coaching_evolution.parMois': (T) => T.coaching.coaching_evolution.prix / T.coaching.coaching_evolution.mois,
  'essentielle.moisOfferts': (T) => moisOfferts(T.essentielle.mois, T.essentielle.an),
  'ultime.moisOfferts': (T) => moisOfferts(T.ultime.mois, T.ultime.an),
};
// LES PHRASES QUI DÉPENDENT D'UN NOMBRE (data-texte) : un « 0 mois » ne se lit
// pas, et « engagement 0 mois » dirait le contraire de ce qu'il veut dire.
const offreAn = (k) => (T) => {
  const n = moisOfferts(T[k].mois, T[k].an);
  return n ? 'réglé en une fois, ' + n + '&nbsp;mois offerts' : 'réglé en une fois, le même total que ' + MOIS_PAR_AN + '&nbsp;mensualités';
};
const TEXTES = {
  engagement: (T) => (T.engagementMois ? 'engagement ' + T.engagementMois + '&nbsp;mois' : 'sans engagement'),
  Engagement: (T) => (T.engagementMois ? 'Engagement ' + T.engagementMois + '&nbsp;mois' : 'Sans engagement'),
  'essentielle.offreAn': offreAn('essentielle'),
  'ultime.offreAn': offreAn('ultime'),
};
export function texte(T, cle) {
  if (!TEXTES[cle]) throw new Error('data-texte « ' + cle + ' » inconnu (TEXTES dans scripts/tarifs.mjs)');
  return TEXTES[cle](T);
}
export function valeur(T, cle) {
  if (DERIVES[cle]) return DERIVES[cle](T);
  let v = T;
  for (const k of String(cle).split('.')) { v = v && typeof v === 'object' ? v[k] : undefined; }
  if (typeof v !== 'number') throw new Error('tarifs.json : clé « ' + cle + ' » absente ou pas un nombre');
  return v;
}
// Comme _euros() dans l'app : pas de décimales pour un compte rond, sinon les
// deux (« 24,9 € » se lit comme une faute de frappe), espace insécable avant €.
export function euros(n) {
  const v = Number(n) || 0;
  const s = Math.round(v * 100) % 100 === 0 ? String(Math.round(v)) : v.toFixed(2).replace('.', ',');
  return s + '&nbsp;€';
}
const nombre = (n) => String(n).replace('.', ',');

// LES MONTANTS EN EUROS de tarifs.json (pas les durées : « mois » vaut un prix
// sous essentielle, une durée sous coaching). Ce qu'un « … € » affiché a le
// droit de valoir — scripts/verif/tarifs.mjs refuse tout autre montant.
export function montantsTarifs(T) {
  const ce = T.contrats_engages || {};
  const l = [T.essentielle.mois, T.essentielle.an, T.ultime.mois, T.ultime.an, T.ultime_demi.premierMois,
    ...['essentielle', 'ultime'].flatMap((k) => (ce[k] ? [ce[k].mois, ce[k].an] : [])),
    ...Object.values(T.coach), ...Object.values(T.coaching).map((c) => c.prix), valeur(T, 'coaching.coaching_evolution.parMois')];
  return [...new Set(l.filter((n) => typeof n === 'number'))].sort((a, b) => a - b);
}

// ── Les pages ─────────────────────────────────────────────────────────────
// Le contenu d'un élément lié ne porte pas de balise : on le remplace entier.
const RE_CONTENU = /(<([a-z0-9]+)\b[^>]*\bdata-(tarif|nb|texte)="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi;
const RE_BALISE = /<[a-z0-9]+\b[^>]*\bdata-tarif-[ma]="[^"]+"[^>]*>/gi;
export function appliquerPage(html, T) {
  let s = html.replace(RE_CONTENU, (tout, ouvre, _b, sorte, cle, _c, ferme) =>
    ouvre + (sorte === 'tarif' ? euros(valeur(T, cle)) : sorte === 'texte' ? texte(T, cle) : nombre(valeur(T, cle))) + ferme);
  s = s.replace(RE_BALISE, (balise) => {
    let b = balise;
    for (const p of ['m', 'a']) {
      const m = b.match(new RegExp('\\bdata-tarif-' + p + '="([^"]+)"'));
      if (!m) continue;
      const v = euros(valeur(T, m[1]));
      if (!new RegExp('\\bdata-' + p + '="').test(b)) throw new Error('data-tarif-' + p + ' sans data-' + p + ' : ' + balise);
      b = b.replace(new RegExp('\\bdata-' + p + '="[^"]*"'), 'data-' + p + '="' + v + '"');
    }
    return b;
  });
  return appliquerJsonLd(s, T);
}

// ── Les données structurées (JSON-LD) ─────────────────────────────────────
const decoder = (t) => t.replace(/<[^>]+>/g, '').replace(/&nbsp;|\u00a0/g, ' ').replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
// Les questions visibles d'une section : [{q, r}], dans l'ordre de la page.
export function faqVisible(html, id) {
  const i = html.indexOf('<section id="' + id + '"');
  if (i < 0) throw new Error('<section id="' + id + '"> introuvable');
  const j = html.indexOf('</section>', i);
  const l = [];
  for (const m of html.slice(i, j).matchAll(/<details\b[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g))
    l.push({ q: decoder(m[1]), r: decoder(m[2]) });
  return l;
}
const RE_LD = /(<script type="application\/ld\+json"([^>]*)>)([\s\S]*?)(<\/script>)/g;
export function appliquerJsonLd(html, T) {
  return html.replace(RE_LD, (tout, ouvre, attrs, corps, ferme) => {
    const offres = attrs.match(/\bdata-tarifs-offres="([^"]+)"/);
    const faq = attrs.match(/\bdata-faq-depuis="([^"]+)"/);
    let c = corps;
    if (offres) for (const paire of offres[1].split(',')) {
      const [nom, cle] = paire.split('=').map((x) => x.trim());
      const re = new RegExp('("name":\\s*"' + nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"[^{}]*?"price":\\s*")[^"]*(")');
      if (!re.test(c)) throw new Error('JSON-LD : pas d’Offer « ' + nom + ' » avec un « price »');
      c = c.replace(re, '$1' + valeur(T, cle).toFixed(2) + '$2');
    }
    if (faq) {
      const l = faqVisible(html, faq[1]);
      if (!l.length) throw new Error('JSON-LD : aucune question visible dans <section id="' + faq[1] + '">');
      c = '\n' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: l.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.r } })) }, null, 1) + '\n';
    }
    return ouvre + c + ferme;
  });
}

// ── L'app ─────────────────────────────────────────────────────────────────
export function fichierCore() {
  const f = readdirSync(RACINE + 'app').filter((x) => /^rc-core\.\d+\.js$/.test(x))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0])).pop();
  if (!f) throw new Error('app/rc-core.<build>.js introuvable');
  return RACINE + 'app/' + f;
}
// Sans les clés « _ » (le mode d'emploi) : l'app n'en a que faire.
export function blocApp(T) {
  const net = JSON.parse(JSON.stringify(T, (k, v) => (k.startsWith('_') ? undefined : v)));
  return '/* TARIFS:DEBUT */\nconst TARIFS=(function geler(o){ Object.values(o).forEach(v=>{ if(v&&typeof v===\'object\') geler(v); }); return Object.freeze(o); })('
    + JSON.stringify(net) + ');\n/* TARIFS:FIN */';
}
export function appliquerApp(code, T) {
  const i = code.indexOf('/* TARIFS:DEBUT */'), j = code.indexOf('/* TARIFS:FIN */');
  if (i < 0 || j < i) throw new Error('marqueurs /* TARIFS:DEBUT */ … /* TARIFS:FIN */ absents de rc-core');
  return code.slice(0, i) + blocApp(T) + code.slice(j + '/* TARIFS:FIN */'.length);
}

// ── Cohérence interne de tarifs.json ──────────────────────────────────────
export function incoherences(T) {
  const e = [];
  const c2 = (n) => Math.round(n * 100) / 100;
  // L'ANNUEL NE COÛTE JAMAIS PLUS QUE DOUZE MENSUALITÉS. Depuis le passage
  // sans engagement, il peut coûter moins : c'est la remise (« N mois offerts »).
  for (const k of ['essentielle', 'ultime'])
    if (!(T[k].an > 0) || c2(T[k].an) > c2(T[k].mois * MOIS_PAR_AN))
      e.push(k + ' : l’annuel (' + T[k].an + ') coûte plus que douze mensualités (' + c2(T[k].mois * MOIS_PAR_AN) + ')');
  if (!Number.isInteger(T.engagementMois) || T.engagementMois < 0) e.push('engagementMois doit être un entier ≥ 0 (0 = sans engagement)');
  // Les contrats engagés en cours : leur annuel était douze mensualités pleines.
  const ce = T.contrats_engages;
  if (ce) for (const k of ['essentielle', 'ultime'])
    if (!ce[k] || c2(ce[k].mois * ce.engagementMois) !== c2(ce[k].an))
      e.push('contrats_engages.' + k + ' : l’annuel n’est pas ' + ce.engagementMois + ' mensualités — ce sont des contrats en cours, à ne pas modifier');
  if (c2(T.ultime.mois * T.ultime_demi.part) !== T.ultime_demi.premierMois)
    e.push('ultime_demi.premierMois (' + T.ultime_demi.premierMois + ') n’est pas ' + T.ultime_demi.part + ' × ' + T.ultime.mois);
  if (T.essai.jours !== T.essai.mois * 30) e.push('essai : ' + T.essai.jours + ' jours pour ' + T.essai.mois + ' mois');
  return e;
}

// ── En ligne de commande ─────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const verifier = process.argv.includes('--verifier');
  const T = lireTarifs();
  const inc = incoherences(T);
  if (inc.length) { console.error('tarifs.json incohérent :\n  ' + inc.join('\n  ')); process.exit(1); }
  const enRetard = [];
  for (const [chemin, f] of [[fichierCore(), appliquerApp], ...PAGES.map((p) => [RACINE + p, appliquerPage])]) {
    const avant = readFileSync(chemin, 'utf8');
    const apres = f(avant, T);
    if (apres === avant) continue;
    enRetard.push(chemin.slice(RACINE.length));
    if (!verifier) writeFileSync(chemin, apres);
  }
  if (verifier && enRetard.length) { console.error('En retard sur tarifs.json : ' + enRetard.join(', ') + ' — lance node scripts/tarifs.mjs'); process.exit(1); }
  console.log(enRetard.length ? (verifier ? '' : 'Mis à jour : ' + enRetard.join(', ')) : 'Tout suit tarifs.json.');
}
