/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. */
// ══ FIT PULSE — Récap KPI de 8 h 45 ════════════════════════════════════════
// Chaque matin à 8 h 45 (Paris), le message « Résultat du jour » de la veille
// (même modèle et mêmes chiffres que la page KPI du matin) part par e-mail à
// l'accueil, avec un bouton « Envoyer sur WhatsApp » : un appui, on choisit le
// groupe, c'est envoyé. En attendant l'envoi WhatsApp automatique (Meta).
//   node club/outils/fitpulse-matin.mjs apercu matin.html   (données de démo)
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { chargerAppli, paris } from './fitpulse-rapport.mjs';

const HEURE = 8, MINUTE = 45;
const ATTENTE_MAX = Number(process.env.MATIN_ATTENTE_MIN || 4) * 60000;
const DEFAUT = 'kevinguellec.pro@gmail.com';
const E = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function quandMatin(now = new Date()) {
  const p = paris(now); const avant = ((HEURE - p.h) * 3600 + (MINUTE - p.m) * 60 - p.s) * 1000;
  if (avant > 0 && avant <= ATTENTE_MAX) return { action: 'attendre', ms: avant, jour: p.date };
  if (avant <= 0 && p.h < 12) return { action: 'envoyer', jour: p.date };
  return { action: 'non' };
}

// Le message du jour, par le code de la page KPI du matin.
export function messageMatin(run, clubId) {
  run(`CLUB = S.clubs[${JSON.stringify(clubId)}] || Object.values(S.clubs || {})[0]; ME = Object.values(S.users || {}).find(u => u.role === 'createur') || Object.values(S.users || {})[0] || { id: 'serveur', role: 'createur' }; UI.km = null;`);
  return JSON.parse(run(`JSON.stringify({ texte: kmBuild(), club: CLUB.name, jour: kmState().day, cfg: kmCfg(), copie: (typeof planOf === 'function' ? planOf().copie : '') })`));
}

export function emailMatin(M) {
  const wa = 'https://wa.me/?text=' + encodeURIComponent(M.texte);
  const jj = `${M.jour.slice(8, 10)}/${M.jour.slice(5, 7)}`;
  const objet = `KPI du matin · ${M.club} · résultats du ${jj}`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:#F3F3F0;font-family:Arial,Helvetica,sans-serif;color:#0B0B0C">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr><td align="center" style="padding:16px 8px">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:#0B0B0C;padding:16px 18px"><div style="font-family:Impact,'Arial Narrow',Arial,sans-serif;font-size:24px;color:#FFD600;letter-spacing:1px">FIT PULSE</div>
<div style="color:#fff;font-size:14px;margin-top:2px">KPI du matin · ${E(M.club)} · résultats du ${jj}</div></td></tr>
<tr><td style="padding:18px 18px 6px" align="center">
<a href="${E(wa)}" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:700;font-size:17px;padding:14px 26px;border-radius:999px">Envoyer sur WhatsApp</a>
<div style="font-size:12px;color:#6B6B70;margin-top:8px">Un appui ouvre WhatsApp avec le message prêt : choisissez le groupe${M.cfg && M.cfg.group ? ` « ${E(M.cfg.group)} »` : ''}, puis Envoyer.</div></td></tr>
<tr><td style="padding:10px 18px 18px"><div style="background:#F3F3F0;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.5;white-space:pre-wrap">${E(M.texte)}</div>
<div style="font-size:11px;color:#6B6B70;margin-top:10px">Chiffres de Fit Pulse (imports Resamania et relances). Pour corriger avant d’envoyer : page KPI du matin de l’appli.</div></td></tr>
</table></td></tr></table></body></html>`;
  return { objet, texte: `${M.texte}\n\nEnvoyer sur WhatsApp : ${wa}`, html };
}

// api(tk, chemin, opts), envoyer(dest, {objet,texte,html}) : fournis par le serveur.
export async function passageMatin(api, tk, S, envoyer, { log = console.log, dormir = ms => new Promise(r => setTimeout(r, ms)), force = false } = {}) {
  const q = force ? { action: 'envoyer', jour: paris().date } : quandMatin();
  if (q.action === 'non') return 'pas l’heure';
  const clubs = Object.keys(S.clubs || {}).filter(id => S.clubs[id] && !S.clubs[id].archived);
  const cibles = clubs.filter(id => S.plans && S.plans[id]).length ? clubs.filter(id => S.plans && S.plans[id]) : clubs.slice(0, 1);
  const out = [];
  for (const id of cibles) {
    const cle = `fitpulse_secret/matin/${id}/${q.jour}`;
    if (!force && await (await api(tk, cle + '.json')).json()) { out.push(`${id} : déjà envoyé`); continue; }
    if (q.action === 'attendre') { log(`KPI du matin : attente de ${Math.round(q.ms / 1000)} s jusqu’à 8 h 45`); await dormir(q.ms); }
    const jeton = webcrypto.randomUUID();
    if (!force) {
      await api(tk, cle + '.json', { method: 'PUT', body: JSON.stringify({ jeton, at: Date.now() }) });
      await dormir(1500);
      const lu = await (await api(tk, cle + '.json')).json();
      if (!lu || lu.jeton !== jeton) { out.push(`${id} : pris par un autre passage`); continue; }
    }
    try {
      const M = messageMatin(chargerAppli(S), id);
      const dest = (M.cfg && M.cfg.email) || M.copie || DEFAUT;
      await envoyer(dest, emailMatin(M));
      if (!force) await api(tk, cle + '.json', { method: 'PUT', body: JSON.stringify({ jeton, at: Date.now(), envoye: true }) });
      await api(tk, 'pulse/serveur/matin.json', { method: 'PUT', body: JSON.stringify({ at: Date.now(), jour: M.jour }) });
      out.push(`${id} : envoyé`);
    } catch (e) {
      if (!force) await api(tk, cle + '.json', { method: 'DELETE' });
      out.push(`${id} : ÉCHEC ${e.message}`);
    }
  }
  return out.join(' · ');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href && process.argv[2] === 'apercu') {
  const M = messageMatin(chargerAppli('demo'), null);
  writeFileSync(process.argv[3] || 'apercu-matin.html', emailMatin(M).html);
  console.log('aperçu écrit :', M.club, M.jour);
}
