#!/usr/bin/env node
// LES PRIX AFFICHÉS SONT CEUX DE tarifs.json, PARTOUT.
//
// LA PANNE. La page de vente annonçait 9,95 € « sans engagement » et un annuel
// à 99 € « −2 mois » pendant que l'app et PayPal encaissaient 9,50 € sur douze
// mois (114 € en une fois). Rien ne le disait : chaque fichier était juste
// avec lui-même.
//
// CE QUE CE CONTRÔLE REFUSE :
//   1. un tarifs.json incohérent (annuel ≠ 12 mensualités, demi-tarif faux…) ;
//   2. une copie en retard : le bloc TARIFS de rc-core, un montant lié
//      (data-tarif, data-nb, data-tarif-m/a) de index.html, terms.html ou
//      aide-apk.html qui ne vaut plus ce que dit tarifs.json ;
//   3. un montant en euros ÉCRIT EN DUR dans ces pages, lié à aucune clé
//      (sauf data-hors-tarif : un prix du marché, pas le nôtre) ;
//   4. OFFRES et COACH_PALIERS, évalués tels quels, qui ne rendent pas les
//      prix de tarifs.json ;
//   5. « sans engagement » sur la page de vente ou l'accueil /i ; un « N mois
//      d'essai » qui n'est ni l'essai ni l'essai parrainé ;
//   6. (02/10/2026) « ton premier mois » à côté d'« ami » ou d'« invit » dans
//      index.html ou i/index.html, alors que l'essai parrainé ajoute des mois
//      (moisEnPlus > 0) : l'invité a essai.moisParraine mois, pas un ; et le
//      FAQ « Un ami m'a invité » qui ne dirait pas le même nombre dans sa
//      version visible et dans son JSON-LD, ou « double » à tort.
// Et il se prouve : un prix faussé exprès, un prix ajouté en dur, doivent
// être vus.
//   node scripts/verif/tarifs.mjs
import { readFileSync } from 'node:fs';
import { RACINE, PAGES, lireTarifs, valeur, appliquerPage, appliquerApp, fichierCore, incoherences, RE_FAQ_AMI } from '../tarifs.mjs';

const T = lireTarifs();
const erreurs = [];
const e = (m) => erreurs.push(m);

// ── 1. tarifs.json ────────────────────────────────────────────────────────
for (const x of incoherences(T)) e('tarifs.json : ' + x);

// ── 2 et 3. Les pages ─────────────────────────────────────────────────────
// Ce qui reste d'une page une fois retirés les montants liés et les prix du
// marché : il ne doit plus y avoir un seul euro.
function montantsLibres(html) {
  let s = html
    .replace(/<([a-z0-9]+)\b[^>]*\bdata-(tarif|nb|hors-tarif)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[a-z0-9]+\b[^>]*\bdata-tarif-[ma]="[^"]*"[^>]*>/gi, (b) => b.replace(/\bdata-[ma]="[^"]*"/g, ''));
  const trouves = [];
  const re = /\d[\d  .,]*(?:&nbsp;|\s| )?€/g;
  let m;
  while ((m = re.exec(s))) {
    const ligne = s.slice(0, m.index).split('\n').length;
    trouves.push(m[0].replace(/&nbsp;| /g, ' ').trim() + ' (vers la ligne ' + ligne + ')');
  }
  return trouves;
}
// « ton premier mois » (offert, gratuit…) à moins de 160 caractères d'« ami »
// ou d'« invit » : la phrase d'avant l'essai parrainé de deux mois.
function premierMoisAmi(html) {
  const out = [];
  const re = /ton premier mois/gi;
  let m;
  while ((m = re.exec(html))) {
    const autour = html.slice(Math.max(0, m.index - 160), m.index + m[0].length + 160);
    if (/\bami(?:e|s)?\b|invit/i.test(autour))
      out.push('« ton premier mois » pour un invité (vers la ligne ' + html.slice(0, m.index).split('\n').length + ') — l’essai parrainé dure ' + valeur(T, 'essai.moisParraine') + ' mois');
  }
  return out;
}
const texteVisible = (html) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;| /g, ' ').replace(/\s+/g, ' ');
function controlerPage(nom, html) {
  const err = [];
  if (appliquerPage(html, T) !== html) err.push(nom + ' : un montant lié ne vaut plus ce que dit tarifs.json — lance node scripts/tarifs.mjs');
  for (const x of montantsLibres(html)) err.push(nom + ' : prix écrit en dur, lié à aucune clé de tarifs.json : ' + x);
  if (nom === 'index.html' || nom === 'i/index.html') {
    if (T.essai_parrainage.moisEnPlus > 0) for (const x of premierMoisAmi(html)) err.push(nom + ' : ' + x);
    if (nom === 'i/index.html' && /sans engagement/i.test(html)) err.push('i/index.html : « sans engagement » — l’abonnement engage pour ' + T.engagementMois + ' mois');
  }
  if (nom === 'index.html') {
    const faq = [...html.matchAll(RE_FAQ_AMI)];
    const vis = html.match(/Son lien double ton essai(?:&nbsp;|\s| )*:\s*<span data-nb="essai\.moisParraine">/);
    if (faq.length !== 1 || !vis) err.push('index.html : le FAQ « Un ami m’a invité » ne dit plus « Son lien double ton essai : N mois » (JSON-LD et version visible liée à essai.moisParraine)');
    if (valeur(T, 'essai.moisParraine') !== 2 * T.essai.mois) err.push('index.html : le FAQ dit que le lien « double » l’essai, or ' + T.essai.mois + ' + ' + T.essai_parrainage.moisEnPlus + ' mois ne fait pas le double');
  }
  if (nom === 'index.html') {
    if (/sans engagement/i.test(html)) err.push('index.html : « sans engagement » — l’abonnement engage pour ' + T.engagementMois + ' mois');
    const permis = [T.essai.mois, valeur(T, 'essai.moisParraine')];
    for (const m of texteVisible(html).matchAll(/(\d+) mois d'essai/g))
      if (!permis.includes(Number(m[1]))) err.push('index.html : « ' + m[0] + ' » — l’essai dure ' + permis.join(' ou ') + ' mois');
    // Les boutons disent « 1 mois » en clair (un <span> dans un bouton le coupe en colonnes).
    for (const m of texteVisible(html).matchAll(/Essayer (?:gratuitement )?(\d+) mois|(\d+) mois offert/g))
      if (Number(m[1] || m[2]) !== T.essai.mois) err.push('index.html : « ' + m[0] + ' » — l’essai dure ' + T.essai.mois + ' mois');
    for (const m of texteVisible(html).matchAll(/(\d+) mois si un ami/g))
      if (Number(m[1]) !== permis[1]) err.push('index.html : « ' + m[0] + ' » — l’essai parrainé dure ' + permis[1] + ' mois');
    // Les phrases de la bascule et du FAQ disent « 12 mois » en toutes lettres.
    if (T.engagementMois !== 12) err.push('index.html : l’engagement n’est plus de 12 mois — relire la bascule, le FAQ (JSON-LD compris) et la note sous la grille');
  }
  return err;
}
for (const p of PAGES) {
  let html;
  try { html = readFileSync(RACINE + p, 'utf8'); } catch (x) { e(p + ' illisible'); continue; }
  erreurs.push(...controlerPage(p, html));
}
// Les deux montants de la grille, et l'annuel, y sont bien.
{
  const html = readFileSync(RACINE + 'index.html', 'utf8');
  for (const cle of ['essentielle.mois', 'ultime.mois'])
    if (!new RegExp('data-tarif="' + cle.replace('.', '\\.') + '"').test(html)) e('index.html : la grille ne montre plus ' + cle);
  for (const cle of ['essentielle.an', 'ultime.an'])
    if (!new RegExp('data-tarif-a="' + cle.replace('.', '\\.') + '"').test(html)) e('index.html : la bascule ne montre plus ' + cle);
}

// ── Le contrôle se prouve ─────────────────────────────────────────────────
{
  const html = readFileSync(RACINE + 'index.html', 'utf8');
  const fausse = html.replace('<span data-tarif="essentielle.mois">9,50&nbsp;€</span>', '<span data-tarif="essentielle.mois">9,95&nbsp;€</span>');
  if (fausse === html) e('auto-contrôle : le prix d’Essentielle n’est plus lié dans la grille');
  else if (!controlerPage('index.html', fausse).some((x) => /ne vaut plus/.test(x))) e('auto-contrôle : un prix faussé n’est pas vu');
  const enDur = html.replace('</main>', '<p>Offre : 49&nbsp;€ par mois</p></main>');
  const enDur2 = enDur === html ? html.replace('</body>', '<p>Offre : 49&nbsp;€ par mois</p></body>') : enDur;
  if (!controlerPage('index.html', enDur2).some((x) => /49 €/.test(x))) e('auto-contrôle : un prix écrit en dur n’est pas vu');
  if (!controlerPage('index.html', html.replace('</body>', '<p>sans engagement</p></body>')).some((x) => /sans engagement/.test(x)))
    e('auto-contrôle : « sans engagement » n’est pas vu');
  if (T.essai_parrainage.moisEnPlus > 0) {
    if (!controlerPage('index.html', html.replace('</body>', '<p>Ton ami t’offre ton premier mois.</p></body>')).some((x) => /ton premier mois/.test(x)))
      e('auto-contrôle : « ton premier mois » d’un invité n’est pas vu dans index.html');
    const i = readFileSync(RACINE + 'i/index.html', 'utf8');
    if (!controlerPage('i/index.html', i.replace('</body>', '<script>var t=nom+" t\u2019invite : ton premier mois offert";</script></body>')).some((x) => /ton premier mois/.test(x)))
      e('auto-contrôle : « ton premier mois » d’un invité n’est pas vu dans i/index.html');
  }
  const faux = html.replace(RE_FAQ_AMI, (_t, a, _n, b) => a + '7' + b);
  if (faux === html || !controlerPage('index.html', faux).some((x) => /ne vaut plus/.test(x))) e('auto-contrôle : le nombre du FAQ JSON-LD faussé n’est pas vu');
}

// ── 2 et 4. L'app ─────────────────────────────────────────────────────────
{
  const chemin = fichierCore();
  const code = readFileSync(chemin, 'utf8');
  const nom = chemin.slice(RACINE.length);
  let ok = true;
  try { if (appliquerApp(code, T) !== code) { ok = false; e(nom + ' : le bloc TARIFS n’est pas la copie de tarifs.json — lance node scripts/tarifs.mjs'); } }
  catch (x) { ok = false; e(nom + ' : ' + x.message); }
  if (ok) {
    // Évalués tels quels : le bloc TARIFS, OFFRES, COACH_PALIERS, ESSAI_JOURS.
    const bloc = (debut, fin) => {
      const i = code.indexOf(debut); if (i < 0) throw new Error(debut + ' introuvable');
      const j = code.indexOf(fin, i); if (j < 0) throw new Error('fin de ' + debut + ' introuvable');
      return code.slice(i, j + fin.length);
    };
    try {
      const src = [bloc('/* TARIFS:DEBUT */', '/* TARIFS:FIN */'), bloc('const _TC=', ';'),
        bloc('const OFFRES=Object.freeze({', '\n});'), 'var PAYPAL_PLAN_ID_COACH="",PAYPAL_PLAN_ID_PRO="";',
        bloc('const COACH_PALIERS=Object.freeze([', '\n]);'), bloc('const ESSAI_JOURS=', ';')].join('\n');
      // eslint-disable-next-line no-new-func
      const r = new Function(src + '\nreturn {OFFRES, COACH_PALIERS, ESSAI_JOURS};')();
      const attendu = [
        ['OFFRES.essentielle.prix', r.OFFRES.essentielle.prix, T.essentielle.mois],
        ['OFFRES.essentielle.prixAn', r.OFFRES.essentielle.prixAn, T.essentielle.an],
        ['OFFRES.ultime.prix', r.OFFRES.ultime.prix, T.ultime.mois],
        ['OFFRES.ultime.prixAn', r.OFFRES.ultime.prixAn, T.ultime.an],
        ['OFFRES.ultime_demi.prix', r.OFFRES.ultime_demi.prix, T.ultime_demi.premierMois],
        ['OFFRES.essai.mois', r.OFFRES.essai.mois, T.essai.mois],
        ['OFFRES.essai_parrainage.mois', r.OFFRES.essai_parrainage.mois, T.essai_parrainage.moisEnPlus],
        ['ESSAI_JOURS', r.ESSAI_JOURS, T.essai.jours],
        ...['libre', 'coach', 'pro'].map((k) => ['COACH_PALIERS.' + k, (r.COACH_PALIERS.find((p) => p.cle === k) || {}).prix, T.coach[k]]),
        ...Object.keys(T.coaching).map((k) => ['OFFRES.' + k, r.OFFRES[k] && r.OFFRES[k].prix, T.coaching[k].prix]),
      ];
      for (const [quoi, vu, voulu] of attendu) if (vu !== voulu) e(nom + ' : ' + quoi + ' vaut ' + vu + ', tarifs.json dit ' + voulu);
    } catch (x) { e(nom + ' : OFFRES illisible (' + x.message + ')'); }
    // Aucun prix d'abonnement en dur dans OFFRES.
    const offres = code.slice(code.indexOf('const OFFRES=Object.freeze({'), code.indexOf('\n});', code.indexOf('const OFFRES=Object.freeze({')));
    if (/\bprix(An)?:\s*[1-9][0-9.]*/.test(offres)) e(nom + ' : un prix écrit en dur dans OFFRES — il doit venir de TARIFS');
    if (/moisApres\(Date\.now\(\),\s*12\)/.test(code)) e(nom + ' : la fin d’engagement est écrite en dur (12) au lieu de TARIFS.engagementMois');
  }
}

if (erreurs.length) {
  console.error('PRIX INCOHÉRENTS (' + erreurs.length + ') :\n  ' + erreurs.join('\n  '));
  process.exit(1);
}
console.log('Prix : l’app, ' + PAGES.join(', ') + ' suivent tarifs.json (Essentielle ' + T.essentielle.mois + ' / ' + T.essentielle.an
  + ', Ultime ' + T.ultime.mois + ' / ' + T.ultime.an + ', essai ' + T.essai.mois + ' mois, parrainé ' + valeur(T, 'essai.moisParraine') + '). Le contrôle voit un prix faussé et un prix en dur.');
