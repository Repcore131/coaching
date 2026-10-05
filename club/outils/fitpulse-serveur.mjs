// ══ FIT PULSE — serveur : règles d'accès + e-mails d'invitation ═══════════════
//
// Lance par .github/workflows/fitpulse-mail.yml (toutes les 5 minutes).
//  1. S'assure que les regles Fit Pulse sont dans la base (elles peuvent
//     disparaitre quand RepCore redeploie ses regles depuis main : on les remet)
//     et que les cles de connexion des comptes de config.js existent.
//  2. Lit /fitpulse_mail (ecrit par l'app quand un code est cree), envoie un
//     e-mail d'invitation par demande, puis efface la demande (et donc le code).
// Aucune dependance : JWT, HTTPS et SMTP sur TLS ecrits a la main, comme
// scripts/envoyer_mail.mjs (le mot de passe de la messagerie ne passe par
// aucun paquet tiers).
//
// Variables : FIREBASE_SERVICE_ACCOUNT, MAIL_UTILISATEUR, MAIL_MOT_DE_PASSE,
//             FITPULSE_URL (https://fitpulse-niort.web.app), DRY_RUN=1 pour tester.

import crypto from 'node:crypto';
import tls from 'node:tls';
import { pathToFileURL } from 'node:url';
import { writeFileSync, readFileSync } from 'node:fs';
import { passagePush } from './fitpulse-push.mjs';

const DB = process.env.FIREBASE_DB_URL || 'https://repcore-sync-default-rtdb.firebaseio.com';
const SITE = (process.env.FITPULSE_URL || 'https://fitpulse-niort.web.app').replace(/\/$/, '');
const UTIL = process.env.MAIL_UTILISATEUR || 'guellec.coachingpro@gmail.com';
const MDP = process.env.MAIL_MOT_DE_PASSE || '';
const DRY = process.env.DRY_RUN === '1';
const MAX_PAR_PASSAGE = 25;

// ── Règles Fit Pulse ──────────────────────────────────────────────────────
// Posées dans la base repcore-sync entre deux balises, et remises à chaque
// passage (RepCore redéploie ses règles depuis main : le bloc peut sauter).
//  /pulse          : données de l'équipe. Ouvert SEULEMENT à un compte
//                    fp-{clé}@fitpulse-niort.web.app dont la clé est dans /pulse_boot.
//  /pulse_boot/{k} : clé de connexion (SHA-256 e-mail|code) → id du membre.
//                    Lisible une par une (savoir si un code existe), jamais en
//                    liste sauf manager. Écrite par un manager, ou par le
//                    membre lui-même quand il change son code.
//  /fitpulse_mail  : boîte d'envoi des invitations, déposées par un manager,
//                    jamais relues côté client, effacées après envoi.
const MEMBRE = `auth != null && auth.token.email.endsWith('@fitpulse-niort.web.app') && root.child('pulse_boot/' + auth.token.email.replace('@fitpulse-niort.web.app', '').replace('fp-', '')).exists()`;
const SOI = `root.child('pulse_boot/' + auth.token.email.replace('@fitpulse-niort.web.app', '').replace('fp-', '')).val()`;
const MANAGER = `auth != null && auth.token.email.endsWith('@fitpulse-niort.web.app') && root.child('pulse_boot/' + auth.token.email.replace('@fitpulse-niort.web.app', '').replace('fp-', '')).exists() && (root.child('pulse/users/' + root.child('pulse_boot/' + auth.token.email.replace('@fitpulse-niort.web.app', '').replace('fp-', '')).val() + '/role').val() === 'manager' || root.child('pulse/users/' + root.child('pulse_boot/' + auth.token.email.replace('@fitpulse-niort.web.app', '').replace('fp-', '')).val() + '/role').val() === 'createur')`;
export const DEBUT = '// >>> FITPULSE (bloc gere par club/outils/fitpulse-serveur.mjs : ne pas modifier a la main)';
export const FIN = '// <<< FITPULSE';
const j = s => JSON.stringify(s);
// Rôle et statut du compte connecté, lus dans /pulse/users/{id} (l'id vient de /pulse_boot).
const ROLE = `root.child('pulse/users/' + ${SOI} + '/role').val()`;
const CREATEUR = `${MEMBRE} && ${ROLE} === 'createur'`;
const MGR = `(${MANAGER})`;
// Une saisie : la sienne, ou celle qu'on a créée pour un collègue (sauvetage,
// impayé récupéré sur son dossier). Le reste : manager.
const SAISIE = `${MGR} || (${MEMBRE} && (newData.exists() ? (newData.child('userId').val() === ${SOI} || (newData.child('by').val() === ${SOI} && (newData.child('kpiId').val() === 'sauvetage' || newData.child('kpiId').val() === 'impayes'))) : (data.child('userId').val() === ${SOI} || data.child('by').val() === ${SOI})))`;
const FICHE = `${MGR} && (${CREATEUR} || (data.child('role').val() !== 'createur' && (!newData.exists() || newData.child('role').val() === 'membre' || newData.child('role').val() === data.child('role').val())))`;
const SOIMEME = `${MEMBRE} && $uid === ${SOI}`;
export const REGLE = `${DEBUT}
    "pulse": {
      ".read": ${j(MEMBRE)},
      ".write": ${j(`${CREATEUR} || (${MEMBRE} && !data.exists())`)},
      "users": {
        "$uid": {
          ".write": ${j(FICHE)},
          "first": { ".write": ${j(SOIMEME)} }, "last": { ".write": ${j(SOIMEME)} }, "avatar": { ".write": ${j(SOIMEME)} },
          "salt": { ".write": ${j(SOIMEME)} }, "codeHash": { ".write": ${j(SOIMEME)} }, "bootKey": { ".write": ${j(SOIMEME)} },
          "status": { ".write": ${j(`${SOIMEME} && data.val() === 'pending' && newData.val() === 'active'`)} }
        }
      },
      "entries": {
        "$id": {
          ".write": ${j(SAISIE)},
          "checkedAt": { ".validate": ${j(`data.val() === newData.val() || ${MGR}`)} },
          "checkedBy": { ".validate": ${j(`data.val() === newData.val() || ${MGR}`)} },
          ".validate": "newData.hasChildren(['userId', 'kpiId', 'date', 'value']) && newData.child('value').isNumber() && newData.child('value').val() > -1000000 && newData.child('value').val() < 1000000 && newData.child('date').isString() && newData.child('date').val().matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)"
        }
      },
      "prefs": { "$uid": { ".write": ${j(SOIMEME)} } },
      "tasks": {
        "library": { ".write": ${j(MGR)} },
        "plan": { ".write": ${j(MGR)} },
        "done": { ".write": ${j(MEMBRE)} }
      },
      "chat": {
        "$id": {
          ".write": ${j(`${MEMBRE} && (${MGR} || !data.exists() || data.child('userId').val() === ${SOI} || newData.exists())`)},
          ".validate": "!newData.child('text').exists() || (newData.child('text').isString() && newData.child('text').val().length <= 2000)",
          "image": { ".validate": "newData.isString() && newData.val().beginsWith('data:image/') && newData.val().length < 400000" }
        }
      },
      "clients": { ".write": ${j(MEMBRE)} },
      "loyalty": { ".write": ${j(MEMBRE)} },
      "resiliations": { ".write": ${j(MEMBRE)} },
      "recov": { ".write": ${j(MEMBRE)} },
      "reactions": { ".write": ${j(MEMBRE)} },
      "relances": { ".write": ${j(MEMBRE)} },
      "touches": { ".write": ${j(MEMBRE)} },
      "guests": { ".write": ${j(MEMBRE)} },
      "companies": { ".write": ${j(MEMBRE)} },
      "opps": { ".write": ${j(MEMBRE)} },
      "kudos": { "$day": { "$uid": { ".write": ${j(SOIMEME)} } } },
      "audit": { "$id": { ".write": ${j(`${MEMBRE} && !data.exists() && newData.exists()`)} } },
      "logs": { "$club": { "$day": { "$id": { ".write": ${j(`${MEMBRE} && !data.exists() && newData.exists()`)} } } } },
      "coaching": { "$uid": { "actions": { ".write": ${j(MEMBRE)} } } },
      "$autre": { ".write": ${j(MGR)} }
    },
    "pulse_boot": {
      ".read": ${j(MANAGER)},
      "$k": {
        ".read": true,
        ".write": ${j(`${MEMBRE} && ((${MANAGER}) || newData.val() === ${SOI} || (!newData.exists() && data.val() === ${SOI}))`)},
        ".validate": "$k.matches(/^[0-9a-f]{40}$/) && newData.isString() && newData.val().length >= 1 && newData.val().length <= 40"
      }
    },
    "pulse_inbox": {
      "$uid": {
        ".read": ${j(`${MEMBRE} && $uid === ${SOI}`)},
        "$id": { "readAt": { ".write": ${j(`${MEMBRE} && $uid === ${SOI} && data.parent().exists()`)} } }
      }
    },
    "pulse_push": {
      "$uid": {
        ".read": false,
        ".write": ${j(`${MEMBRE} && $uid === ${SOI}`)},
        "$h": { ".validate": "newData.hasChildren(['endpoint', 'keys', 'at']) && newData.child('endpoint').isString() && newData.child('endpoint').val().beginsWith('https://') && newData.child('endpoint').val().length < 1000" }
      }
    },
    "fitpulse_mail": {
      ".read": false,
      "$id": {
        ".write": ${j(`${MANAGER} && !data.exists() && newData.exists() && $id.length <= 40`)},
        ".validate": "newData.hasChildren(['email', 'first', 'code', 'role', 'club', 'at']) && newData.child('at').val() == now",
        "email": { ".validate": "newData.isString() && newData.val().length <= 254 && newData.val().matches(/^[^@ ]+@[^@ ]+[.][a-zA-Z]{2,24}$/)" },
        "first": { ".validate": "newData.isString() && newData.val().length >= 1 && newData.val().length <= 40" },
        "code": { ".validate": "newData.isString() && newData.val().matches(/^FP-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/)" },
        "role": { ".validate": "newData.val() == 'membre' || newData.val() == 'manager' || newData.val() == 'createur'" },
        "club": { ".validate": "newData.isString() && newData.val().length <= 60" },
        "by": { ".validate": "newData.isString() && newData.val().length <= 60" },
        "at": { ".validate": "newData.isNumber()" },
        "$autre": { ".validate": false }
      }
    },
    ${FIN}`;

// ── Jeton Google à partir du compte de service ────────────────────────────
async function jeton() {
  const c = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  if (!c.client_email || !c.private_key) throw new Error('FIREBASE_SERVICE_ACCOUNT absent ou invalide');
  const b64u = b => Buffer.from(b).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const tete = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corps = b64u(JSON.stringify({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${tete}.${corps}`).sign(c.private_key, 'base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${tete}.${corps}.${sig}` });
  const j = await r.json(); if (!j.access_token) throw new Error('jeton refusé : ' + JSON.stringify(j));
  return j.access_token;
}
const api = async (tk, chemin, opts = {}) => {
  const r = await fetch(`${DB}/${chemin}`, { ...opts, headers: { authorization: `Bearer ${tk}`, ...(opts.headers || {}) } });
  if (!r.ok) throw new Error(`${opts.method || 'GET'} ${chemin} → ${r.status} ${await r.text()}`);
  return r;
};

export function avecRegle(texte) {
  // ancien bloc (balise) retire, puis le bloc a jour pose juste apres "rules": {
  let t = texte;
  const i = t.indexOf(DEBUT), k = t.indexOf(FIN);
  if (i >= 0 && k > i) t = t.slice(0, i).replace(/\s*$/, '') + t.slice(k + FIN.length);
  const m = t.match(/"rules"\s*:\s*\{/);
  if (!m) throw new Error('structure des règles inattendue : rien modifié');
  return t.slice(0, m.index + m[0].length) + '\n    ' + REGLE + t.slice(m.index + m[0].length);
}
async function assurerRegle(tk) {
  const texte = await (await api(tk, '.settings/rules.json')).text();
  if (texte.includes(REGLE)) return 'déjà en place';
  const neuf = avecRegle(texte);
  if (DRY) return 'à mettre à jour (essai : rien écrit)';
  await api(tk, '.settings/rules.json', { method: 'PUT', body: neuf });
  return 'mise à jour';
}
// Comptes declares dans club/config.js (createur, manager) : leur cle de
// connexion est posee si elle manque.
async function assurerComptes(tk) {
  const src = readFileSync(new URL('../config.js', import.meta.url), 'utf8');
  const comptes = [...src.matchAll(/id: '([^']+)'[^\n]*?bootKey: '([0-9a-f]{40})'/g)].map(m => ({ id: m[1], cle: m[2] }));
  const faits = [];
  for (const c of comptes) {
    const v = await (await api(tk, `pulse_boot/${c.cle}.json`)).json();
    if (v === c.id) continue;
    if (!DRY) await api(tk, `pulse_boot/${c.cle}.json`, { method: 'PUT', body: JSON.stringify(c.id) });
    faits.push(c.id);
  }
  return faits.length ? 'posées : ' + faits.join(', ') : `${comptes.length} déjà en place`;
}

// ── L'e-mail ──────────────────────────────────────────────────────────────
const ROLES = { membre: 'Membre', manager: 'Manager', createur: 'Créateur' };
const echap = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function emailInvitation(d) {
  const lien = `${SITE}/?email=${encodeURIComponent(d.email)}`;
  const role = ROLES[d.role] || 'Membre';
  const objet = `${d.first}, votre accès Fit Pulse est prêt`;
  const texte = [
    `Bonjour ${d.first},`, '',
    `Bienvenue dans Fit Pulse, l'application commerciale de ${d.club}.`,
    `Votre accès : ${role}`, '',
    `Votre code personnel : ${d.code}`, `Votre identifiant : ${d.email}`, '',
    `1. Ouvrez ${lien}`, `2. Connectez-vous avec votre e-mail et votre code`,
    `3. Installe l'appli : iPhone → Safari > Partager > « Sur l'écran d'accueil » ; Android → Chrome > ⋮ > « Installer l'application »`, '',
    `Votre code est personnel : ne le partagez avec personne.`, '', `À très vite sur le plateau !`, `L'équipe ${d.club}`,
  ].join('\n');
  const Y = '#FFD600';
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>${echap(objet)}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Votre code personnel et l'application à installer en une minute.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111111;border-radius:20px;overflow:hidden;font-family:Montserrat,'Segoe UI',Helvetica,Arial,sans-serif;color:#f5f5f3;">
  <tr><td style="background:#000000;padding:30px 28px 22px;border-bottom:4px solid ${Y};" align="center">
    <img src="${SITE}/assets/fitpulse-logo.png" width="200" alt="FIT PULSE" style="display:block;width:200px;max-width:70%;height:auto;border:0;color:#ffffff;font-size:28px;font-weight:900;font-style:italic;">
    <div style="margin-top:10px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9b9b9b;">${echap(d.club)}</div>
  </td></tr>
  <tr><td style="padding:30px 28px 6px;">
    <div style="font-size:30px;line-height:1.05;font-weight:900;font-style:italic;text-transform:uppercase;color:#ffffff;">Bienvenue <span style="color:${Y};">${echap(d.first)}</span> !</div>
    <p style="margin:14px 0 0;font-size:15px;line-height:1.6;color:#d6d6d3;">Votre accès à <b style="color:#fff;">Fit Pulse</b>, l'application commerciale du club, est prêt. Paliers de l'équipe, saisie en un geste, relances du jour : tout est sur votre téléphone.</p>
    <p style="margin:14px 0 0;"><span style="display:inline-block;background:${Y};color:#000;font-weight:800;font-size:12px;letter-spacing:1px;text-transform:uppercase;padding:5px 12px;border-radius:99px;">Accès ${echap(role)}</span></p>
  </td></tr>
  <tr><td style="padding:22px 28px 8px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;border:2px dashed ${Y};border-radius:16px;"><tr><td align="center" style="padding:22px 12px;">
      <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#9b9b9b;">Votre code personnel</div>
      <div style="margin-top:8px;font-family:'Courier New',Courier,monospace;font-size:28px;font-weight:700;letter-spacing:3px;color:${Y};">${echap(d.code)}</div>
      <div style="margin-top:10px;font-size:13px;color:#bdbdbd;">Identifiant : <span style="color:#fff;">${echap(d.email)}</span></div>
    </td></tr></table>
  </td></tr>
  <tr><td align="center" style="padding:20px 28px 6px;">
    <a href="${lien}" style="display:inline-block;background:${Y};color:#000000;text-decoration:none;font-weight:900;font-style:italic;text-transform:uppercase;font-size:18px;letter-spacing:1px;padding:16px 34px;border-radius:12px;">Ouvrir Fit Pulse</a>
    <div style="margin-top:10px;font-size:12px;color:#8a8a8a;">ou copiez : <a href="${lien}" style="color:#bdbdbd;">${echap(SITE.replace('https://', ''))}</a></div>
  </td></tr>
  <tr><td style="padding:24px 28px 4px;">
    <div style="font-size:16px;font-weight:900;font-style:italic;text-transform:uppercase;color:#fff;">Installe l'appli en 1 minute</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
      ${[['1', 'Ouvrez le lien', 'sur votre téléphone, et connectez-vous avec votre e-mail et votre code.'], ['2', 'iPhone', 'dans Safari, touchez Partager puis « Sur l’écran d’accueil ».'], ['3', 'Android', 'dans Chrome ou Samsung Internet, touchez ⋮ puis « Installer l’application ».']].map(([n, t, x]) => `<tr><td width="40" valign="top" style="padding:0 0 12px;"><div style="width:30px;height:30px;line-height:30px;text-align:center;border-radius:8px;background:${Y};color:#000;font-weight:900;font-style:italic;">${n}</div></td><td style="padding:3px 0 12px;font-size:14px;line-height:1.5;color:#d6d6d3;"><b style="color:#fff;">${t}</b> ${x}</td></tr>`).join('')}
    </table>
  </td></tr>
  <tr><td style="padding:6px 28px 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1b1b1b;border-radius:12px;"><tr><td style="padding:14px 16px;font-size:13px;line-height:1.5;color:#bdbdbd;">Votre code est <b style="color:#fff;">personnel</b> : ne le partagez avec personne. Perdu ? Demandez-en un nouveau à votre manager.</td></tr></table>
  </td></tr>
  <tr><td style="background:#000;padding:20px 28px;border-top:1px solid #222;" align="center">
    <div style="font-size:20px;font-weight:900;font-style:italic;text-transform:uppercase;color:#fff;">À très vite sur le <span style="color:${Y};">plateau</span> !</div>
    <div style="margin-top:6px;font-size:12px;color:#7a7a7a;">L'équipe ${echap(d.club)} · envoyé depuis Fit Pulse</div>
  </td></tr>
</table></td></tr></table></body></html>`;
  return { objet, texte, html };
}

// ── SMTP sur TLS (Gmail, port 465) ────────────────────────────────────────
function smtp(lignesMessage, dest) {
  return new Promise((ok, ko) => {
    const s = tls.connect(465, 'smtp.gmail.com', { servername: 'smtp.gmail.com' });
    const etapes = [
      ['EHLO fitpulse', 250], ['AUTH LOGIN', 334], [Buffer.from(UTIL).toString('base64'), 334], [Buffer.from(MDP).toString('base64'), 235],
      [`MAIL FROM:<${UTIL}>`, 250], [`RCPT TO:<${dest}>`, 250], ['DATA', 354], [lignesMessage + '\r\n.', 250], ['QUIT', 221],
    ];
    let i = -1, tampon = '';
    s.setEncoding('utf8'); s.setTimeout(30000, () => { s.destroy(); ko(new Error('SMTP : délai dépassé')); });
    s.on('data', d => {
      tampon += d; const lignes = tampon.split('\r\n'); if (!/^\d{3} /m.test(tampon)) return;
      const der = lignes.filter(Boolean).pop(); if (!/^\d{3} /.test(der)) return;
      const code = Number(der.slice(0, 3)); tampon = '';
      const attendu = i < 0 ? 220 : etapes[i][1];
      if (code !== attendu) { s.destroy(); return ko(new Error(`SMTP : ${der}`)); }
      i++; if (i >= etapes.length) { s.end(); return ok(); }
      s.write(etapes[i][0] + '\r\n');
    });
    s.on('error', ko);
  });
}
function message(dest, { objet, texte, html }) {
  const b64 = s => Buffer.from(s, 'utf8').toString('base64').replace(/(.{76})/g, '$1\r\n');
  const fr = 'fp' + crypto.randomBytes(8).toString('hex');
  return [
    `From: =?UTF-8?B?${Buffer.from('Fit Pulse').toString('base64')}?= <${UTIL}>`, `To: <${dest}>`, `Reply-To: <${UTIL}>`,
    `Subject: =?UTF-8?B?${Buffer.from(objet, 'utf8').toString('base64')}?=`, `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@fitpulse>`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${fr}"`, '',
    `--${fr}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(texte),
    `--${fr}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', b64(html), `--${fr}--`,
  ].join('\r\n').replace(/\r\n\./g, '\r\n..');
}

// ── Passage ───────────────────────────────────────────────────────────────
async function main() {
  if (process.argv[2] === 'apercu') { writeFileSync(process.argv[3] || 'apercu-invitation.html', emailInvitation({ email: 'alex.martin@exemple.fr', first: 'Alex', code: 'FP-ABCD-EFGH-JKLM', role: 'membre', club: 'Fitness Park Niort' }).html); console.log('aperçu écrit'); return; }
  const tk = await jeton();
  console.log('Règles Fit Pulse :', await assurerRegle(tk));
  console.log('Comptes de départ :', await assurerComptes(tk));
  if (process.argv[2] === 'regles') return;
  // État du serveur publié pour l'appli : l'envoi automatique des invitations n'est proposé que si la messagerie est réglée.
  await api(tk, 'pulse/serveur/mail.json', { method: 'PUT', body: JSON.stringify(!!MDP) }).catch(e => console.log('état :', e.message));
  await api(tk, 'pulse/serveur/at.json', { method: 'PUT', body: JSON.stringify(Date.now()) }).catch(() => null);
  // Notifications push (téléphone fermé).
  try { const S = (await (await api(tk, 'pulse.json')).json()) || {}; const mailer = MDP && !DRY ? (dest, objet, texte) => smtp(message(dest, { objet, texte, html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;white-space:pre-wrap">${texte.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</div>` }), dest) : null; console.log('Push :', JSON.stringify(await passagePush(api, tk, S, mailer))); } catch (e) { console.log('Push : échec,', e.message); }
  const boite = await (await api(tk, 'fitpulse_mail.json')).json() || {};
  const ids = Object.keys(boite).slice(0, MAX_PAR_PASSAGE);
  console.log(`${Object.keys(boite).length} demande(s) en attente`);
  if (ids.length && !MDP && !DRY) {
    // Sans mot de passe de messagerie : on ne garde pas un code dans la base plus de 24 h.
    for (const id of ids) if (Date.now() - (Number(boite[id].at) || 0) > 864e5) await api(tk, `fitpulse_mail/${id}.json`, { method: 'DELETE' });
    console.log('MAIL_MOT_DE_PASSE absent : invitations non envoyées (le manager garde le bouton Envoyer par e-mail).'); return;
  }
  let envoyes = 0;
  for (const id of ids) {
    const d = boite[id];
    try {
      if (!DRY) await smtp(message(d.email, emailInvitation(d)), d.email);
      envoyes++; console.log(`✓ invitation ${d.role} → ${d.email.replace(/(.).+(@.+)/, '$1…$2')}`);
    } catch (e) {
      // echec d'envoi : on reessaie au passage suivant, pendant 24 h au plus
      console.log(`✗ ${id} : ${e.message}`);
      if (Date.now() - (Number(d.at) || 0) < 864e5) continue;
    }
    // la demande (et le code qu'elle porte) ne reste jamais dans la base
    if (!DRY) await api(tk, `fitpulse_mail/${id}.json`, { method: 'DELETE' });
  }
  console.log(`${envoyes} e-mail(s) envoyé(s)`);
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch(e => { console.error('ÉCHEC :', e.message); process.exit(1); });
