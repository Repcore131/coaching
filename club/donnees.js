/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — données personnelles, conservation, erreurs, hors ligne ══
const APP_VERSION = '2026.10';
const RETENTION = { clientInactifMois: 36, impayeSoldeMois: 24, resiliationMois: 24, chatMois: 12, importsMois: 13, contactsMois: 36, logsJours: 30 };

// ── Hors ligne : bandeau « N saisies en attente » ────────────────────────
function renderOffline() {
  let el = $('#offline-bar'); const n = outboxRead().length; const off = !navigator.onLine;
  if (!off && !n) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'offline-bar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = off ? `Hors ligne${n ? ` : ${plur(n, 'saisie en attente', 'saisies en attente')}` : ' : vos saisies partiront au retour du réseau'}` : `Envoi de ${plur(n, 'saisie', 'saisies')} en attente…`;
}
addEventListener('online', renderOffline); addEventListener('offline', renderOffline); setTimeout(renderOffline, 1500);

// ── Erreurs : journal sans donnée d'adhérent, 20 envois par session ──────
let LOG_N = 0;
function logError(kind, e) {
  try {
    if (LOG_N >= 20 || typeof S === 'undefined' || !S || !ME || backend.mode !== 'firebase') return; LOG_N++;
    const clean = s => String(s || '').replace(/\d{7,}/g, '#').replace(/[^\s@]+@[^\s@]+/g, '@').slice(0, 2000);
    const id = newId(); const club = (typeof CLUB !== 'undefined' && CLUB && CLUB.id) || 'x';
    backend.fb.database().ref(fbPath(`pulse/logs/${club}/${today()}/${id}`)).set({ at: Date.now(), uid: ME.id, version: APP_VERSION, page: location.hash.split('/')[1] || 'home', kind, message: clean(e && e.message || e), stack: clean(e && e.stack) }).catch(() => null);
  } catch (_) { /* jamais bloquant */ }
}
addEventListener('error', e => logError('error', e.error || e.message));
addEventListener('unhandledrejection', e => logError('promise', e.reason));

// ── Droit d'effacement : une fiche adhérent et tout ce qui s'y rattache ──
const eraseHash = (club, num) => hkey(`erase|${club}|${num}`);
// L'effacement lui-même : rgpd.js (effacementOps).
// Un import qui ramène un numéro effacé est signalé.
function erasedNums(club) { const H = new Set(Object.values(S.audit || {}).filter(a => a.action === 'erase' && a.club === club).map(a => a.hash)); return num => H.has(eraseHash(club, num)); }

// ── Purge selon les durées de conservation (créateur) ────────────────────
function purgePlan() {
  const now = Date.now(), M = m => now - m * 30.44 * 864e5, t = today(); const ops = []; const n = {};
  const add = (k, path) => { ops.push([path, null]); n[k] = (n[k] || 0) + 1; };
  Object.values(S.clients || {}).forEach(c => { const end = c.endDate || c.end; if (/ancien|perdu/.test(norm(c.status || '')) && end && dateOf(end).getTime() < M(RETENTION.clientInactifMois) && !(Number(c.balance) > 0)) add('Anciens adhérents (3 ans)', ['clients', c.id]); });
  Object.values(S.clients || {}).forEach(c => { const d = c.dunning; if (d && ['recupere', 'a_verifier', 'perdu'].includes(d.status) && d.recoveredAt && dateOf(d.recoveredAt).getTime() < M(RETENTION.impayeSoldeMois) && !(Number(c.balance) > 0)) { ops.push([['clients', c.id, 'dunning'], null]); n['Impayés soldés (2 ans)'] = (n['Impayés soldés (2 ans)'] || 0) + 1; } });
  Object.values(S.resiliations || {}).forEach(r => { if (r.date && dateOf(r.date).getTime() < M(RETENTION.resiliationMois)) add('Résiliations (2 ans)', ['resiliations', r.id]); });
  Object.values(S.chat || {}).forEach(m => { if (m.at && m.at < M(RETENTION.chatMois)) add('Messages du chat (1 an)', ['chat', m.id]); });
  Object.values(S.touches || {}).forEach(x => { if (x.at && x.at < M(RETENTION.contactsMois)) add('Contacts notés (3 ans)', ['touches', x.id]); });
  Object.entries(S.logs || {}).forEach(([club, days]) => Object.keys(days || {}).forEach(d => { if (d < addDays(t, -RETENTION.logsJours)) add('Journal d’erreurs (30 jours)', ['logs', club, d]); }));
  return { ops, n };
}
ACTIONS.purgeOld = async () => {
  const { ops, n } = purgePlan(); if (!ops.length) { toast('Rien à purger : toutes les données sont dans leurs durées de conservation.'); return; }
  if (!await confirmDlg(`Supprimer définitivement : ${Object.entries(n).map(([k, v]) => `${k} : ${v}`).join(', ')} ?`, { ok: 'Purger', danger: true })) return;
  ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'purge', detail: n }]); db.batch(ops); toast('Purge effectuée');
};
function purgeCard() {
  if (!isCreator()) return ''; const { n } = purgePlan(); const tot = Object.values(n).reduce((s, x) => s + x, 0);
  return `<div class="card"><h3>Conservation des données</h3><p class="muted small">Anciens adhérents 3 ans après la sortie, impayés soldés 2 ans, résiliations 2 ans, chat 1 an, contacts notés 3 ans, journal d’erreurs 30 jours.</p><p class="small">${tot ? `${plur(tot, 'élément dépasse', 'éléments dépassent')} sa durée de conservation.` : 'Tout est dans les durées de conservation.'}</p><button class="btn sm ${tot ? 'danger' : ''}" data-act="purgeOld" ${tot ? '' : 'disabled'}>Purger</button> <a class="btn sm ghost" href="#/donnees">Données personnelles</a></div>`;
}
// Années de naissance encore présentes en base (anciennes fiches) : effacées par le premier manager connecté.
function birthMigrate() { if (!BIRTH_FIX.size || !ME || !isManager() || backend.mode !== 'firebase') return; const ops = [...BIRTH_FIX].filter(id => S.clients[id]).map(id => [['clients', id, 'birth'], S.clients[id].birth]); BIRTH_FIX.clear(); if (ops.length) db.batch(ops); }
setTimeout(() => { try { birthMigrate(); } catch (_) { /* plus tard */ } }, 8000);

// ── Page d'information ───────────────────────────────────────────────────
PAGES.donnees = {
  title: 'Données personnelles',
  render() {
    return `<div class="page-head"><div><h1>Données personnelles</h1><p>Ce que Fit Pulse garde, pourquoi, combien de temps.</p></div></div>
      <div class="card prose"><h3>Responsable de traitement</h3><p>La société qui exploite le club (contact : le responsable du club).</p>
      <h3>Finalités</h3><p>Suivi commercial de l’équipe, relances de fidélisation des adhérents, recouvrement amiable des impayés.</p>
      <h3>Base légale</h3><p>Intérêt légitime du club pour le suivi commercial et la fidélisation ; exécution du contrat d’abonnement pour les impayés.</p>
      <h3>Données</h3><p>Équipe : nom, e-mail, saisies. Adhérents : nom, numéro, téléphone, e-mail, offre, dates de contrat, jour et mois d’anniversaire (sans l’année), solde dû, demande de résiliation, contacts notés. Jamais de pièce d’identité ni de RIB : n’en mettez pas dans le chat.</p>
      <h3>Destinataires</h3><p>L’équipe du club, selon son rôle. Sous-traitant : Google Firebase (hébergement et base de données).</p>
      <h3>Durées de conservation</h3><p>Anciens adhérents : 3 ans après la sortie. Impayés soldés : 2 ans. Résiliations : 2 ans. Chat : 1 an. Contacts notés : 3 ans. Journal d’erreurs : 30 jours.</p>
      <h3>Vos droits</h3><p>Accès, rectification, opposition, effacement : adressez-vous au responsable du club. Depuis la fiche d’un adhérent, un manager exporte ses données (droit d’accès) ou l’efface.</p>
      <p class="muted small">Version de l’application : ${APP_VERSION}.</p></div>`;
  },
};
