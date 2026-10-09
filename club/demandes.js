/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — demandes de résiliation reçues par e-mail ════════════════
// Relevées chaque heure dans la boîte de l'accueil par le serveur
// (outils/fitpulse-resmail.mjs) : S.resRequests[clubId][threadId]. Ici :
// le bloc « Demandes reçues » en tête de la page Résiliations, les compteurs
// du menu et de l'accueil. Tout texte venu d'un mail passe par esc().
// Chaque changement de statut est journalisé (log de la demande + audit).

const RRQ_STATUS = {
  a_traiter: { label: 'À traiter', cls: 'warn' },
  contacte: { label: 'Contacté', cls: 'info' },
  sauve: { label: 'Sauvé', cls: 'ok' },
  resilie: { label: 'Résilié', cls: 'bad' },
  hors_sujet: { label: 'Hors sujet', cls: '' },
};
const RRQ_OPEN = ['a_traiter', 'contacte'];
const RRQ_LATE_MS = 48 * 3600000;
const rrqAll = clubId => Object.values(deepGet(S, ['resRequests', clubId]) || {}).filter(r => r && r.id);
const rrqOpen = r => RRQ_OPEN.includes(r.status || 'a_traiter');
// Sans réponse depuis 48 h : à traiter, aucun message de l'accueil après le dernier message reçu.
function rrqLate(r, now = Date.now()) {
  if ((r.status || 'a_traiter') !== 'a_traiter') return false;
  const last = Number(r.lastInboundAt || r.receivedAt) || 0;
  if (r.lastReplyAt && r.lastReplyAt >= last) return false;
  return last > 0 && now - last > RRQ_LATE_MS;
}
function rrqCounts(clubId, now = Date.now()) { const open = rrqAll(clubId).filter(rrqOpen); return { open: open.length, late: open.filter(r => rrqLate(r, now)).length }; }
// « Relevé à 14 h 00 » (aujourd'hui) ou « Relevé le 08/10 à 14 h 00 ».
function rrqRunLabel(clubId) {
  const m = deepGet(S, ['resRequestsMeta', clubId]) || {};
  if (!m.lastRunAt) return 'Boîte de l’accueil pas encore relevée';
  const d = new Date(m.lastRunAt); const hm = `${d.getHours()} h ${pad(d.getMinutes())}`;
  return isoOf(d) === today() ? `Relevé à ${hm}` : `Relevé le ${dm(isoOf(d))} à ${hm}`;
}
const rrqAge = ms => { const h = Math.floor(ms / 3600000); return h < 48 ? plur(h, 'heure', 'heures') : plur(Math.floor(h / 24), 'jour', 'jours'); };

function rrqItem(r) {
  const c = r.clientId && S.clients[r.clientId]; const owner = r.ownerId && S.users[r.ownerId]; const late = rrqLate(r);
  const last = Number(r.lastInboundAt || r.receivedAt) || Date.now();
  return `<div class="rrq ${late ? 'late' : ''}" data-rrq="${esc(r.id)}">
    <div class="row wrap" style="gap:8px;align-items:flex-start">
      <div class="spacer" style="min-width:200px"><b>${esc(r.from || 'Expéditeur inconnu')}</b>${c ? ` <a class="small" href="#/client/${esc(c.id)}">fiche ${esc(c.name)}</a>` : ''}
        <div class="small">${esc(r.subject || '(sans objet)')}</div>
        ${r.snippet ? `<div class="muted small rrq-snip">« ${esc(r.snippet)} »</div>` : ''}
        <div class="muted small">Reçu le ${esc(dmy(isoOf(new Date(r.receivedAt || Date.now()))))}, il y a ${rrqAge(Date.now() - (r.receivedAt || Date.now()))} · ${r.channel === 'appli' ? 'appli adhérents' : 'e-mail'}${r.lastReplyAt ? ` · réponse de l’accueil le ${esc(dm(isoOf(new Date(r.lastReplyAt))))}` : ''}</div></div>
      ${late ? `<span class="badge bad rrq-late" title="Aucune réponse de l’accueil depuis le dernier message">Sans réponse depuis ${rrqAge(Date.now() - last)}</span>` : ''}
      <span class="badge ${RRQ_STATUS[r.status || 'a_traiter'].cls}">${RRQ_STATUS[r.status || 'a_traiter'].label}</span></div>
    <div class="row wrap" style="gap:6px;margin-top:8px">
      ${r.gmailLink ? `<a class="btn sm" href="${esc(r.gmailLink)}" target="_blank" rel="noopener">Ouvrir le mail</a>` : ''}
      ${owner ? `<span class="small">${avatar(owner, 'xs')} ${r.ownerId === ME.id ? '<b>Vous</b>' : esc(fullName(owner))}</span>` : `<button class="btn sm primary" data-act="rrqTake" data-id="${esc(r.id)}">Je m’en occupe</button>`}
      <span class="spacer"></span>
      <button class="btn sm" data-act="rrqSet" data-id="${esc(r.id)}" data-to="contacte">Contacté</button>
      <button class="btn sm ok-btn" data-act="rrqSet" data-id="${esc(r.id)}" data-to="sauve">Sauvé</button>
      <button class="btn sm" data-act="rrqResilier" data-id="${esc(r.id)}">Résilier</button>
      <button class="btn sm ghost" data-act="rrqSet" data-id="${esc(r.id)}" data-to="hors_sujet">Hors sujet</button></div></div>`;
}
// Bloc en tête de la page Résiliations : demandes en cours, plus anciennes d'abord ; l'historique en dessous.
function rrqBlock() {
  const all = rrqAll(CLUB.id); const open = all.filter(rrqOpen).sort((a, b) => (a.receivedAt || 0) - (b.receivedAt || 0));
  const done = all.filter(r => !rrqOpen(r)).sort((a, b) => (b.treatedAt || b.receivedAt || 0) - (a.treatedAt || a.receivedAt || 0));
  const n = rrqCounts(CLUB.id); const meta = deepGet(S, ['resRequestsMeta', CLUB.id]) || {};
  const cfg = isManager() ? `<button class="btn sm ghost" data-act="rrqCfg">Réglages</button>` : '';
  if (!all.length && !meta.lastRunAt) return `<div class="card rrq-block"><div class="card-head"><h3>Demandes reçues</h3><span class="spacer"></span>${cfg}</div><p class="muted small">La boîte de l’accueil n’est pas encore relevée. Une fois le compte Gmail relié côté serveur, les demandes de résiliation reçues par e-mail ou par l’appli adhérents apparaissent ici chaque heure.</p></div>`;
  return `<div class="card rrq-block" id="rrq-block">
    <div class="card-head"><h3>Demandes reçues</h3><span class="badge ${n.open ? 'warn' : 'ok'}">${plur(n.open, 'à traiter', 'à traiter')}</span>${n.late ? `<span class="badge bad">dont ${n.late} sans réponse depuis 48 h</span>` : ''}<span class="spacer"></span>${cfg}<span class="muted small" title=""${meta.error ? 'Dernière erreur : ' + esc(meta.error) : ''}">${esc(rrqRunLabel(CLUB.id))}${meta.error && meta.lastErrorAt > (meta.lastRunAt || 0) ? ' · dernière relève en échec' : ''}</span></div>
    ${open.length ? `<div class="rrq-list">${open.map(rrqItem).join('')}</div>` : '<p class="muted small">Aucune demande reçue en attente de traitement.</p>'}
    ${done.length ? `<details class="rrq-hist"><summary>Historique des demandes traitées (${done.length})</summary><div class="table-wrap"><table class="t"><thead><tr><th>Reçue</th><th>Expéditeur</th><th>Objet</th><th>Issue</th><th>Par</th></tr></thead><tbody>${done.map(r => `<tr><td class="nowrap">${esc(dmy(isoOf(new Date(r.receivedAt || 0))))}</td><td>${esc(r.from)}</td><td>${esc(r.subject)}</td><td><span class="badge ${RRQ_STATUS[r.status].cls}">${RRQ_STATUS[r.status].label}</span></td><td>${esc(fullName(S.users[r.treatedBy]))}${r.treatedAt ? ', le ' + esc(dm(isoOf(new Date(r.treatedAt)))) : ''}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
  </div>`;
}
// Écritures d'un changement de statut, journalisées.
function rrqStatusOps(r, to, extra = {}) {
  const from = r.status || 'a_traiter'; const now = Date.now(); const base = ['resRequests', CLUB.id, r.id];
  const ops = [[[...base, 'status'], to], [[...base, 'log', newId()], { at: now, by: ME.id, from, to }], [['audit', newId()], { at: now, by: ME.id, action: 'demande_resiliation_statut', ref: r.id, from, to }]];
  if (!r.ownerId) ops.push([[...base, 'ownerId'], ME.id]);
  if (!RRQ_OPEN.includes(to)) ops.push([[...base, 'treatedAt'], now], [[...base, 'treatedBy'], ME.id]);
  for (const [k, v] of Object.entries(extra)) ops.push([[...base, k], v]);
  return ops;
}
const rrqGet = id => deepGet(S, ['resRequests', CLUB.id, id]);
const rrqName = r => { const c = r.clientId && S.clients[r.clientId]; return c ? c.name : (String(r.from || '').replace(/\s*<[^>]*>\s*/, '').trim() || r.fromEmail || 'Client'); };
ACTIONS.rrqTake = el => { const r = rrqGet(el.dataset.id); if (!r) return; db.batch([[['resRequests', CLUB.id, r.id, 'ownerId'], ME.id], [['resRequests', CLUB.id, r.id, 'log', newId()], { at: Date.now(), by: ME.id, label: 'Prise en charge' }]]); toast('1 demande à votre nom'); };
ACTIONS.rrqSet = el => {
  const r = rrqGet(el.dataset.id); const to = el.dataset.to; if (!r || !RRQ_STATUS[to]) return;
  const ops = rrqStatusOps(r, to);
  // Sauvé : compté comme un sauvetage, comme une résiliation sauvée.
  if (to === 'sauve') {
    const id = 'mail_' + safeKey(r.id); const owner = r.ownerId || ME.id;
    ops.push([['resiliations', id], { id, clubId: CLUB.id, client: rrqName(r), clientId: r.clientId || null, date: isoOf(new Date(r.receivedAt || Date.now())), status: 'sauvee', saved: true, ownerId: owner, userId: owner, source: 'mail', requestId: r.id, at: Date.now(), log: { [newId()]: { at: Date.now(), by: ME.id, label: 'Client sauvé (demande reçue par e-mail)' } } }],
      [['entries', 'sv_' + id], { id: 'sv_' + id, userId: owner, clubId: CLUB.id, kpiId: 'sauvetage', date: today(), value: 1, source: 'manual', at: Date.now(), by: ME.id }], [['resRequests', CLUB.id, r.id, 'resiliationId'], id]);
  }
  db.batch(ops);
  if (to === 'sauve') toast(`Client sauvé : ${rrqName(r)} reste au club`); else toast(`Demande : ${RRQ_STATUS[to].label.toLowerCase()}`);
};
ACTIONS.rrqResilier = el => {
  const r = rrqGet(el.dataset.id); if (!r) return;
  openModal({ title: 'Résilier', body: `<form id="rrqf" class="form-grid"><p class="full muted small">${esc(rrqName(r))} · demande reçue le ${esc(dmy(isoOf(new Date(r.receivedAt || Date.now()))))}. Un dossier est créé dans les résiliations.</p>
    <label class="field full"><span>Motif</span><select class="input" name="reason">${RES_REASONS.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>
    <label class="field"><span>Date d’effet</span><input class="input" type="date" name="effective" required value="${addDays(today(), 30)}"></label></form>`,
  foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="rrqResilierOk" data-id="${esc(r.id)}">Créer le dossier</button>` });
};
ACTIONS.rrqResilierOk = el => {
  const r = rrqGet(el.dataset.id); if (!r) return; const f = formData($('#rrqf')); if (!f.effective) { toast('Indiquez la date d’effet.'); return; }
  const id = 'mail_' + safeKey(r.id); const owner = r.ownerId || ME.id;
  db.batch([...rrqStatusOps(r, 'resilie', { resiliationId: id }),
    [['resiliations', id], { id, clubId: CLUB.id, client: rrqName(r), clientId: r.clientId || null, date: isoOf(new Date(r.receivedAt || Date.now())), effective: f.effective, reason: f.reason, status: 'resiliee', saved: false, ownerId: owner, userId: owner, source: 'mail', requestId: r.id, at: Date.now(), log: { [newId()]: { at: Date.now(), by: ME.id, label: 'Résiliation enregistrée (demande reçue par e-mail)' } } }]]);
  closeModal(); toast('1 dossier de résiliation créé');
};

// Réglages du club : adresse de la boîte relevée et expéditeurs de l'appli adhérents (/pulse/clubs/{id}/mailSources).
ACTIONS.rrqCfg = () => {
  const m = CLUB.mailSources || {};
  openModal({ title: 'Demandes reçues par e-mail', body: `<form id="rrqc" class="grid">
    <label class="field"><span>Boîte de l’accueil relevée</span><input class="input" type="email" name="inbox" value="${esc(m.inbox || '')}" placeholder="accueil@votreclub.fr"></label>
    <label class="field"><span>Expéditeurs de l’appli adhérents (séparés par des virgules)</span><input class="input" name="appli" value="${esc(m.appli || '')}" placeholder="no-reply@appli.fr"></label>
    <p class="muted small">L’accès à la boîte (jeton OAuth du compte accueil) se règle côté serveur, jamais dans l’appli. Seul un extrait de 200 caractères de chaque mail est gardé, effacé 90 jours après le traitement.</p></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="rrqCfgOk">Enregistrer</button>' });
};
ACTIONS.rrqCfgOk = () => {
  const f = formData($('#rrqc')); const clean = s => String(s || '').split(/[\s,;]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
  db.set(['clubs', CLUB.id, 'mailSources'], { inbox: clean(f.inbox)[0] || null, appli: clean(f.appli).join(', ') || null });
  closeModal(); toast('1 jeu de réglages enregistré');
};
