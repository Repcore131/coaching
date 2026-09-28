#!/usr/bin/env node
// ══ LES PRIX, ÉCRITS UNE SEULE FOIS : tarifs.json ═════════════════════════
//
// POURQUOI. La page de vente annonçait 9,95 € et 24,90 € « sans engagement »,
// avec un annuel à 99 € et 249 € « −2 mois », pendant que l'app et PayPal
// encaissaient 9,50 € et 24,90 € sur douze mois, et 114 € / 298,80 € en une
// fois. Trois fichiers, trois vérités : celle qu'on ne relit pas finit fausse.
//
// CE QUE FAIT CE SCRIPT (idempotent) :
//   • app/rc-core.<build>.js — recopie tarifs.json entre /* TARIFS:DEBUT */ et
//     /* TARIFS:FIN */ : OFFRES, COACH_PALIERS et ESSAI_JOURS le lisent.
//     L'app ne le télécharge pas au démarrage : ses prix doivent exister
//     avant le premier écran, hors ligne compris ;
//   • index.html et terms.html — réécrit chaque montant lié à une clé :
//       <b data-tarif="essentielle.mois">…</b>          un prix en euros
//       <span data-nb="essai.moisParraine">…</span>      un nombre
//       data-tarif-m="…" / data-tarif-a="…"             les attributs data-m / data-a
//                                                       du même élément (bascule)
//   Un montant en euros qui n'est lié à AUCUNE clé est refusé par
//   scripts/verif/tarifs.mjs, sauf dans un élément marqué data-hors-tarif
//   (un prix du marché, pas le nôtre).
//
//   node scripts/tarifs.mjs             applique
//   node scripts/tarifs.mjs --verifier  ne change rien, sort en erreur si un fichier est en retard
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../', import.meta.url));
export const PAGES = ['index.html', 'terms.html', 'aide-apk.html', 'i/index.html'];

export function lireTarifs() { return JSON.parse(readFileSync(RACINE + 'tarifs.json', 'utf8')); }

// Ce que les pages affichent sans que ce soit écrit tel quel dans tarifs.json.
const DERIVES = {
  'essai.moisParraine': (T) => T.essai.mois + T.essai_parrainage.moisEnPlus,
  'coaching.coaching_evolution.parMois': (T) => T.coaching.coaching_evolution.prix / T.coaching.coaching_evolution.mois,
};
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

// ── Les pages ─────────────────────────────────────────────────────────────
// Le contenu d'un élément lié ne porte pas de balise : on le remplace entier.
const RE_CONTENU = /(<([a-z0-9]+)\b[^>]*\bdata-(tarif|nb)="([^"]+)"[^>]*>)([^<]*)(<\/\2>)/gi;
const RE_BALISE = /<[a-z0-9]+\b[^>]*\bdata-tarif-[ma]="[^"]+"[^>]*>/gi;
export function appliquerPage(html, T) {
  let s = html.replace(RE_CONTENU, (tout, ouvre, _b, sorte, cle, _c, ferme) =>
    ouvre + (sorte === 'tarif' ? euros(valeur(T, cle)) : nombre(valeur(T, cle))) + ferme);
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
  return s;
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
  for (const k of ['essentielle', 'ultime'])
    if (c2(T[k].mois * T.engagementMois) !== c2(T[k].an))
      e.push(k + ' : l’annuel (' + T[k].an + ') n’est plus douze mensualités (' + c2(T[k].mois * T.engagementMois) + ') — les pages disent « même total »');
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
