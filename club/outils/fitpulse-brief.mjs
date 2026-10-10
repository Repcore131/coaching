/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — brief du matin, 7 h 30 du lundi au samedi ════════════════════
// Par club : KPI de la veille, rythme du mois en jours ouvrés, les 5 actions les
// plus rentables (briefData, brief.js : le même calcul que la page Opportunités).
// Un e-mail sobre à chaque manager du club, et une notification push s'il a un
// téléphone abonné. Préférence « digest » de chacun respectée (désactivée : rien).
// Aucun nom d'adhérent dans la notification ; les noms restent dans l'appli et
// dans l'e-mail adressé au manager.
// L'heure est celle de Paris (Intl, fuseau Europe/Paris) : 7 h 30 l'été comme
// l'hiver, changement d'heure compris.
//   node club/outils/fitpulse-brief.mjs apercu brief.html   (données de démo)
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chargerAppli, paris } from './fitpulse-rapport.mjs';
import { sendPush } from './fitpulse-push.mjs';

export const HEURE = 7, MINUTE = 30;
const ATTENTE_MAX = Number(process.env.BRIEF_ATTENTE_MIN || 4) * 60000;
const SITE = (process.env.FITPULSE_URL || 'https://fitpulse-niort.web.app').replace(/\/$/, '');
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' €';
const val = (n, unit) => unit === 'eur' ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n || 0) + ' €' : new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n || 0);
const pct = p => p == null ? 'n.d.' : Math.round(p * 100) + ' %';

// Lundi à samedi, 7 h 30 heure de Paris.
export function quandBrief(now = new Date()) {
  const p = paris(now); if (/^dim/i.test(p.j)) return { action: 'non' };
  const avant = ((HEURE - p.h) * 3600 + (MINUTE - p.m) * 60 - p.s) * 1000;
  if (avant > 0 && avant <= ATTENTE_MAX) return { action: 'attendre', ms: avant, jour: p.date };
  if (avant <= 0 && p.h < 12) return { action: 'envoyer', jour: p.date };
  return { action: 'non' };
}
// Destinataires : managers actifs du club, avec une adresse, préférence digest active.
export function destinataires(S, clubId) {
  return Object.values(S.users || {}).filter(u => u && u.role === 'manager' && u.status !== 'archived' && (u.clubs || []).includes(clubId) && (p => (p.notif && p.notif.digest !== undefined ? p.notif.digest : p.digest) !== false)((S.prefs || {})[u.id] || {}));
}
export function briefPour(S, clubId, run = chargerAppli(S)) {
  run(`CLUB = S.clubs[${JSON.stringify(clubId)}]; ME = Object.values(S.users || {}).find(u => u.role === 'manager' && (u.clubs || []).includes(CLUB.id)) || { id: 'serveur', role: 'manager', clubs: [CLUB.id] };`);
  return JSON.parse(run(`JSON.stringify(briefData(${JSON.stringify(clubId)}))`));
}
export function emailBrief(D) {
  const jj = `${D.veille.slice(8, 10)}/${D.veille.slice(5, 7)}`;
  const objet = `Brief du matin · ${D.club} · ${eur(D.total)} attendus`;
  const lignesKpi = D.kpis.map(k => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${E(k.label)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${val(k.veille, k.unit)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${val(k.mois, k.unit)} / ${val(k.objectif, k.unit)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${pct(k.rythme)}</td></tr>`).join('');
  const lignesOpp = D.top.map((o, i) => `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i + 1}. ${E(o.titre)}<br><span style="color:#666;font-size:12px">${E(o.label)}${o.client ? ' · ' + E(o.client) : ''}</span></td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;white-space:nowrap"><b>${eur(o.euros)}</b></td></tr>`).join('');
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#f4f4f2;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:16px 8px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#fff;border-radius:10px">
<tr><td style="padding:18px 20px 6px"><div style="font-size:13px;color:#666">Fit Pulse · brief du matin</div><div style="font-size:20px;font-weight:bold;margin-top:2px">${E(D.club)}</div>
<div style="font-size:14px;color:#444;margin-top:6px">Mois : ${D.ouvres.ecoules} jours ouvrés passés sur ${D.ouvres.total}, ${D.ouvres.restants} restants.</div></td></tr>
<tr><td style="padding:10px 20px"><div style="font-weight:bold;margin-bottom:6px">Vos 5 actions les plus rentables aujourd’hui : ${eur(D.total)} attendus</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:14px">${lignesOpp || '<tr><td style="color:#666">Aucune action ouverte.</td></tr>'}</table></td></tr>
<tr><td style="padding:10px 20px"><div style="font-weight:bold;margin-bottom:6px">Chiffres de la veille (${jj}) et rythme du mois</div>
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="font-size:14px"><tr style="color:#666;font-size:12px"><td style="padding:4px 8px">Indicateur</td><td style="padding:4px 8px;text-align:right">Veille</td><td style="padding:4px 8px;text-align:right">Mois / objectif</td><td style="padding:4px 8px;text-align:right">Rythme</td></tr>${lignesKpi}</table>
<div style="font-size:12px;color:#666;margin-top:6px">Rythme : réalisé du mois rapporté à l’objectif au prorata des jours ouvrés (lundi au samedi, hors jours fériés).</div></td></tr>
<tr><td style="padding:14px 20px 20px"><a href="${SITE}/#/opportunites" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:bold">Ouvrir Fit Pulse</a>
<div style="font-size:12px;color:#888;margin-top:12px">Vous recevez ce brief parce que l’option « Bilan de la semaine et brief du matin » est active dans Mon profil. Désactivez-la pour ne plus le recevoir.</div></td></tr>
</table></td></tr></table></body></html>`;
  const texte = [`Brief du matin · ${D.club}`, `Vos 5 actions les plus rentables aujourd’hui : ${eur(D.total)} attendus`, ...D.top.map((o, i) => `${i + 1}. ${o.titre}${o.client ? ' · ' + o.client : ''} : ${eur(o.euros)}`), '', `Veille (${jj}) et rythme du mois :`, ...D.kpis.map(k => `${k.label} : ${val(k.veille, k.unit)} hier, ${val(k.mois, k.unit)} / ${val(k.objectif, k.unit)}, rythme ${pct(k.rythme)}`), '', `${SITE}/#/opportunites`].join('\n');
  return { objet, html, texte };
}
// Notification : chiffres seulement, jamais de nom d'adhérent.
export const pushBrief = D => ({ title: 'Brief du matin', body: `${D.top.length} actions prioritaires, ${eur(D.total)} attendus aujourd’hui.`, url: '#/opportunites', tag: 'brief' });

// Un passage : api(tk, chemin, opts) ; envoyer(dest, { objet, texte, html }).
export async function passageBrief(api, tk, S, envoyer, { now = new Date(), force = false, dormir = ms => new Promise(r => setTimeout(r, ms)), log = console.log, push = true } = {}) {
  const q = force ? { action: 'envoyer', jour: paris(now).date } : quandBrief(now);
  if (q.action === 'non') return 'pas l’heure';
  if (q.action === 'attendre') await dormir(q.ms);
  const deja = ((S.brief || {}).sent || {})[q.jour] || {};
  const clubs = Object.keys(S.clubs || {}).filter(id => S.clubs[id] && !S.clubs[id].archived && !deja[id]);
  if (!clubs.length) return 'déjà envoyé';
  let secret = null; if (push) { try { secret = (await (await api(tk, 'fitpulse_secret.json')).json()) || {}; } catch (e) { secret = null; } }
  const subs = push && secret && secret.vapid ? ((await (await api(tk, 'pulse_push.json')).json()) || {}) : {};
  const out = []; const run = chargerAppli(S);
  for (const clubId of clubs) {
    const dest = destinataires(S, clubId); if (!dest.length) { out.push(`${clubId} : aucun destinataire`); continue; }
    const D = briefPour(S, clubId, run); const m = emailBrief(D); let mails = 0, pushs = 0;
    for (const u of dest) {
      if (u.email) { try { await envoyer(u.email, m); mails++; } catch (e) { log && log('brief e-mail :', e.message); } }
      for (const sub of Object.values(subs[u.id] || {})) { try { const st = await sendPush(sub, pushBrief(D), secret.vapid, { ttl: 6 * 3600 }); if (st < 300) pushs++; } catch (e) { /* téléphone injoignable */ } }
    }
    await api(tk, `pulse/brief/sent/${q.jour}/${clubId}.json`, { method: 'PUT', body: JSON.stringify({ at: Date.now(), total: D.total, mails, pushs }) });
    out.push(`${clubId} : ${mails} e-mail(s), ${pushs} notification(s), ${eur(D.total)} attendus`);
  }
  log && log('Brief du matin : ' + out.join(' ; '));
  return out.join(' ; ');
}

// Aperçu : node club/outils/fitpulse-brief.mjs apercu brief.html
if (import.meta.url === pathToFileURL(process.argv[1] || '').href && process.argv[2] === 'apercu') {
  const run = chargerAppli('demo'); const S = JSON.parse(run('JSON.stringify(S)'));
  writeFileSync(process.argv[3] || 'apercu-brief.html', emailBrief(briefPour(S, Object.keys(S.clubs)[0])).html); console.log('aperçu écrit');
}
