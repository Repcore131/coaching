#!/usr/bin/env node
// ══ LES PRIX, ÉCRITS UNE SEULE FOIS : tarifs.json ═════════════════════════
//
// POURQUOI. La page de vente annonçait 9,95 € et 24,90 € « sans engagement »,
// avec un annuel à 99 € et 249 € « −2 mois », pendant que l'app et PayPal
// encaissaient 9,50 € et 24,90 € sur douze mois, et 114 € / 298,80 € en une
// fois. Trois fichiers, trois vérités : celle qu'on ne relit pas finit fausse.
// (02/10/2026 : l'annuel est de nouveau remisé, 95 € et 249 € — toujours ici.)
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
//     et, dans le FAQ en JSON-LD d'index.html, « Son lien double ton essai :
//     N mois » (RE_FAQ_AMI), qui n'a pas de balise où poser data-nb ;
//     et les offres JSON-LD liées par « "identifier": "tarifs:<clé>" »
//     (RE_JSONLD_PRIX), dans index.html et coachs.html.
//   Un montant en euros qui n'est lié à AUCUNE clé est refusé par
//   scripts/verif/tarifs.mjs, sauf dans un élément marqué data-hors-tarif
//   (un prix du marché, pas le nôtre).
//
//   node scripts/tarifs.mjs             applique
//   node scripts/tarifs.mjs --verifier  ne change rien, sort en erreur si un fichier est en retard
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const RACINE = fileURLToPath(new URL('../', import.meta.url));
export const PAGES = ['index.html', 'coachs.html', 'terms.html', 'aide-apk.html', 'i/index.html', 'c/index.html', 'p/index.html',
  'blog/index.html', 'blog/cycle-menstruel-entrainement.html', 'blog/numeriser-fiche-programme-papier.html', 'blog/suivi-athletes-sans-tableur.html'];

export function lireTarifs() { return JSON.parse(readFileSync(RACINE + 'tarifs.json', 'utf8')); }

// Ce que les pages affichent sans que ce soit écrit tel quel dans tarifs.json.
const DERIVES = {
  'essai.moisParraine': (T) => T.essai.mois + T.essai_parrainage.moisEnPlus,
  'coaching.coaching_evolution.parMois': (T) => T.coaching.coaching_evolution.prix / T.coaching.coaching_evolution.mois,
  // L'annuel ramené au mois, et sa remise sur douze mensualités (en %, arrondie).
  'essentielle.anMois': (T) => Math.round(T.essentielle.an / 12 * 100) / 100,
  'ultime.anMois': (T) => Math.round(T.ultime.an / 12 * 100) / 100,
  'essentielle.remisePct': (T) => Math.round((1 - T.essentielle.an / (T.essentielle.mois * 12)) * 100),
  'ultime.remisePct': (T) => Math.round((1 - T.ultime.an / (T.ultime.mois * 12)) * 100),
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
  // LE FAQ EN JSON-LD (index.html) est du texte, sans balise où poser un
  // data-nb : sa phrase sur l'essai parrainé est réécrite ici, avec le même
  // nombre que la version visible.
  s = s.replace(RE_FAQ_AMI, (_t, avant, _n, apres) => avant + nombre(valeur(T, 'essai.moisParraine')) + apres);
  // LES OFFRES DU JSON-LD (02/10/2026) : « "identifier": "tarifs:<clé>",
  // "price": "…" » — le prix suit la clé, en notation JSON-LD (point décimal,
  // deux décimales s'il y en a). index.html y annonçait 9.95 € pendant que
  // la grille disait 9,50 € : rien ne les liait.
  s = s.replace(RE_JSONLD_PRIX, (_t, avant, cle, apres) => avant + prixJsonLd(valeur(T, cle)) + apres);
  return s;
}
export const RE_JSONLD_PRIX = /("identifier": "tarifs:([a-z_.]+)", "price": ")[^"]*(")/g;
const prixJsonLd = (n) => (Math.round(n * 100) % 100 === 0 ? String(Math.round(n)) : Number(n).toFixed(2));
export const RE_FAQ_AMI = /("text": "Son lien double ton essai : )(\d+)( mois)/g;

// ── La fiche Play Store (02/10/2026) ─────────────────────────────────────
// Du texte brut, collé tel quel dans la Play Console : pas de balise où poser
// un data-tarif. Le MODÈLE porte {{tarif:<clé>}} (un prix) et {{nb:<clé>}} (un
// nombre) ; ce script écrit la fiche (fr-FR/full_description.txt) avec les
// valeurs de tarifs.json. scripts/verif/fiche-store.mjs vérifie longueurs et prix.
export const FICHES = [['android/fiche-store/modeles/full_description.txt', 'android/fiche-store/fr-FR/full_description.txt']];
export function rendreFiche(modele, T) {
  return String(modele).replace(/\{\{(tarif|nb):([a-z_.]+)\}\}/gi, (_t, sorte, cle) =>
    sorte === 'tarif' ? euros(valeur(T, cle)).replace('&nbsp;', '\u00a0') : nombre(valeur(T, cle)));
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
  // L'ANNUEL PEUT ÊTRE REMISÉ (02/10/2026), JAMAIS PLUS CHER : payer d'avance
  // plus que douze mensualités serait une pénalité. Les pages disent la remise
  // (essentielle.remisePct, ultime.remisePct), calculée ici.
  for (const k of ['essentielle', 'ultime']) {
    if (c2(T[k].an) > c2(T[k].mois * T.engagementMois))
      e.push(k + ' : l’annuel (' + T[k].an + ') coûte plus que douze mensualités (' + c2(T[k].mois * T.engagementMois) + ')');
    if (!(T[k].an > 0)) e.push(k + ' : prix annuel absent');
  }
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
  // LA SOURCE D'ABORD (02/10/2026) : depuis le lot 22, rc-core s'assemble
  // depuis src/core/ ; n'écrire que dans app/rc-core.*.js laissait la source en
  // retard, et `assembler_core.mjs --verifier` échouait au premier prix changé.
  const sources = readdirSync(RACINE + 'src/core').filter((x) => /\.js$/.test(x))
    .map((x) => RACINE + 'src/core/' + x).filter((x) => readFileSync(x, 'utf8').includes('/* TARIFS:DEBUT */'));
  for (const [chemin, f] of [...sources.map((x) => [x, appliquerApp]), [fichierCore(), appliquerApp], ...PAGES.map((p) => [RACINE + p, appliquerPage])]) {
    const avant = readFileSync(chemin, 'utf8');
    const apres = f(avant, T);
    if (apres === avant) continue;
    enRetard.push(chemin.slice(RACINE.length));
    if (!verifier) writeFileSync(chemin, apres);
  }
  for (const [modele, fiche] of FICHES) {
    const attendu = rendreFiche(readFileSync(RACINE + modele, 'utf8'), T);
    let actuel = ''; try { actuel = readFileSync(RACINE + fiche, 'utf8'); } catch (e) { actuel = ''; }
    if (actuel === attendu) continue;
    enRetard.push(fiche);
    if (!verifier) writeFileSync(RACINE + fiche, attendu);
  }
  if (verifier && enRetard.length) { console.error('En retard sur tarifs.json : ' + enRetard.join(', ') + ' — lance node scripts/tarifs.mjs'); process.exit(1); }
  console.log(enRetard.length ? (verifier ? '' : 'Mis à jour : ' + enRetard.join(', ')) : 'Tout suit tarifs.json.');
}
