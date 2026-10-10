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
  ['manual', 'Dépôt manuel', 'Glisser-déposer dans Imports. Toujours actif, en secours.'],
];
const INGEST_ETATS = ['actif', 'en attente', 'inactif'];
const ingestConfig = (clubId = CLUB.id) => deepGet(S, ['ingestConfig', clubId]) || {};
// Canaux affichés : ceux qui ont une configuration, et le dépôt manuel, toujours actif.
function ingestCanaux(clubId = CLUB.id) {
  const C = ingestConfig(clubId);
  return INGEST_CANAUX.filter(([k]) => k === 'manual' || (C[k] && C[k].status)).map(([k, label, detail]) => ({ k, label, detail, status: k === 'manual' ? 'actif' : (INGEST_ETATS.includes(C[k].status) ? C[k].status : 'inactif'), cfg: C[k] || {} }));
}
// Canal d'un fichier reçu : journal des arrivées automatiques, rapports d'ingestion, imports manuels.
const canalDeJournal = x => (['api', 'mail', 'drive', 'manual'].includes(x.canal) ? x.canal : x.source === 'drive' ? 'drive' : x.source === 'api' ? 'api' : 'mail');
function ingestFichiers(clubId = CLUB.id) {
  const L = [];
  Object.values(deepGet(S, ['rsm', 'autoLog', clubId]) || {}).forEach(x => { if (x && x.at) L.push({ canal: canalDeJournal(x), at: x.at, name: x.name || 'fichier' }); });
  Object.values((typeof INGEST_RAPPORTS === 'object' && INGEST_RAPPORTS[clubId]) || {}).forEach(x => { if (x && x.receivedAt) L.push({ canal: x.canal || 'mail', at: x.receivedAt, name: x.file || 'fichier' }); });
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
  const St = ingestStats(clubId); const L = ingestCanaux(clubId);
  const etat = s => `<span class="badge ingest-${s.replace(' ', '-')}">${esc(s.charAt(0).toUpperCase() + s.slice(1))}</span>`;
  const quand = f => f ? `${esc(dmy(isoOf(new Date(f.at))))}, ${esc(f.name)}` : '<span class="muted">aucun fichier</span>';
  return `<div class="card" id="arrivee-exports"><div class="card-head"><h3>Arrivée des exports</h3><span class="spacer"></span><button class="btn sm" data-act="ingestCanalForm">Configurer un canal</button></div>
    <p class="muted small" style="margin-top:-4px">Tous les canaux aboutissent au même moteur d’import. Aucun mot de passe ni jeton n’est gardé ici.</p>
    <div class="table-wrap"><table class="t ingest-t"><thead><tr><th>Canal</th><th>État</th><th>Dernier fichier reçu</th><th class="num">Ce mois-ci</th></tr></thead><tbody>
    ${L.map(c => `<tr data-canal="${c.k}" data-etat="${c.status}"><td><b>${esc(c.label)}</b><br><small class="muted">${esc(c.k === 'mail' && c.cfg.address ? c.cfg.address : c.detail)}</small></td><td>${etat(c.status)}${c.k === 'mail' && c.cfg.address ? ' <button class="btn ghost sm" data-act="ingestRegenerer">Régénérer l’adresse</button>' : ''}</td><td class="small">${quand(St[c.k].dernier)}</td><td class="num">${St[c.k].ceMois}</td></tr>`).join('')}
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
    <p class="muted small" style="margin:0">L’adresse d’import e-mail est créée par Fit Pulse ; le dépôt manuel reste toujours actif.</p></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="ingestCanalOk">Enregistrer</button>' });
};
// Opérations d'enregistrement : jamais d'autre champ que ceux du modèle.
function ingestCanalOps(clubId, f, now = Date.now()) {
  const C = ingestConfig(clubId); const ops = [];
  const etat = v => (INGEST_ETATS.includes(v) ? v : null);
  const api = etat(f.api_status); ops.push([['ingestConfig', clubId, 'api'], api ? { status: api, since: (C.api && C.api.status === api && C.api.since) || now } : null]);
  const mail = etat(f.mail_status);
  if (mail) { const adr = (C.mail || {}).address || ingestAdresse(clubId); ops.push([['ingestConfig', clubId, 'mail'], { ...(C.mail || {}), address: adr, status: mail, rotatedAt: (C.mail || {}).rotatedAt || now }]); } else ops.push([['ingestConfig', clubId, 'mail'], null]);
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
