/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : arrivée des exports (4 canaux, un seul moteur) ════════════
// API Resamania, boîte d'import e-mail, dossier Drive et dépôt manuel aboutissent
// au même moteur de lecture (resamania-core.js, côté appli et côté serveur).
//   S.ingestConfig[clubId] = { api: { status, since }, mail: { address, status, rotatedAt, allow },
//                              drive: { folderId, status }, manual: true }
// Aucun secret ici (ni jeton ni mot de passe) : les règles de la base refusent tout
// autre champ. Les secrets vivent dans Secret Manager, côté serveur.
// Le dépôt manuel reste toujours actif, en secours.

const INGEST_CANAUX = [
  ['api', 'API Resamania', 'Lecture seule, côté serveur, chaque nuit et chaque heure.'],
  ['mail', 'Boîte d’import e-mail', 'Les exports transférés à l’adresse du club arrivent seuls.'],
  ['drive', 'Dossier Drive', 'Les fichiers déposés dans le dossier partagé sont relevés toutes les 10 minutes.'],
  ['manual', 'Dépôt manuel', 'Fichiers déposés dans la page Imports. Toujours actif, en secours.'],
];
const INGEST_ETATS = ['actif', 'en attente', 'inactif'];
// Rapports d'ingestion lus dans /ingest/{clubId}/reports (managers et créateur ; voir plus bas).
let INGEST_RAPPORTS = {};
const ingestConfig = (clubId = CLUB.id) => deepGet(S, ['ingestConfig', clubId]) || {};
// Mode gratuit (par défaut) : rien à payer, ni fonctions Cloud ni domaine. La boîte Gmail du club
// et son dossier Drive (S.clubs[id].rsmAuto) sont relevés par le serveur Fit Pulse gratuit
// (GitHub Actions, chaque heure de 6 h à 22 h). Le mode Cloud (adresse d'import par club, script
// Gmail, API) ne s'affiche que si les fonctions ont été déployées : S.serveur.ingestCloud.
const ingestCloud = () => !!deepGet(S, ['serveur', 'ingestCloud']);
const INGEST_GRATUIT = {
  mail: ['Boîte Gmail du club', 'Relevée par le serveur Fit Pulse chaque heure de 6 h à 22 h.'],
  drive: ['Dossier Drive', 'Relevé avec la boîte Gmail du club, chaque heure de 6 h à 22 h.'],
};
function canauxGratuits(clubId) {
  const a = deepGet(S, ['clubs', clubId, 'rsmAuto']) || {}; const meta = deepGet(S, ['rsm', 'autoMeta', clubId]) || {};
  const etat = meta.lastRunAt ? (meta.lastErrorAt && meta.lastErrorAt > meta.lastRunAt ? 'inactif' : 'actif') : 'en attente';
  const L = [];
  if (a.address || a.label) L.push({ k: 'mail', label: INGEST_GRATUIT.mail[0], detail: a.address ? a.address : `Libellé Gmail « ${a.label} »`, status: etat, cfg: {} });
  if (a.driveFolder) L.push({ k: 'drive', label: INGEST_GRATUIT.drive[0], detail: INGEST_GRATUIT.drive[1], status: etat, cfg: {} });
  return L;
}
// Canaux affichés : ceux qui ont une configuration, et le dépôt manuel, toujours actif.
function ingestCanaux(clubId = CLUB.id) {
  if (!ingestCloud()) {
    const C0 = ingestConfig(clubId); const api = C0.api && C0.api.status ? [{ k: 'api', label: INGEST_CANAUX[0][1], detail: INGEST_CANAUX[0][2], status: INGEST_ETATS.includes(C0.api.status) ? C0.api.status : 'inactif', cfg: C0.api }] : [];
    return [...api, ...canauxGratuits(clubId), { k: 'manual', label: INGEST_CANAUX[3][1], detail: INGEST_CANAUX[3][2], status: 'actif', cfg: {} }];
  }
  const C = ingestConfig(clubId);
  return INGEST_CANAUX.filter(([k]) => k === 'manual' || (C[k] && C[k].status)).map(([k, label, detail]) => ({ k, label, detail, status: k === 'manual' ? 'actif' : (INGEST_ETATS.includes(C[k].status) ? C[k].status : 'inactif'), cfg: C[k] || {} }));
}
// Canal d'un fichier reçu : journal des arrivées automatiques, rapports d'ingestion, imports manuels.
const canalDeJournal = x => (['api', 'mail', 'drive', 'manual'].includes(x.canal) ? x.canal : x.source === 'drive' ? 'drive' : x.source === 'api' ? 'api' : 'mail');
function ingestFichiers(clubId = CLUB.id) {
  const L = [];
  Object.values(deepGet(S, ['rsm', 'autoLog', clubId]) || {}).forEach(x => { if (x && x.at) L.push({ canal: canalDeJournal(x), at: x.at, name: x.name || 'fichier' }); });
  Object.values(INGEST_RAPPORTS[clubId] || {}).forEach(x => { if (x && x.receivedAt) L.push({ canal: x.canal || 'mail', at: x.receivedAt, name: x.file || 'fichier' }); });
  Object.values(S.imports || {}).forEach(i => { if (i && i.clubId === clubId && !i.auto && i.at && (!i.by || !String(i.by).startsWith('auto:'))) L.push({ canal: 'manual', at: i.at, name: i.name || 'fichier' }); });
  return L.sort((a, b) => b.at - a.at);
}
function ingestStats(clubId = CLUB.id, mk = curMonth()) {
  const F = ingestFichiers(clubId); const out = {};
  for (const [k] of INGEST_CANAUX) { const M = F.filter(f => f.canal === k); out[k] = { dernier: M[0] || null, ceMois: M.filter(f => isoOf(new Date(f.at)).slice(0, 7) === mk).length }; }
  return out;
}
function arriveeExportsCard(clubId = CLUB.id) {
  if (!isManager()) return '';
  ingestEcouter(clubId);
  const St = ingestStats(clubId); const L = ingestCanaux(clubId);
  const etat = s => `<span class="badge ingest-${s.replace(' ', '-')}">${esc(s.charAt(0).toUpperCase() + s.slice(1))}</span>`;
  const quand = f => f ? `${esc(dmy(isoOf(new Date(f.at))))}, ${esc(f.name)}` : '<span class="muted">aucun fichier</span>';
  return `<div class="card" id="arrivee-exports"><div class="card-head"><h3>Arrivée des exports</h3><span class="spacer"></span>${ingestCloud() ? '<button class="btn sm ghost" data-act="ingestJeton">Jeton du script Gmail</button><button class="btn sm" data-act="ingestCanalForm">Configurer un canal</button>' : '<button class="btn sm" data-act="rsmAutoCfg">Configurer la boîte Gmail et le Drive</button>'}</div>
    <p class="muted small" style="margin-top:-4px">Tous les canaux aboutissent au même moteur d’import. ${ingestCloud() ? 'Aucun mot de passe ni jeton n’est gardé ici.' : 'Sans frais : la boîte Gmail et le dossier Drive du club sont relevés par le serveur Fit Pulse.'}</p>
    <div class="table-wrap"><table class="t ingest-t"><thead><tr><th>Canal</th><th>État</th><th>Dernier fichier reçu</th><th class="num">Ce mois-ci</th></tr></thead><tbody>
    ${L.map(c => `<tr data-canal="${c.k}" data-etat="${c.status}"><td><b>${esc(c.label)}</b><br><small class="muted">${esc(c.k === 'mail' && c.cfg.address ? c.cfg.address : c.detail)}</small>${c.k === 'mail' && ingestCloud() ? ' <a class="small" href="#/aide-transfert">Créer la règle de transfert</a>' : ''}</td><td>${etat(c.status)}${c.k === 'mail' && c.cfg.address && ingestCloud() ? ' <button class="btn ghost sm" data-act="ingestRegenerer">Régénérer l’adresse</button>' : ''}</td><td class="small">${quand(St[c.k].dernier)}</td><td class="num">${St[c.k].ceMois}</td></tr>`).join('')}
    </tbody></table></div></div>`;
}
ACTIONS.ingestCanalForm = () => {
  if (!isManager()) return; const C = ingestConfig();
  const sel = (k, v) => `<select class="input" name="${k}_status">${INGEST_ETATS.map(s => `<option value="${s}" ${v === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}<option value="" ${!v ? 'selected' : ''}>Non utilisé</option></select>`;
  openModal({ title: 'Canaux d’arrivée des exports', body: `<form id="ingf" class="grid">
    <label class="field"><span>API Resamania</span>${sel('api', (C.api || {}).status)}</label>
    <label class="field"><span>Boîte d’import e-mail</span>${sel('mail', (C.mail || {}).status)}</label>
    <label class="field"><span>Dossier Drive : identifiant du dossier partagé</span><input class="input" name="drive_folder" maxlength="100" value="${esc((C.drive || {}).folderId || '')}" placeholder="Dans l’adresse du dossier, après folders/"></label>
    <label class="field"><span>Dossier Drive</span>${sel('drive', (C.drive || {}).status)}</label>
    <label class="field"><span>Expéditeurs autorisés pour la boîte d’import (séparés par des virgules ; @domaine pour tout un domaine)</span><input class="input" name="mail_allow" maxlength="600" value="${esc(Object.values((C.mail || {}).allow || {}).join(', '))}"></label>
    <p class="muted small" style="margin:0">L’adresse d’import e-mail est créée par Fit Pulse ; un expéditeur hors liste est mis en quarantaine. Le dépôt manuel reste toujours actif.</p></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="ingestCanalOk">Enregistrer</button>' });
};
// Opérations d'enregistrement : jamais d'autre champ que ceux du modèle.
function ingestCanalOps(clubId, f, now = Date.now()) {
  const C = ingestConfig(clubId); const ops = [];
  const etat = v => (INGEST_ETATS.includes(v) ? v : null);
  const api = etat(f.api_status); ops.push([['ingestConfig', clubId, 'api'], api ? { status: api, since: (C.api && C.api.status === api && C.api.since) || now } : null]);
  const mail = etat(f.mail_status);
  const allow = String(f.mail_allow || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^@ ]*@[^@ ]+$/.test(x)).slice(0, 20);
  if (mail) { const adr = (C.mail || {}).address || ingestAdresse(clubId); ops.push([['ingestConfig', clubId, 'mail'], { ...(C.mail || {}), address: adr, status: mail, rotatedAt: (C.mail || {}).rotatedAt || now, allow: allow.length ? Object.fromEntries(allow.map((a, i) => [String(i), a])) : null }]); } else ops.push([['ingestConfig', clubId, 'mail'], null]);
  const dossier = String(f.drive_folder || '').trim(); const drive = etat(f.drive_status);
  if (drive && /^[A-Za-z0-9_-]{10,100}$/.test(dossier)) ops.push([['ingestConfig', clubId, 'drive'], { folderId: dossier, status: drive }]); else if (!drive) ops.push([['ingestConfig', clubId, 'drive'], null]); else return { erreur: 'Identifiant de dossier Drive invalide : 10 à 100 lettres, chiffres, tirets bas ou traits d’union.' };
  ops.push([['ingestConfig', clubId, 'manual'], true]);
  return { ops };
}
ACTIONS.ingestCanalOk = () => {
  if (!isManager()) return; const r = ingestCanalOps(CLUB.id, formData($('#ingf')));
  if (r.erreur) { fx.error(r.erreur); return; }
  db.batch(r.ops); closeModal(); toast(`Arrivée des exports : ${plur(ingestCanaux().length, 'canal', 'canaux')} affichés`);
};

// ── Adresse d'import par club : {slugClub}-{4 caractères}@import.fitpulse.app ──
const INGEST_DOMAINE = 'import.fitpulse.app';
const slugClub = nom => norm(nom || 'club').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'club';
function aleatoire4() {
  const A = 'abcdefghjkmnpqrstuvwxyz23456789'; const b = new Uint8Array(4);
  try { crypto.getRandomValues(b); } catch (_) { for (let i = 0; i < 4; i++) b[i] = Math.floor(Math.random() * 256); }
  return [...b].map(x => A[x % A.length]).join('');
}
function ingestAdresse(clubId) { const c = S.clubs[clubId] || {}; return `${slugClub(c.name || clubId)}-${aleatoire4()}@${INGEST_DOMAINE}`; }
// Régénérer : la nouvelle adresse remplace l'ancienne ; le récepteur relit la configuration
// à chaque message (cache d'une minute au plus), l'ancienne est donc refusée sous 1 minute.
function ingestRegenererOps(clubId, now = Date.now()) {
  const m = ingestConfig(clubId).mail || {}; const adr = ingestAdresse(clubId);
  return [[['ingestConfig', clubId, 'mail'], { ...m, address: adr, status: m.status || 'actif', rotatedAt: now }]];
}
ACTIONS.ingestRegenerer = async () => {
  if (!isManager()) return;
  if (!(await confirmDlg('L’ancienne adresse sera refusée dans la minute. Pensez à mettre à jour la règle de transfert.', { ok: 'Régénérer l’adresse' }))) return;
  db.batch(ingestRegenererOps(CLUB.id)); render(); toast(`Nouvelle adresse : ${ingestConfig().mail.address}`);
};

// ── Imports > Automatique : rapports d'ingestion, lignes en attente, quarantaine ──
// Données lues dans /ingest/{clubId} (managers du club et créateur ; écrites par le serveur).
const INGEST_ATTENTES = {};
const INGEST_QUARANTAINE = {};
const INGEST_ECOUTE = {};
const INGEST_CONFIRMATION = {};
const INGEST_STATUTS = { queued: 'En file', processing: 'En cours', done: 'Terminé', done_with_pending: 'Lignes en attente', failed: 'En échec', ignored: 'Ignoré' };
const INGEST_CANAL_LIB = { mail: 'E-mail', drive: 'Drive', api: 'API', manual: 'Dépôt manuel' };
function ingestEcouter(clubId) {
  if (INGEST_ECOUTE[clubId] || typeof backend === 'undefined' || backend.mode !== 'firebase' || !backend.fb || (typeof MULTI !== 'undefined' && MULTI)) return;
  INGEST_ECOUTE[clubId] = true; const ref = p => backend.fb.database().ref(`ingest/${clubId}/${p}`);
  const suivre = (q, cible) => q.on('value', s => { cible[clubId] = s.val() || {}; REV++; if ((UI.impTab || '') === 'automatique' || location.hash.includes('settings')) render(); }, () => { /* lecture refusée : rien */ });
  suivre(ref('reports').orderByChild('at').limitToLast(30), INGEST_RAPPORTS);
  suivre(ref('pending'), INGEST_ATTENTES);
  suivre(ref('quarantine').limitToLast(30), INGEST_QUARANTAINE);
  suivre(ref('confirmation'), INGEST_CONFIRMATION);
}
function ingestRapports(clubId = CLUB.id, filtre = '') {
  return Object.entries(INGEST_RAPPORTS[clubId] || {}).map(([id, r]) => ({ id, ...r })).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 30).filter(r => !filtre || r.status === filtre);
}
function ingestAutoTab(clubId = CLUB.id) {
  ingestEcouter(clubId);
  const f = UI.ingFiltre || ''; const L = ingestRapports(clubId, f);
  const A = Object.values(INGEST_ATTENTES[clubId] || {}).filter(Boolean); const Q = Object.values(INGEST_QUARANTAINE[clubId] || {}).filter(Boolean).sort((a, b) => (b.at || 0) - (a.at || 0));
  const hm = ts => { const d = new Date(ts); return `${dmy(isoOf(d))} à ${d.getHours()} h ${pad(d.getMinutes())}`; };
  const statut = s => `<span class="badge ingest-st-${esc(s || '')}">${esc(INGEST_STATUTS[s] || s || '')}</span>`;
  const conf = INGEST_CONFIRMATION[clubId] && INGEST_CONFIRMATION[clubId].subject ? INGEST_CONFIRMATION[clubId] : null;
  return `${conf ? `<div class="alert info" style="margin-bottom:14px">${ico('info')}<div><b>Confirmation de transfert Gmail reçue</b> le ${esc(dmy(isoOf(new Date(conf.at))))} : ${esc(conf.subject)}${conf.lien ? ` · <a href="${esc(conf.lien)}" target="_blank" rel="noopener">Confirmer le transfert</a>` : ''}</div></div>` : ''}<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Imports automatiques</h3><span class="spacer"></span>
      <select class="input sm" data-change="ingFiltre" aria-label="Filtrer par statut"><option value="">Tous les statuts</option>${Object.entries(INGEST_STATUTS).map(([k, l]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <button class="btn sm ${A.length ? 'primary' : ''}" data-act="ingestAttentes" ${A.length ? '' : 'disabled'}>Voir les lignes en attente${A.length ? ` (${A.reduce((s, p) => s + (Number(p.count) || 0), 0)})` : ''}</button></div>
    <p class="muted small" style="margin-top:-4px">Les 30 derniers fichiers reçus par e-mail, Drive ou API, lus par le même moteur que le dépôt manuel. Un fichier déjà reçu n’est jamais compté deux fois.</p>
    ${L.length ? `<div class="table-wrap"><table class="t ingest-rapports"><thead><tr><th>Reçu</th><th>Fichier</th><th>Canal</th><th class="num">Lignes lues</th><th class="num">Importées</th><th class="num">En attente</th><th class="num">Durée</th><th>Statut</th><th>Avertissements</th></tr></thead><tbody>
      ${L.map(r => `<tr data-statut="${esc(r.status || '')}"><td class="nowrap">${esc(hm(r.receivedAt || r.at))}</td><td>${esc(r.file || '')}</td><td>${esc(INGEST_CANAL_LIB[r.canal] || r.canal || '')}</td><td class="num">${fmtN(r.rowsRead || 0)}</td><td class="num">${fmtN(r.rowsImported || 0)}</td><td class="num">${fmtN(r.pending || 0)}</td><td class="num">${r.ms != null ? (Math.round(r.ms / 100) / 10).toString().replace('.', ',') + ' s' : ''}</td><td>${statut(r.status)}</td><td class="small">${(r.warnings || []).map(w => esc(w)).join('<br>') || '<span class="muted">aucun</span>'}</td></tr>`).join('')}
    </tbody></table></div>` : `<p class="muted small">${f ? 'Aucun rapport avec ce statut.' : 'Aucun import automatique pour l’instant.'}</p>`}</div>
    ${Q.length ? `<div class="card" id="quarantaine"><h3>Quarantaine</h3><p class="muted small" style="margin-top:-4px">Messages reçus d’un expéditeur hors liste blanche : rien n’a été importé.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Reçu</th><th>Expéditeur</th><th>Objet</th><th class="num">Fichiers</th><th></th></tr></thead><tbody>${Q.map(x => `<tr><td class="nowrap">${esc(hm(x.at))}</td><td>${esc(x.from || '')}</td><td>${esc(x.subject || '')}</td><td class="num">${(x.files || []).length}</td><td><button class="btn sm" data-act="ingestAutoriser" data-from="${esc(x.from || '')}">Autoriser cet expéditeur</button></td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Une fois l’expéditeur autorisé, renvoyez l’export : il sera importé automatiquement.</p></div>` : ''}`;
}
ACTIONS.ingFiltre = el => { UI.ingFiltre = el.value; render(); };
// « À trancher » : chaque vendeur inconnu est rattaché à un membre ; le serveur rejoue ses lignes.
ACTIONS.ingestAttentes = () => {
  const A = Object.values(INGEST_ATTENTES[CLUB.id] || {}).filter(Boolean); const M = clubMembers(CLUB.id, { all: true });
  openModal({ title: 'À trancher : lignes en attente', body: `<p class="muted small" style="margin-top:0">Ces lignes ne comptent pas tant que le vendeur n’est pas rattaché. Une fois rattaché, elles sont importées automatiquement, une seule fois.</p>
    <div class="table-wrap"><table class="t"><tbody>${A.map(p => `<tr><td><b>${esc(p.label || '')}</b><div class="muted small">${plur(Number(p.count) || 0, 'ligne', 'lignes')} · ${esc(p.file || '')}</div></td><td style="width:240px"><select class="input sm" id="att-${esc(p.id)}" aria-label="Membre pour ${esc(p.label || '')}"><option value="">Choisir…</option>${M.map(u => `<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}</select></td><td><button class="btn sm primary" data-act="ingestRattacher" data-id="${esc(p.id)}">Rattacher</button></td></tr>`).join('')}</tbody></table></div>` });
};
function ingestRattacherOps(p, uid) { return uid && S.users[uid] ? (p.keys || []).map(k => [['rsm', 'aliases', safeKey(k)], uid]) : []; }
ACTIONS.ingestRattacher = el => {
  const p = (INGEST_ATTENTES[CLUB.id] || {})[el.dataset.id]; const uid = ($(`#att-${el.dataset.id}`) || {}).value; const ops = p ? ingestRattacherOps(p, uid) : [];
  if (!ops.length) { fx.error('Choisissez le membre à rattacher.'); return; }
  db.batch(ops); closeModal(); toast(`${p.label} rattaché à ${S.users[uid].first} : ${plur(Number(p.count) || 0, 'ligne importée', 'lignes importées')} dans la minute`);
};
function ingestAutoriserOps(clubId, from) {
  const a = String(from || '').trim().toLowerCase(); if (!/^[^@ ]+@[^@ ]+$/.test(a)) return [];
  const m = ingestConfig(clubId).mail || {}; const L = Object.values(m.allow || {}); if (L.includes(a)) return [];
  return [[['ingestConfig', clubId, 'mail', 'allow', String(L.length)], a]];
}
ACTIONS.ingestAutoriser = el => { if (!isManager()) return; const ops = ingestAutoriserOps(CLUB.id, el.dataset.from); if (!ops.length) { toast('Expéditeur déjà autorisé'); return; } db.batch(ops); toast(`Expéditeur autorisé : ${el.dataset.from}`); };
// Jeton du script Gmail (Apps Script) : créé côté serveur, montré une seule fois.
ACTIONS.ingestJeton = async () => {
  if (!isManager()) return;
  try { const r = await appelFonction(backend, 'ingestJeton', { clubId: CLUB.id }); openModal({ title: 'Jeton du script Gmail', body: `<p class="small">À coller dans les propriétés du script (FP_CLUB_TOKEN). Il ne sera plus affiché.</p><input class="input" readonly value="${esc(r.jeton || '')}" onfocus="this.select()">` }); }
  catch (_) { fx.error('Jeton indisponible : fonctions serveur non déployées.'); }
};

// ── Aide : créer la règle de transfert (Gmail, Outlook) ─────────────────────
PAGES['aide-transfert'] = {
  title: 'Créer la règle de transfert',
  manager: true,
  render() {
    const adr = (ingestConfig().mail || {}).address || 'l’adresse d’import du club (Réglages, Club, Arrivée des exports)';
    const capture = n => `<div class="aide-capture muted small" aria-hidden="true">Capture ${n} à venir</div>`;
    return `<div class="page-head"><div><h1>Créer la règle de transfert</h1><p>Les exports Resamania reçus dans votre boîte arrivent seuls dans Fit Pulse : transférez-les à <b>${esc(adr)}</b>.</p></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(340px, 100%), 1fr))">
      <div class="card"><h3>Gmail</h3><ol class="aide-etapes">
        <li>Paramètres (roue dentée), Voir tous les paramètres, onglet Transfert et POP/IMAP.</li>
        <li>Ajouter une adresse de transfert : ${esc(adr)}. Gmail envoie un code de confirmation à cette adresse ; Fit Pulse l’affiche dans Imports, Automatique.</li>
        <li>Saisir le code dans Gmail, puis onglet Filtres : Créer un filtre, De = l’adresse d’envoi des exports Resamania.</li>
        <li>Cocher « Transférer à » et choisir ${esc(adr)}, puis Créer le filtre.</li></ol>${capture(1)}${capture(2)}</div>
      <div class="card"><h3>Outlook</h3><ol class="aide-etapes">
        <li>Paramètres, Courrier, Règles, Ajouter une nouvelle règle.</li>
        <li>Condition : De = l’adresse d’envoi des exports Resamania.</li>
        <li>Action : Rediriger vers ${esc(adr)} (la redirection garde l’expéditeur d’origine).</li>
        <li>Enregistrer. Si le transfert externe est bloqué par votre administrateur Microsoft 365, demandez-lui de l’autoriser pour cette adresse.</li></ol>${capture(3)}${capture(4)}</div></div>
      <div class="card"><h3>Expéditeurs autorisés</h3><p class="small">Fit Pulse importe seulement les messages dont l’expéditeur d’origine figure dans la liste du club (Réglages, Club, Arrivée des exports). Un autre expéditeur est mis en quarantaine, jamais importé automatiquement.</p></div>`;
  },
};
