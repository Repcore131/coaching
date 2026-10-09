/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — confidentialité, comparaison anonyme, export, effacement ══
// #/confidentialite (lisible sans connexion) : ce que voit chaque rôle, où sont
// les données, combien de temps, comment les exporter ou les effacer.
// Comparaison anonyme (désactivée par défaut) : si un manager l'active, seuls
// des agrégats mensuels SANS NOM partent dans /benchmark/{mois}/{empreinte du
// club} : taux de réalisation par KPI, délai médian d'impayé, taux de sauvetage.
// Désactivée : aucune écriture, et les envois passés sont retirés.

// ── Comparaison anonyme ───────────────────────────────────────────────────
const BENCH_KPIS = Object.keys(DEFAULT_KPIS); // identifiants génériques uniquement (jamais un libellé saisi)
const benchOn = (clubId = CLUB && CLUB.id) => !!deepGet(S, ['clubs', clubId, 'benchmark', 'on']) && !!deepGet(S, ['clubs', clubId, 'benchmark', 'hash']);
async function benchHashNew(clubId) {
  const sel = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`bench|${clubId}|${sel}`));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
// Agrégats d'un mois : des nombres, aucun nom, aucun identifiant de personne.
function benchAggregats(clubId, mk) {
  const st = statsFor(clubId, null, rangeOf('month', mk)); const realisation = {};
  st.rows.forEach(x => { if (BENCH_KPIS.includes(x.k.id) && x.target > 0) realisation[x.k.id] = Math.round(x.pct * 1000) / 1000; });
  const d = typeof dunStats === 'function' ? dunStats(clubId, mk).medianJours : null; const F = typeof monthFigures === 'function' ? monthFigures(clubId, mk) : {};
  const out = { v: 1, at: Date.now(), realisation };
  if (d != null) out.delaiImpaye = d; if (F.tauxSauvetage != null) out.sauvetage = Math.round(F.tauxSauvetage * 1000) / 1000;
  return out;
}
// Envoi (manager, réglage actif) : mois clos et mois en cours, une fois par jour au plus.
function benchSync(force = false) {
  try {
    if (!ME || !isManager() || !CLUB || !benchOn()) return;
    if (!force && pref('benchSync', '') === today()) return;
    const h = CLUB.benchmark.hash; const cm = curMonth();
    db.batch([[['benchmark', addMonths(cm, -1), h], benchAggregats(CLUB.id, addMonths(cm, -1))], [['benchmark', cm, h], benchAggregats(CLUB.id, cm)], [['prefs', ME.id, 'benchSync'], today()]]);
  } catch (e) { /* sans réseau : au prochain passage */ }
}
setTimeout(() => benchSync(), 6000);
ACTIONS.benchToggle = async el => {
  if (!isManager()) return; const on = el.checked;
  if (on) {
    const hash = deepGet(S, ['clubs', CLUB.id, 'benchmark', 'hash']) || await benchHashNew(CLUB.id);
    db.set(['clubs', CLUB.id, 'benchmark'], { on: true, hash, at: Date.now(), by: ME.id }); benchSync(true); toast('Comparaison anonyme activée');
  } else {
    // Retrait : plus aucun envoi, et les agrégats déjà envoyés sont effacés.
    const h = deepGet(S, ['clubs', CLUB.id, 'benchmark', 'hash']);
    const ops = [[['clubs', CLUB.id, 'benchmark', 'on'], false]];
    if (h) Object.keys(S.benchmark || {}).forEach(mk => { if (deepGet(S, ['benchmark', mk, h])) ops.push([['benchmark', mk, h], null]); });
    db.batch(ops); toast('Comparaison anonyme désactivée');
  }
};
// Position du club : quartile, jamais le nom ni la valeur d'un autre club.
const QUARTS = ['dans le quart supérieur', 'dans le deuxième quart', 'dans le troisième quart', 'dans le quart inférieur'];
function benchQuartile(valeurs, mien, plusPetitMieux = false) {
  if (mien == null || valeurs.length < 4) return null;
  const meilleurs = valeurs.filter(v => plusPetitMieux ? v < mien : v > mien).length;
  return QUARTS[Math.min(3, Math.floor(meilleurs / valeurs.length * 4))];
}
function benchPosition(clubId, mk) {
  const h = deepGet(S, ['clubs', clubId, 'benchmark', 'hash']); const M = deepGet(S, ['benchmark', mk]) || {}; const L = Object.values(M).filter(Boolean); const moi = h && M[h];
  if (!moi) return { n: L.length, lignes: [] };
  const lignes = [];
  Object.keys(moi.realisation || {}).forEach(k => { const q = benchQuartile(L.map(x => (x.realisation || {})[k]).filter(v => typeof v === 'number'), moi.realisation[k]); if (q) lignes.push([`Réalisation : ${(S.kpis[k] || {}).label || k}`, q]); });
  const qd = benchQuartile(L.map(x => x.delaiImpaye).filter(v => typeof v === 'number'), moi.delaiImpaye, true); if (qd) lignes.push(['Délai médian de récupération des impayés', qd]);
  const qs = benchQuartile(L.map(x => x.sauvetage).filter(v => typeof v === 'number'), moi.sauvetage); if (qs) lignes.push(['Taux de sauvetage des résiliations', qs]);
  return { n: L.length, lignes };
}

// ── Export : toutes les collections du club ───────────────────────────────
const SECRETS_USER = ['salt', 'codeHash', 'bootKey', 'codeKey'];
function exportClub(clubId, { createur = false } = {}) {
  const members = new Set(Object.values(S.users || {}).filter(u => (u.clubs || []).includes(clubId)).map(u => u.id));
  const out = { format: 'fit-pulse-export', version: 1, club: clubId, exporteLe: new Date().toISOString(), collections: {} };
  const isRec = o => o && typeof o === 'object' && !Array.isArray(o);
  const parClub = v => { const vals = Object.values(v || {}).filter(isRec); return vals.length && vals.some(x => 'clubId' in x); };
  for (const k of [...new Set([...Object.keys(emptyState()), ...Object.keys(S)])]) {
    const v = S[k]; let r;
    if (k === 'product' && !createur) continue;
    if (!isRec(v)) r = v ?? null;
    else if (k === 'clubs') r = { [clubId]: v[clubId] };
    else if (k === 'users') r = Object.fromEntries([...members].map(id => [id, Object.fromEntries(Object.entries(v[id] || {}).filter(([f]) => !SECRETS_USER.includes(f)))]));
    else if (k === 'targets') r = Object.fromEntries(Object.entries(v).map(([mk, m]) => [mk, Object.fromEntries(Object.entries(m || {}).filter(([u]) => members.has(u)))]));
    else if (['prefs', 'coaching', 'absences'].includes(k)) r = Object.fromEntries(Object.entries(v).filter(([u]) => members.has(u)));
    else if (k === 'audit') r = Object.fromEntries(Object.entries(v).filter(([, a]) => a && (a.club === clubId || members.has(a.by))));
    else if (k === 'benchmark') { const h = deepGet(S, ['clubs', clubId, 'benchmark', 'hash']); r = h ? Object.fromEntries(Object.entries(v).filter(([, m]) => m && m[h]).map(([mk, m]) => [mk, { [h]: m[h] }])) : {}; }
    else if (k === 'kpis' || k === 'meta') r = v;
    else if (clubId in v) r = { [clubId]: v[clubId] };
    else if (parClub(v)) r = Object.fromEntries(Object.entries(v).filter(([, x]) => isRec(x) && x.clubId === clubId));
    else if (isRec(v) && Object.values(v).some(isRec)) { r = {}; for (const [sk, sv] of Object.entries(v)) r[sk] = isRec(sv) && clubId in sv ? { [clubId]: sv[clubId] } : isRec(sv) && parClub(sv) ? Object.fromEntries(Object.entries(sv).filter(([, x]) => isRec(x) && x.clubId === clubId)) : sv; }
    else r = v;
    out.collections[k] = r;
  }
  return out;
}
// Données d'un commercial : sa fiche, ses saisies, ses préférences, ses relances.
function exportMembre(uid) {
  const u = S.users[uid] || {}; const mine = (col, f) => Object.fromEntries(Object.entries(S[col] || {}).filter(([, x]) => x && f(x)));
  return { format: 'fit-pulse-export-membre', version: 1, exporteLe: new Date().toISOString(), collections: {
    users: { [uid]: Object.fromEntries(Object.entries(u).filter(([f]) => !SECRETS_USER.includes(f))) }, entries: mine('entries', e => e.userId === uid), prefs: { [uid]: (S.prefs || {})[uid] || {} },
    targets: Object.fromEntries(Object.entries(S.targets || {}).map(([mk, m]) => [mk, { [uid]: (m || {})[uid] || {} }])), touches: mine('touches', x => x.by === uid), loyalty: mine('loyalty', x => x.userId === uid), coaching: { [uid]: (S.coaching || {})[uid] || {} } } };
}
ACTIONS.exportMesDonnees = () => {
  const mgr = isManager(); const data = mgr ? exportClub(CLUB.id, { createur: isCreator() }) : exportMembre(ME.id);
  downloadFile(`fit-pulse-${mgr ? 'club-' + norm(CLUB.name).replace(/ /g, '-') : 'mes-donnees'}-${today()}-CONFIDENTIEL.json`, JSON.stringify(data, null, 1), 'application/json');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_json', club: CLUB.id, portee: mgr ? 'club' : 'membre' });
};

// ── Page Confidentialité ──────────────────────────────────────────────────
const ROLES_VOIENT = [
  ['Créateur', 'Tous les clubs de l’entreprise : équipe, chiffres, adhérents, réglages, sauvegardes. Il n’est ni classé ni objectivé.'],
  ['Manager', 'Ses clubs : équipe, objectifs, imports Resamania, adhérents (fiches, impayés, résiliations, relances), demandes reçues par e-mail, réglages.'],
  ['Membre', 'Ses saisies et son tableau de bord, le classement et le fil de son club, les adhérents qu’il doit rappeler (relances, rétention), le chat.'],
];
function confidentialiteBody(connecte) {
  const R = typeof RETENTION !== 'undefined' ? RETENTION : {};
  const enLigne = !!CFG.firebase; const region = enLigne ? (/firebasedatabase\.app/.test(CFG.firebase.databaseURL) ? CFG.firebase.databaseURL.split('.')[1] : 'us-central1 (États-Unis), région par défaut de la base actuelle') : null;
  const mgr = connecte && isManager(); const pos = mgr && benchOn() ? benchPosition(CLUB.id, addMonths(curMonth(), -1)) : null;
  return `<div class="card prose conf">
    <h2>Ce que voit chaque rôle</h2>
    <div class="table-wrap"><table class="t"><thead><tr><th>Rôle</th><th>Accès</th></tr></thead><tbody>${ROLES_VOIENT.map(([r, d]) => `<tr><td><b>${r}</b></td><td>${d}</td></tr>`).join('')}</tbody></table></div>
    <p class="small">Chaque personne se connecte avec son e-mail et un code personnel. Changer ou retirer un code coupe l’accès aussitôt. Les mots de passe et les jetons d’accès aux boîtes e-mail ne sont jamais stockés dans l’application.</p>
    <h2>Où sont stockées les données</h2>
    <p>${enLigne ? `Base de données Google Firebase (Realtime Database), projet ${esc(CFG.firebase.projectId)}, région ${esc(region)}. Le site est servi par Firebase Hosting. Une copie de travail reste dans le navigateur pour fonctionner sans réseau.` : 'Mode local : les données restent dans ce navigateur, sur cet appareil. Rien n’est envoyé sur un serveur.'}</p>
    <p class="small">Les traitements automatiques (relève des demandes de résiliation, imports Resamania, brief du matin) tournent sur les serveurs de Google ou de GitHub et ne gardent rien hors de la base.</p>
    <h2>Durées de conservation</h2>
    <ul><li>Anciens adhérents : ${Math.round((R.clientInactifMois || 36) / 12)} ans après la sortie.</li><li>Impayés soldés : ${Math.round((R.impayeSoldeMois || 24) / 12)} ans.</li><li>Résiliations : ${Math.round((R.resiliationMois || 24) / 12)} ans.</li><li>Extrait des e-mails de résiliation : 90 jours après le traitement.</li><li>Contacts notés : ${Math.round((R.contactsMois || 36) / 12)} ans.</li><li>Chat : ${R.chatMois || 12} mois.</li><li>Journal d’erreurs : ${R.logsJours || 30} jours.</li></ul>
    <h2>Exporter, effacer</h2>
    <p>Un manager exporte toutes les données de son club (JSON), un membre ses propres données. Un manager efface un adhérent et tout ce qui s’y rattache (droit à l’effacement) ; les chiffres de vente restent, sans lien vers la personne.</p>
    ${connecte ? `<div class="row wrap" style="gap:8px"><button class="btn primary" data-act="exportMesDonnees">${ico('download')} Exporter toutes mes données</button></div>` : '<p class="muted small">Connectez-vous pour exporter vos données.</p>'}
    ${mgr ? `<h3>Supprimer un adhérent</h3><div class="row wrap" style="gap:8px"><input class="input" style="max-width:320px" placeholder="Nom ou numéro de l’adhérent" data-input="confQ" data-focus="confQ" value="${esc(UI.confQ || '')}"></div>
      ${(() => { const q = norm(UI.confQ || ''); if (q.length < 2) return ''; const L = clubClients(CLUB.id).filter(c => norm(c.name || '').includes(q) || String(c.num || '').includes(q)).slice(0, 8);
        return L.length ? `<div class="conf-res">${L.map(c => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer"><b>${esc(c.name || 'Sans nom')}</b> <span class="muted small">${c.num ? 'n° ' + esc(c.num) : ''}</span></span><button class="btn sm danger" data-act="cliErase" data-id="${esc(c.id)}">Supprimer</button></div>`).join('')}</div>` : '<p class="muted small">Aucun adhérent trouvé.</p>'; })()}` : ''}
    <h2>${TXT.propriete.titre}</h2>
    <p>${TXT.propriete.texte}</p><p class="muted small">${TXT.propriete.version}</p>
    <h2>Comparaison anonyme entre clubs</h2>
    <p>Désactivée par défaut. Si un manager l’active, Fit Pulse envoie chaque mois des agrégats sans aucun nom (taux de réalisation par indicateur, délai médian de récupération des impayés, taux de sauvetage) sous une empreinte du club qui ne permet pas de le retrouver. En retour, le club voit sa position par quart, jamais le nom ni les chiffres d’un autre club ou d’un commercial. Désactiver retire aussi les agrégats déjà envoyés.</p>
    ${mgr ? `<label class="row" style="gap:8px"><input type="checkbox" data-change="benchToggle" ${benchOn() ? 'checked' : ''}> <b>Comparer mon club anonymement</b></label>
      ${pos ? (pos.lignes.length ? `<div class="table-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>${esc(monthLabel(addMonths(curMonth(), -1)))}</th><th>Position de votre club</th></tr></thead><tbody>${pos.lignes.map(([l, q]) => `<tr><td>${esc(l)}</td><td><b>${q}</b></td></tr>`).join('')}</tbody></table></div>` : `<p class="muted small">Pas encore assez de clubs participants pour situer le vôtre (${plur(pos.n, 'club', 'clubs')}, 4 au minimum).</p>`) : ''}` : ''}
  </div>`;
}
ACTIONS.confQ = el => { UI.confQ = el.value; render(); };
PAGES.confidentialite = { title: 'Confidentialité', render() { return `<div class="page-head"><div><h1>Confidentialité</h1><p>Ce que voit chacun, où sont les données, combien de temps, et comment les récupérer ou les effacer.</p></div></div>${confidentialiteBody(true)}`; } };
function confidentialiteStandalone() { return `<div class="legal-solo"><div class="row" style="margin-bottom:12px"><a class="btn ghost" href="#/">${ico('chevL')} Retour</a><span class="spacer"></span>${brandBlock()}</div><h1 class="title">Confidentialité</h1>${confidentialiteBody(false)}</div>`; }
