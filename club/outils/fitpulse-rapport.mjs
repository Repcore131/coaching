/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — Rapport du lundi au directeur ══════════════════════════════
// Chaque lundi à 15 h (heure de Paris), un e-mail avec graphiques part à
// l'adresse du directeur réglée dans le Plan (copie au club) : la semaine
// écoulée, le trimestre face aux objectifs, le churn, la transformation, les
// missions et les primes. Le premier lundi du mois, il ajoute le point mensuel
// des impayés de 6 mois et plus.
// Les chiffres sont ceux de l'appli : son vrai code (plan.js, calc.js…) est
// chargé dans un contexte isolé, sans navigateur.
//   node club/outils/fitpulse-rapport.mjs apercu rapport.html   (données de démo)
import vm from 'node:vm';
import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { pathToFileURL } from 'node:url';

process.env.TZ = 'Europe/Paris';
const DIR = new URL(process.env.FITPULSE_APP_DIR || '..', import.meta.url); // dossier de l'appli (club/), ou lib/app/ dans club/cloud
const HEURE = 15; // lundi 15 h
const ATTENTE_MAX = Number(process.env.RAPPORT_ATTENTE_MIN || 4) * 60000; // avant 15 h, on attend l'heure pile

// ── L'appli, sans navigateur ──────────────────────────────────────────────
export function chargerAppli(donnees, { libs = false } = {}) {
  const noop = () => {};
  const el = () => ({ style: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false }, addEventListener: noop, appendChild: noop, setAttribute: noop, querySelector: () => null, querySelectorAll: () => [], dataset: {} });
  const ctx = {
    console: { log: noop, warn: noop, error: noop, info: noop }, Date, Math, Intl, JSON, URLSearchParams, URL, setTimeout, clearTimeout, setInterval: noop, queueMicrotask, crypto: webcrypto, TextEncoder, TextDecoder, performance,
    navigator: { onLine: true, userAgent: 'node' }, addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }), requestAnimationFrame: noop,
    document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], createElement: el, getElementById: () => null, body: el(), documentElement: el(), head: el() },
    location: { hostname: 'localhost', search: '', hash: '', href: 'http://localhost/' }, history: { replaceState: noop }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, indexedDB: undefined,
  };
  ctx.window = ctx; vm.createContext(ctx);
  // Lecture des ZIP et XLSX (imports automatiques) : mêmes bibliothèques que le site.
  if (libs) for (const f of ['vendor/jszip.min.js', 'vendor/xlsx.full.min.js']) vm.runInContext(readFileSync(new URL(f, DIR), 'utf8'), ctx, { filename: f });
  const fichiers = readFileSync(new URL('index.html', DIR), 'utf8').match(/src="[a-z0-9-]+\.js"/g).map(s => s.slice(5, -1)).filter(f => f !== 'app.js');
  for (const f of fichiers) vm.runInContext(readFileSync(new URL(f, DIR), 'utf8'), ctx, { filename: f });
  ctx.__DONNEES = donnees;
  vm.runInContext(donnees === 'demo' ? 'S = normalizeState(demoState()); REV++;' : 'S = normalizeState(__DONNEES || {}); REV++;', ctx);
  const run = code => vm.runInContext(code, ctx); run.ctx = ctx;
  return run;
}

// Les chiffres du rapport, calculés par le code de l'appli.
const CALCUL = `(() => {
  const P = planOf(); const st = planStats(); const ch = churnStats(); const tr = transfoStats(); const X = primesStats();
  const wEnd = addDays(weekStart(today()), -1), wStart = addDays(wEnd, -6);
  const resW = Object.values(S.resiliations || {}).filter(r => r && r.clubId === CLUB.id && !r.hidden && r.date >= wStart && r.date <= wEnd);
  const finsW = new Set(Object.values(S.touches || {}).filter(t => t && t.clubId === CLUB.id && t.kind === 'fincontrat' && t.at >= dateOf(wStart).getTime() && t.at < dateOf(wEnd).getTime() + 864e5).map(t => t.clientId || t.relKey)).size;
  const recW = (typeof recovList === 'function' ? recovList(CLUB.id, wStart, wEnd) : []).reduce((s, x) => s + x.amount, 0);
  const semaines = []; for (let w = weekStart(P.from); w <= wStart; w = addDays(w, 7)) semaines.push({ l: dm(w), v: sumRange(CLUB.id, null, 'contrats', w < P.from ? P.from : w, addDays(w, 6)) });
  const mk = curMonth(); const camp = [mk, addMonths(mk, 1)].map(m => { const f = finsCampagne(CLUB.id, m); return { m: monthLabel(m), total: f.total, appeles: f.appeles, conserves: f.conserves, inactifs: f.inactifs }; });
  const mo = P.mois[mk] || {}; const r = rangeOf('month', mk); const done = (deepGet(S, ['plans', CLUB.id, P.id, 'missions']) || {});
  const cos = companiesOf(CLUB.id);
  const users = Object.fromEntries(Object.values(S.users || {}).map(u => [u.id, fullName(u)]));
  return {
    club: CLUB.name, P: { label: P.label, from: P.from, to: P.to, targets: P.targets, n1: P.n1, primes: P.primes, cibles: P.cibles, partenariats: P.partenariats, blackFriday: P.blackFriday, avisDepart: P.avisDepart, avisDepartDate: P.avisDepartDate, directeur: P.directeur, copie: P.copie },
    today: today(), wStart, wEnd, mois: monthLabel(mk), moisCle: mk, elapsed: st.elapsed,
    semaine: { ventes: sumRange(CLUB.id, null, 'contrats', wStart, wEnd), resAbo: resW.filter(x => x.nature !== 'option').length, resOpt: resW.filter(x => x.nature === 'option').length, fins: finsW, boutique: htBoutique(CLUB.id, wStart, wEnd), dette: recW, avis: avisNow(P).n - avisAt(P, addDays(wStart, -1)),
      optJourJ: resW.filter(x => x.nature === 'option' && x.sameDay).map(x => ({ client: x.client || '', date: x.date, justif: x.justif || '', qui: users[x.sellerId || x.userId || x.ownerId] || '' })) },
    trimestre: { avisRythme: Math.max(0.01, Math.min(1, (dayDiff(P.avisDepartDate, planEnd(P)) + 1) / (dayDiff(P.avisDepartDate, P.to) + 1))), ca: st.ca, caMois: st.caMois.map(x => ({ m: monthLabel(x.m), v: x.v, n1: P.n1.caMois[Number(x.m.slice(5))] })), ventes: st.ventes, engagementPct: st.engagementPct, optionsPct: st.optionsPct, optSrc: st.optSrc, boutique: st.boutique, avis: st.avis.n, transfo: tr.team, jourJ: ch.jourJ.length, jourJsans: ch.jourJsans.length, semaines },
    churn: { camp, in21: ch.in21.length, in21Contact: ch.in21Contact.length, resAbo: ch.resAbo.length, resOpt: ch.resOpt.length, sla: ch.sla.length, slaOk: ch.slaOk, slaRetard: ch.slaRetard, vieux: ch.vieux.map(c => ({ nom: c.name || '', num: c.num || '', solde: Number(c.balance) || 0, depuis: c.oldestIncident || c.balanceAt || '' })).sort((a, b) => b.solde - a.solde), vieuxTotal: ch.vieuxTotal, detteSemaines: ch.weeks.map(x => ({ l: dm(x.w), v: x.v })) },
    transfo: { team: tr.team, web: tr.web, webVite: tr.webVite, webConv: tr.webConv, essais: tr.essais, par: Object.entries(tr.by).filter(([k]) => users[k]).map(([k, o]) => ({ nom: users[k], n: o.n, conv: o.conv, taux: o.n ? o.conv / o.n * 100 : null })).sort((a, b) => (b.taux ?? -1) - (a.taux ?? -1)) },
    missions: { rythme: Math.min(1, (dayDiff(r.from, today()) + 1) / daysIn(mk)), ventesMois: sumRange(CLUB.id, null, 'contrats', r.from, r.to), objVentes: mo.ventes || null, caMois: (st.caMois.find(x => x.m === mk) || {}).v ?? null, objCa: mo.ca || null, rdv: cos.filter(c => c.rdvLe && c.rdvLe.slice(0, 7) === mk).length, objRdv: mo.rdvB2B || null, signes: cos.filter(c => c.statut === 'signe' && c.signeLe && c.signeLe >= P.from && c.signeLe <= P.to).length, blackFriday: done.blackFriday || null, videos: done.videos || 'a_faire' },
    primes: { vm: X.vm, avisMois: X.avisMois, avisPrime: X.avisPrime, eq: X.eq, rank: X.rank.slice(0, 3).map(x => ({ nom: fullName(x.u), imp: x.imp, res: x.res })), ind: X.ind.map(x => ({ nom: fullName(x.u), v: x.v, tgt: x.tgt, taux: x.taux, jj: x.jj, paliers: x.paliers, mystere: x.mystere })) },
  };
})()`;
export function chiffres(run, clubId) {
  run(`CLUB = S.clubs[${JSON.stringify(clubId)}] || Object.values(S.clubs || {})[0]; ME = Object.values(S.users || {}).find(u => u.role === 'createur') || Object.values(S.users || {})[0] || { id: 'serveur', role: 'createur' };`);
  return JSON.parse(run(`JSON.stringify(${CALCUL})`));
}

// ── Mise en forme (HTML compatible messageries : tableaux, styles en ligne) ──
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const N = v => (v == null ? 'n.d.' : nf.format(Math.round(v)).replace(/ | /g, ' '));
const EUR = v => (v == null ? 'n.d.' : N(v) + ' €');
const PCT = v => (v == null ? 'n.d.' : Math.round(v) + ' %');
const DM = s => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '');
const MARQUE = '#12B3A8', NOIR = '#0B0B0C', VERT = '#16A34A', ORANGE = '#D97706', ROUGE = '#DC2626', GRIS = '#6B6B70', FOND = '#F3F3F0', LIGNE = '#E4E4DE';
const couleur = (pct, rythme = 1) => (pct == null ? GRIS : pct >= rythme * 0.98 ? VERT : pct >= rythme * 0.85 ? ORANGE : ROUGE);

function tuile(label, valeur, sous = '', c = NOIR) {
  return `<td width="33%" style="padding:6px"><div style="background:#fff;border:1px solid ${LIGNE};border-radius:10px;padding:10px 12px"><div style="font-size:12px;color:${GRIS}">${E(label)}</div><div style="font-size:24px;font-weight:800;color:${c};line-height:1.2">${valeur}</div>${sous ? `<div style="font-size:11px;color:${GRIS}">${sous}</div>` : ''}</div></td>`;
}
const tuiles = L => `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${L.reduce((rows, t, i) => { if (i % 3 === 0) rows.push([]); rows[rows.length - 1].push(t); return rows; }, []).map(r => `<tr>${r.join('')}${'<td width="33%"></td>'.repeat(3 - r.length)}</tr>`).join('')}</table>`;
// Barre de progression avec repère du rythme attendu.
function jauge({ label, reel, cible, fmt = N, rythme = null, n1 = null, note = '', pctMode = false }) {
  const pct = reel != null && cible ? reel / cible : null; const w = Math.max(0, Math.min(100, Math.round((pct || 0) * 100)));
  const c = pctMode ? (pct == null ? GRIS : pct >= 1 ? VERT : pct >= 0.85 ? ORANGE : ROUGE) : couleur(pct, rythme ?? 1);
  const rp = rythme != null ? Math.round(rythme * 100) : null;
  return `<tr><td style="padding:8px 0 2px;font-size:14px"><b>${E(label)}</b></td><td align="right" style="padding:8px 0 2px;font-size:14px;white-space:nowrap"><b style="color:${c};font-size:17px">${fmt(reel)}</b> <span style="color:${GRIS}">/ ${fmt(cible)}</span></td></tr>
  <tr><td colspan="2"><table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${LIGNE};border-radius:6px"><tr>${w > 0 ? `<td width="${w}%" style="background:${c};height:10px;border-radius:6px;font-size:0;line-height:0">&nbsp;</td>` : ''}<td style="height:10px;font-size:0;line-height:0">&nbsp;</td></tr></table>
  ${rp != null ? `<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>${rp > 0 ? `<td width="${rp}%" style="font-size:0;line-height:0;height:4px">&nbsp;</td>` : ''}<td style="border-left:2px solid ${NOIR};font-size:0;line-height:0;height:4px">&nbsp;</td></tr></table>` : ''}</td></tr>
  <tr><td colspan="2" style="font-size:11px;color:${GRIS};padding-bottom:6px">${pct != null ? `${Math.round(pct * 100)} % de la cible` : 'en attente des données'}${rp != null ? ` · rythme attendu ${rp} %` : ''}${n1 != null ? ` · N-1 ${fmt(n1)}` : ''}${note ? ' · ' + note : ''}</td></tr>`;
}
// Histogramme vertical en tableau (les messageries ignorent le SVG).
function histo(items, { fmt = N, h = 110, cible = null, c2 = null } = {}) {
  const max = Math.max(1, cible || 0, ...items.flatMap(i => [i.v || 0, i.v2 || 0]));
  const col = (v, c) => { const px = Math.round(((v || 0) / max) * h); return `<td valign="bottom" align="center" style="padding:0 2px"><div style="font-size:10px;color:${NOIR};font-weight:700;white-space:nowrap">${v == null ? '' : fmt(v)}</div><div style="background:${c};height:${Math.max(px, v ? 2 : 0)}px;width:22px;border-radius:3px 3px 0 0;font-size:0;line-height:0">&nbsp;</div></td>`; };
  return `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:6px auto 0"><tr>${items.map(i => `<td valign="bottom" style="padding:0 6px"><table cellpadding="0" cellspacing="0" role="presentation"><tr>${col(i.v, i.c || MARQUE)}${c2 ? col(i.v2, c2) : ''}</tr></table></td>`).join('')}</tr>
    <tr>${items.map(i => `<td align="center" style="font-size:11px;color:${GRIS};padding-top:4px;border-top:1px solid ${LIGNE}">${E(i.l)}</td>`).join('')}</tr></table>`;
}
const bloc = (titre, corps) => `<tr><td style="padding:14px 18px 4px"><div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:20px;letter-spacing:.5px;text-transform:uppercase;color:${NOIR};border-left:5px solid ${MARQUE};padding-left:8px">${E(titre)}</div></td></tr><tr><td style="padding:4px 18px 10px">${corps}</td></tr>`;
const tableau = (tetes, lignes) => `<table width="100%" cellpadding="6" cellspacing="0" role="presentation" style="border-collapse:collapse;font-size:13px"><tr>${tetes.map((t, i) => `<th align="${i ? 'right' : 'left'}" style="border-bottom:2px solid ${NOIR};font-size:12px">${E(t)}</th>`).join('')}</tr>${lignes.map(l => `<tr>${l.map((v, i) => `<td align="${i ? 'right' : 'left'}" style="border-bottom:1px solid ${LIGNE}">${v}</td>`).join('')}</tr>`).join('')}</table>`;

export function emailRapport(D, { mensuel = false } = {}) {
  const P = D.P, t = P.targets, w = D.semaine, q = D.trimestre, ch = D.churn, tr = D.transfo, mi = D.missions, pr = D.primes;
  const objet = `Fit Pulse · ${D.club} · rapport du ${DM(D.today)} (semaine du ${DM(D.wStart)} au ${DM(D.wEnd)})${mensuel ? ' + point mensuel impayés' : ''}`;
  const rythme = D.elapsed;
  const caN1 = q.caMois.reduce((s, x) => s + (x.n1 || 0), 0);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${E(objet)}</title></head>
<body style="margin:0;background:${FOND};font-family:Arial,Helvetica,sans-serif;color:${NOIR}">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:${FOND}"><tr><td align="center" style="padding:16px 8px">
<table width="640" cellpadding="0" cellspacing="0" role="presentation" style="max-width:640px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:${NOIR};padding:18px 18px 14px"><div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:28px;color:${MARQUE};letter-spacing:1px">FIT PULSE</div>
  <div style="color:#fff;font-size:15px;margin-top:2px"><b>${E(D.club)}</b> · rapport hebdomadaire du ${DM(D.today)}</div>
  <div style="color:#BDBDBD;font-size:12px;margin-top:4px">Semaine du ${DM(D.wStart)} au ${DM(D.wEnd)} · Plan ${E(P.label)} : ${Math.round(rythme * 100)} % du trimestre écoulé</div></td></tr>
${bloc('La semaine', tuiles([
    tuile('Nouveaux abonnements', N(w.ventes)),
    tuile('Résiliations abonnements', N(w.resAbo), '', w.resAbo ? ORANGE : NOIR),
    tuile('Résiliations options', N(w.resOpt), w.optJourJ.length ? `dont ${w.optJourJ.length} le jour de la vente` : 'aucune le jour de la vente', w.optJourJ.length ? ROUGE : NOIR),
    tuile('Fins d’engagement traitées', N(w.fins), 'adhérents appelés'),
    tuile('CA boutique HT', EUR(w.boutique)),
    tuile('Dette récupérée', EUR(w.dette), '', w.dette ? VERT : NOIR),
    tuile('Avis Google gagnés', (w.avis >= 0 ? '+' : '') + N(w.avis), `total ${N(q.avis)} / ${N(t.avis)}`),
  ]) + `<div style="font-size:13px;margin-top:10px"><b>Nouveaux abonnements par semaine</b></div>${histo(q.semaines.map(s => ({ l: s.l, v: s.v })))}`)}
${bloc(`Trimestre ${P.label} · objectifs`, `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    ${jauge({ label: 'Chiffre d’affaires HT', reel: q.ca, cible: t.ca, fmt: EUR, rythme, n1: P.n1.ca, note: q.ca == null ? 'export Factures & avoirs non déposé' : '' })}
    ${jauge({ label: 'Nouveaux abonnements', reel: q.ventes, cible: t.ventes, rythme, n1: P.n1.ventes })}
    ${jauge({ label: 'Ventes avec engagement', reel: q.engagementPct, cible: t.engagementPct, fmt: PCT, pctMode: true })}
    ${jauge({ label: 'CA options / CA abonnements', reel: q.optionsPct, cible: t.optionsPct, fmt: PCT, pctMode: true, n1: P.n1.optionsPct, note: q.optionsPct != null && q.optSrc === 'ventes' ? 'estimé sur les ventes' : '' })}
    ${jauge({ label: 'Boutique HT', reel: q.boutique, cible: t.boutique, fmt: EUR, rythme, n1: P.n1.boutique })}
    ${jauge({ label: 'Taux de transformation équipe', reel: q.transfo, cible: t.transfoEquipe, fmt: PCT, pctMode: true })}
    ${jauge({ label: `Avis Google gagnés (${N(q.avis)} aujourd’hui, objectif ${N(t.avis)})`, reel: q.avis - P.avisDepart, cible: Math.max(1, t.avis - P.avisDepart), rythme: q.avisRythme, note: `départ ${N(P.avisDepart)}` })}
  </table>
  <div style="font-size:13px;margin-top:10px"><b>CA HT par mois</b> <span style="color:${GRIS}">(jaune : ${E(P.label)} · gris : N-1, ${EUR(caN1)} au total)</span></div>${histo(q.caMois.map(x => ({ l: x.m.split(' ')[0], v: x.v, v2: x.n1 })), { fmt: v => (Math.round(v / 100) / 10).toString().replace('.', ',') + ' k', c2: '#BDBDBD' })}`)}
${bloc('Churn', `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">${ch.camp.map(c => jauge({ label: `Fins d’engagement ${c.m} : appelés avant la fin`, reel: c.total ? c.appeles / c.total * 100 : null, cible: t.finsAppelees, fmt: PCT, pctMode: true, note: `${c.appeles} sur ${c.total}` }) + jauge({ label: `Fins d’engagement ${c.m} : conservés (maintien 8 semaines)`, reel: c.total ? c.conserves / c.total * 100 : null, cible: t.finsConservees, fmt: PCT, pctMode: true, note: `${c.conserves} sur ${c.total}` })).join('')}</table>
  ${tuiles([
    tuile('Inactifs depuis 21 jours', N(ch.in21), `${N(ch.in21Contact)} contactés sous 14 jours`),
    tuile('Résiliations du trimestre', `${N(ch.resAbo)} + ${N(ch.resOpt)}`, 'abonnements + options'),
    tuile('Options résiliées jour J', N(q.jourJ), q.jourJsans ? `${q.jourJsans} sans justification` : 'objectif 0, toutes justifiées', q.jourJ ? ROUGE : VERT),
    tuile(`Impayés relancés sous ${t.impayeH} h`, ch.sla ? PCT(ch.slaOk / ch.sla * 100) : 'n.d.', `${ch.slaRetard} en retard`, ch.slaRetard ? ROUGE : NOIR),
    tuile('Impayés de 6 mois et plus', EUR(ch.vieuxTotal), `${ch.vieux.length} adhérents`),
  ])}
  <div style="font-size:13px;margin-top:10px"><b>Dette récupérée par semaine</b></div>${histo(ch.detteSemaines, { fmt: EUR, c: VERT })}
  <div style="font-size:13px;margin-top:12px"><b>Options résiliées le jour de la vente cette semaine</b></div>
  ${w.optJourJ.length ? tableau(['Client', 'Date', 'Commercial', 'Justification'], w.optJourJ.map(x => [E(x.client), DM(x.date), E(x.qui), x.justif ? E(x.justif) : `<b style="color:${ROUGE}">non justifiée</b>`])) : `<div style="font-size:13px;color:${VERT}">Aucune. Objectif tenu.</div>`}`)}
${bloc('Transformation', `${tableau(['Commercial', 'Prospects', 'Inscrits', 'Taux'], tr.par.map(x => [E(x.nom), N(x.n), N(x.conv), `<b style="color:${x.taux == null ? GRIS : x.taux < t.transfoMin ? ROUGE : x.taux >= t.transfoEquipe ? VERT : NOIR}">${PCT(x.taux)}</b>`]).concat([[`<b>Équipe</b>`, '', '', `<b>${PCT(tr.team)}</b>`]]))}
  <div style="font-size:12px;color:${GRIS};margin-top:6px">Cible équipe ${t.transfoEquipe} %, personne sous ${t.transfoMin} %. Leads web : ${N(tr.web)} reçus, ${tr.web ? PCT(tr.webVite / tr.web * 100) : 'n.d.'} rappelés sous ${t.leadWebH} h, ${tr.web ? PCT(tr.webConv / tr.web * 100) : 'n.d.'} transformés (N-1 : ${P.n1.transfoWeb} %). Séances d’essai réservées : ${N(tr.essais)}.</div>`)}
${bloc(`Missions de ${D.mois.toLowerCase()}`, `<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    ${mi.objVentes ? jauge({ label: 'Ventes du mois', reel: mi.ventesMois, cible: mi.objVentes, rythme: mi.rythme }) : ''}
    ${mi.objCa ? jauge({ label: 'CA HT du mois', reel: mi.caMois, cible: mi.objCa, fmt: EUR, rythme: mi.rythme }) : ''}
    ${jauge({ label: `Entreprises (${P.cibles.join(', ')}) : rendez-vous du mois`, reel: mi.rdv, cible: mi.objRdv || 4, note: `${mi.signes} / ${P.partenariats} partenariats signés d’ici fin décembre` })}
  </table>
  <div style="font-size:13px">Black Friday : ${mi.blackFriday ? `liste prête (${N(mi.blackFriday.n)} prospects relancés)` : `liste à préparer avant le ${DM(P.blackFriday)}`} · Vidéos de ciblage : ${{ a_faire: 'à faire', en_cours: 'en cours', publiee: 'publiées' }[mi.videos] || 'à faire'}</div>`)}
${bloc('Primes', `<div style="font-size:13px;margin-bottom:6px">${EUR(P.primes.palier)} par palier. Palier équipe du mois : <b>${N(pr.vm)} / ${N(P.primes.equipeMoisVentes)}</b> ventes${pr.vm >= P.primes.equipeMoisVentes ? ` <b style="color:${VERT}">atteint</b>` : ''}. Avis Google du mois : <b>${N(pr.avisMois)}</b> (${P.primes.avis.map(([n, e]) => `${n} avis = ${EUR(e)}`).join(', ')})${pr.avisPrime ? ` : prime ${EUR(pr.avisPrime)}` : ''}. Paliers d’équipe du trimestre : <b>${pr.eq} / 2</b>.</div>
  ${tableau(['Commercial', 'Ventes / objectif T4', 'Transfo', 'Options jour J', 'Paliers', 'Appel mystère'], pr.ind.map(x => [E(x.nom), `${N(x.v)} / ${x.tgt ? N(x.tgt) : 'n.d.'}`, PCT(x.taux), N(x.jj), `<b>${x.paliers} / 3</b>`, x.mystere === 'ko' ? `<b style="color:${ROUGE}">non pris : pas de prime</b>` : x.mystere === 'ok' ? `<span style="color:${VERT}">coordonnées prises</span>` : 'pas testé']))}
  ${pr.rank.length && (pr.rank[0].imp + pr.rank[0].res) ? `<div style="font-size:13px;margin-top:6px">Meilleur récupérateur du mois (impayés + résiliations sauvées) : <b>${E(pr.rank[0].nom)}</b> (${pr.rank[0].imp} + ${pr.rank[0].res}), à valider en individuel.</div>` : ''}`)}
${mensuel ? bloc('Point mensuel : impayés de 6 mois et plus', `<div style="font-size:13px;margin-bottom:6px"><b>${ch.vieux.length}</b> adhérents, <b>${EUR(ch.vieuxTotal)}</b> au total.</div>${ch.vieux.length ? tableau(['Adhérent', 'N°', 'Solde', 'Premier impayé'], ch.vieux.slice(0, 25).map(x => [E(x.nom), E(x.num), EUR(x.solde), DM(x.depuis) + (x.depuis ? '/' + x.depuis.slice(0, 4) : '')])) + (ch.vieux.length > 25 ? `<div style="font-size:12px;color:${GRIS}">… et ${ch.vieux.length - 25} autres (liste complète dans Fit Pulse, Plan T4 › Churn).</div>` : '') : ''}`) : ''}
<tr><td style="padding:14px 18px 18px;font-size:11px;color:${GRIS};border-top:1px solid ${LIGNE}">Chiffres issus des exports Resamania déposés dans Fit Pulse et des relances saisies par l’équipe. « n.d. » : donnée pas encore importée. Rapport envoyé automatiquement chaque lundi à 15 h.<br>© 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Document interne et confidentiel.</td></tr>
</table></td></tr></table></body></html>`;
  const L = [`${objet}`, '', `SEMAINE : ${N(w.ventes)} abonnements · résiliations ${N(w.resAbo)} abonnements / ${N(w.resOpt)} options · ${N(w.fins)} fins d’engagement traitées · boutique ${EUR(w.boutique)} HT · dette récupérée ${EUR(w.dette)} · avis +${N(w.avis)}`,
    `TRIMESTRE : CA ${EUR(q.ca)} / ${EUR(t.ca)} · abonnements ${N(q.ventes)} / ${N(t.ventes)} · engagement ${PCT(q.engagementPct)} / ${t.engagementPct} % · options ${PCT(q.optionsPct)} / ${t.optionsPct} % · boutique ${EUR(q.boutique)} / ${EUR(t.boutique)} · transformation ${PCT(q.transfo)} / ${t.transfoEquipe} % · avis ${N(q.avis)} / ${N(t.avis)}`,
    `CHURN : inactifs 21 j ${N(ch.in21)} · options résiliées jour J ${N(q.jourJ)} · impayés ≥ 6 mois ${EUR(ch.vieuxTotal)}`, '', 'Version graphique : ouvrez cet e-mail en HTML.'];
  return { objet, texte: L.join('\n'), html };
}

// ── Planification : lundi 15 h pile, une fois par semaine ─────────────────
export const paris = (d = new Date()) => { const f = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(d); const g = k => (f.find(x => x.type === k) || {}).value; return { j: g('weekday'), h: Number(g('hour')), m: Number(g('minute')), s: Number(g('second')), date: `${g('year')}-${g('month')}-${g('day')}` }; };
export function quandEnvoyer(now = new Date()) {
  const p = paris(now); if (!/^lun/i.test(p.j)) return { action: 'non' };
  const avant = ((HEURE - p.h) * 3600 - p.m * 60 - p.s) * 1000;
  if (avant > 0 && avant <= ATTENTE_MAX) return { action: 'attendre', ms: avant, semaine: p.date };
  if (avant <= 0 && p.h < 23) return { action: 'envoyer', semaine: p.date };
  return { action: 'non' };
}
const premierLundiDuMois = date => Number(date.slice(8, 10)) <= 7;

// api(tk, chemin, opts), envoyer(dest, {objet,texte,html}) : fournis par le serveur.
export async function passageRapport(api, tk, S, envoyer, { log = console.log, dormir = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const demande = (S.rapport && S.rapport.demande) || (process.env.APERCU_RAPPORT === 'true' ? { at: Date.now(), to: 'apercu', manuel: true } : null);
  const q = quandEnvoyer();
  if (!demande && q.action === 'non') return 'pas l’heure';
  const clubs = Object.keys(S.clubs || {}).filter(id => S.clubs[id] && !S.clubs[id].archived);
  const avecPlan = clubs.filter(id => S.plans && S.plans[id]); const cibles = avecPlan.length ? avecPlan : clubs.slice(0, 1);
  const out = [];
  if (demande) {
    // « Envoyer maintenant » depuis l'appli : aperçu au club, ou envoi réel au directeur.
    if (!demande.manuel) await api(tk, 'pulse/rapport/demande.json', { method: 'DELETE' });
    if (Date.now() - (Number(demande.at) || 0) < 6 * 3600000) {
      const run = chargerAppli(S); const D = chiffres(run, demande.club || cibles[0]);
      const dest = demande.to === 'directeur' ? [D.P.directeur, D.P.copie] : [D.P.copie || D.P.directeur];
      const m = emailRapport(D, { mensuel: premierLundiDuMois(D.today) });
      for (const d of [...new Set(dest.filter(Boolean))]) { await envoyer(d, demande.to === 'directeur' ? m : { ...m, objet: 'Aperçu · ' + m.objet }); }
      await api(tk, 'pulse/serveur/rapport.json', { method: 'PUT', body: JSON.stringify({ at: Date.now(), dest: dest.filter(Boolean).length, mode: demande.to === 'directeur' ? 'directeur' : 'apercu' }) });
      out.push(`demande ${demande.to === 'directeur' ? 'directeur' : 'aperçu'} envoyée`);
    }
  }
  if (q.action === 'non') return out.join(' · ');
  for (const id of cibles) {
    const cle = `fitpulse_secret/rapport/${id}/${q.semaine}`;
    const deja = await (await api(tk, cle + '.json')).json();
    if (deja) { out.push(`${id} : déjà envoyé`); continue; }
    if (q.action === 'attendre') { log(`Rapport : attente de ${Math.round(q.ms / 1000)} s jusqu’à 15 h pile`); await dormir(q.ms); }
    // Réservation (deux passages simultanés : un seul envoie).
    const jeton = webcrypto.randomUUID();
    await api(tk, cle + '.json', { method: 'PUT', body: JSON.stringify({ jeton, at: Date.now() }) });
    await dormir(1500);
    const lu = await (await api(tk, cle + '.json')).json();
    if (!lu || lu.jeton !== jeton) { out.push(`${id} : pris par un autre passage`); continue; }
    try {
      const run = chargerAppli(S); const D = chiffres(run, id); const m = emailRapport(D, { mensuel: premierLundiDuMois(D.today) });
      const dest = [...new Set([D.P.directeur, D.P.copie].filter(Boolean))];
      for (const d of dest) await envoyer(d, m);
      await api(tk, cle + '.json', { method: 'PUT', body: JSON.stringify({ jeton, at: Date.now(), envoye: true, dest: dest.length }) });
      await api(tk, 'pulse/serveur/rapport.json', { method: 'PUT', body: JSON.stringify({ at: Date.now(), dest: dest.length, mode: 'lundi' }) });
      out.push(`${id} : envoyé à ${dest.length} destinataire(s)`);
    } catch (e) {
      await api(tk, cle + '.json', { method: 'DELETE' }); // réessai au passage suivant
      out.push(`${id} : ÉCHEC ${e.message}`);
    }
  }
  return out.join(' · ');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href && process.argv[2] === 'apercu') {
  const D = chiffres(chargerAppli('demo'), null);
  writeFileSync(process.argv[3] || 'apercu-rapport.html', emailRapport(D, { mensuel: true }).html);
  console.log('aperçu écrit :', D.club, D.wStart, '→', D.wEnd);
}
