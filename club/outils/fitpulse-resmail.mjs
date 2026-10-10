/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
// ══ FIT PULSE — relève horaire des demandes de résiliation (Gmail) ═════════
//
// Une fois par heure, la boîte de l'accueil de chaque club est lue par l'API
// Gmail (OAuth du compte accueil). Les messages des 30 derniers jours qui
// parlent de résiliation, ou qui viennent de l'appli adhérents, deviennent des
// demandes /pulse/resRequests/{clubId}/{threadId} (clé = fil Gmail : relire un
// mail deux fois met à jour, ne crée jamais de doublon).
//
// Le jeton OAuth ne vit QUE côté serveur : secret GitHub (GMAIL_*) ou Secret
// Manager (club/cloud/index.js). Il n'est jamais écrit dans la base ni dans le
// HTML. Seul un extrait de 200 caractères est gardé, effacé 90 jours après le
// traitement de la demande.
//
// Réglages d'un club, /pulse/clubs/{id}/mailSources :
//   { inbox: 'accueil@club.fr', appli: 'no-reply@appli-adherents.fr, autre@…' }
// Secrets : GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, et GMAIL_TOKENS = {"clubId":"refresh_token"}
// (ou GMAIL_REFRESH_TOKEN seul pour le club GMAIL_CLUB, par défaut le premier club réglé).

export const MOTS = ['résiliation', 'resiliation', 'résilier', 'resilier', '"mettre fin"', '"arrêter mon abonnement"', '"arreter mon abonnement"'];
export const SNIPPET_MAX = 200;
export const PURGE_JOURS = 90;
export const INTERVALLE_MS = 55 * 60000; // une relève par heure (marge sur le planning)
export const TRAITES = ['sauve', 'resilie', 'hors_sujet'];

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9@.]+/g, ' ').trim();
const tokensKey = s => norm(s).replace(/[@.]/g, ' ').split(' ').filter(Boolean).sort().join(' ');
const listeAdresses = v => (Array.isArray(v) ? v : String(v || '').split(/[\s,;]+/)).map(x => String(x).trim().toLowerCase()).filter(x => /@/.test(x));

// Requête Gmail : mots-clés OU expéditeur de l'appli, 30 derniers jours.
export function requeteGmail(sources = {}) {
  const appli = listeAdresses(sources.appli);
  const termes = [...MOTS, ...appli.map(a => `from:${a}`)];
  return `newer_than:30d -in:chats -in:drafts (${termes.join(' OR ')})`;
}

// « Prénom Nom <adresse> » → { nom, email }
export function expediteur(v) {
  const s = String(v || '').trim(); const m = s.match(/<([^>]+)>/);
  const email = (m ? m[1] : (s.match(/[^\s<>"']+@[^\s<>"']+/) || [''])[0]).trim().toLowerCase();
  const nom = (m ? s.slice(0, m.index) : '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  return { nom, email };
}
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decoder = s => String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(parseInt(e[1].toLowerCase() === 'x' ? e.slice(2) : e.slice(1), e[1].toLowerCase() === 'x' ? 16 : 10)) : (ENT[e.toLowerCase()] ?? m));
const entete = (msg, nom) => ((msg.payload && msg.payload.headers) || []).find(h => h.name.toLowerCase() === nom.toLowerCase())?.value || '';

// Un fil Gmail → les champs d'une demande (ou null si le fil n'en est pas une :
// aucun message reçu, seulement des envois de l'accueil).
export function analyserFil(fil, { boite = '', sources = {} } = {}) {
  const moi = String(boite || '').toLowerCase(); const appli = listeAdresses(sources.appli);
  const msgs = (fil.messages || []).map(m => ({ m, at: Number(m.internalDate) || 0, sent: (m.labelIds || []).includes('SENT'), de: expediteur(entete(m, 'From')) })).sort((a, b) => a.at - b.at);
  const recus = msgs.filter(x => !x.sent && x.de.email && x.de.email !== moi);
  if (!recus.length) return null;
  const premier = recus[0], dernierRecu = recus[recus.length - 1];
  const reponses = msgs.filter(x => (x.sent || (moi && x.de.email === moi)) && x.at > premier.at);
  const derniereReponse = reponses.length ? reponses[reponses.length - 1].at : null;
  const snippet = decoder(premier.m.snippet || '').replace(/\s+/g, ' ').trim().slice(0, SNIPPET_MAX);
  return {
    from: premier.de.nom ? `${premier.de.nom} <${premier.de.email}>` : premier.de.email,
    fromEmail: premier.de.email, fromName: premier.de.nom,
    subject: decoder(entete(premier.m, 'Subject')).slice(0, 200),
    receivedAt: premier.at, lastInboundAt: dernierRecu.at,
    snippet, channel: appli.includes(premier.de.email) ? 'appli' : 'mail',
    lastReplyAt: derniereReponse,
  };
}

// Rapprochement avec un adhérent : par e-mail, puis par nom (expéditeur, ou
// « Nom : … » dans le corps des mails de l'appli).
export function rapprocher(clients, clubId, { fromEmail, fromName, snippet }) {
  const L = Object.values(clients || {}).filter(c => c && c.clubId === clubId);
  if (fromEmail) { const c = L.find(x => (x.email || '').toLowerCase() === fromEmail); if (c) return c.id; }
  const noms = [fromName, ((snippet || '').match(/\b(?:nom|adh[ée]rent|client)\s*:\s*([A-Za-zÀ-ÿ' -]{3,60})/i) || [])[1]].filter(Boolean);
  for (const n of noms) { const k = tokensKey(n); if (!k || k.split(' ').length < 2) continue; const hits = L.filter(x => tokensKey(x.name || '') === k); if (hits.length === 1) return hits[0].id; }
  return null;
}

// Fusion : le mail met à jour ses champs, jamais le travail de l'équipe
// (statut, responsable, journal). Un extrait purgé ne revient pas.
export function fusionner(ancien, neuf, { threadId, boite, clientId, now = Date.now() }) {
  const lien = `https://mail.google.com/mail/?authuser=${encodeURIComponent(boite || '')}#all/${threadId}`;
  const base = ancien || { status: 'a_traiter', ownerId: null, createdAt: now };
  const out = { ...base, id: threadId, from: neuf.from, fromEmail: neuf.fromEmail, subject: neuf.subject, receivedAt: neuf.receivedAt, lastInboundAt: neuf.lastInboundAt, channel: neuf.channel, lastReplyAt: neuf.lastReplyAt || null, gmailLink: lien, seenAt: now };
  out.snippet = base.snippetPurgedAt ? null : neuf.snippet;
  if (!base.clientId && clientId) out.clientId = clientId;
  if (base.clientId) out.clientId = base.clientId;
  return out;
}

// RGPD : extrait effacé 90 jours après le traitement.
export function aPurger(r, now = Date.now()) { return !!(r && r.snippet && TRAITES.includes(r.status) && r.treatedAt && now - r.treatedAt > PURGE_JOURS * 864e5); }

// ── Gmail (REST, sans dépendance) ─────────────────────────────────────────
export async function jetonGmail({ clientId, clientSecret, refreshToken }) {
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const j = await r.json(); if (!j.access_token) throw new Error('jeton Gmail refusé : ' + (j.error || r.status));
  return j.access_token;
}
export function clientGmail(access) {
  const get = async chemin => { const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/' + chemin, { headers: { authorization: 'Bearer ' + access } }); if (!r.ok) throw new Error(`Gmail ${r.status} ${chemin.split('?')[0]}`); return r.json(); };
  return {
    async profil() { return get('profile'); },
    async fils(q, max = 300) {
      const ids = new Set(); let page = '';
      do { const j = await get(`messages?maxResults=100&q=${encodeURIComponent(q)}${page ? '&pageToken=' + page : ''}`); (j.messages || []).forEach(m => ids.add(m.threadId)); page = j.nextPageToken || ''; } while (page && ids.size < max);
      return [...ids];
    },
    async fil(id) { return get(`threads/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`); },
  };
}

// Comptes Gmail par club, lus dans les secrets de l'environnement.
export function comptesGmail(S, env = process.env) {
  const id = env.GMAIL_CLIENT_ID, secret = env.GMAIL_CLIENT_SECRET; if (!id || !secret) return {};
  let tokens = {}; try { tokens = JSON.parse(env.GMAIL_TOKENS || '{}'); } catch (e) { tokens = {}; }
  if (env.GMAIL_REFRESH_TOKEN) { const club = env.GMAIL_CLUB || Object.keys(S.clubs || {}).find(c => S.clubs[c] && S.clubs[c].mailSources) || Object.keys(S.clubs || {})[0]; if (club && !tokens[club]) tokens[club] = env.GMAIL_REFRESH_TOKEN; }
  const out = {}; for (const [club, refreshToken] of Object.entries(tokens)) if (refreshToken && S.clubs && S.clubs[club]) out[club] = { clientId: id, clientSecret: secret, refreshToken };
  return out;
}

// Un passage (lancé toutes les 5 minutes par le serveur, actif une fois par heure).
// api(tk, chemin, opts) : accès REST à la base ; gmailPour(clubId) → client Gmail.
export async function passageResiliations(api, tk, S, { gmailPour, comptes = comptesGmail(S), now = Date.now(), force = false, log = console.log } = {}) {
  const clubs = Object.keys(comptes); if (!clubs.length) return 'aucune boîte réglée';
  const out = [];
  for (const clubId of clubs) {
    const meta = (S.resRequestsMeta || {})[clubId] || {};
    if (!force && meta.lastRunAt && now - meta.lastRunAt < INTERVALLE_MS) { out.push(`${clubId} : déjà relevé`); continue; }
    const sources = (S.clubs[clubId] || {}).mailSources || {};
    try {
      const g = await gmailPour(clubId, comptes[clubId]);
      const boite = (sources.inbox || (await g.profil()).emailAddress || '').toLowerCase();
      const anciens = (S.resRequests || {})[clubId] || {};
      const up = {}; let nouveaux = 0, majs = 0;
      for (const threadId of await g.fils(requeteGmail(sources))) {
        const d = analyserFil(await g.fil(threadId), { boite, sources }); if (!d) continue;
        const ancien = anciens[threadId];
        const r = fusionner(ancien, d, { threadId, boite, clientId: rapprocher(S.clients, clubId, d), now });
        up[threadId] = r; ancien ? majs++ : nouveaux++;
      }
      let purges = 0;
      for (const [k, r] of Object.entries(anciens)) { const cible = up[k] || r; if (aPurger(cible, now)) { up[k] = { ...cible, snippet: null, snippetPurgedAt: now }; purges++; } }
      if (Object.keys(up).length) await api(tk, `pulse/resRequests/${clubId}.json`, { method: 'PATCH', body: JSON.stringify(up) });
      await api(tk, `pulse/resRequestsMeta/${clubId}.json`, { method: 'PUT', body: JSON.stringify({ lastRunAt: now, ok: true, nouveaux, majs, purges }) });
      out.push(`${clubId} : ${nouveaux} nouvelle(s), ${majs} mise(s) à jour, ${purges} extrait(s) purgé(s)`);
    } catch (e) {
      await api(tk, `pulse/resRequestsMeta/${clubId}.json`, { method: 'PATCH', body: JSON.stringify({ lastErrorAt: now, error: String(e.message || e).slice(0, 200) }) }).catch(() => null);
      out.push(`${clubId} : échec, ${e.message}`);
    }
  }
  log && log('Demandes de résiliation : ' + out.join(' ; '));
  return out.join(' ; ');
}
// Client Gmail réel à partir des secrets.
export const gmailReel = async (clubId, compte) => clientGmail(await jetonGmail(compte));
