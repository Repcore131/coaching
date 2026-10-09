/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Résultats : impayés et rétention, par mois, club et commercial ══
// Onglet commun aux pages Rétention et Impayés, classement « Euros gardés »,
// bibliothèque de scripts (partage au réseau : texte et taux anonymisé seulement).

const RES_MIN_APPEL = 4; // minutes par appel, réglable par le manager (S.roiCfg[club].minCall)
const minParAppel = (clubId = CLUB.id) => Number(deepGet(S, ['roiCfg', clubId, 'minCall'])) || RES_MIN_APPEL;
const moisBornes = mk => ({ from: mk + '-01', to: `${mk}-${daysIn(mk)}`, t0: dateOf(mk + '-01').getTime(), t1: dateOf(addMonths(mk, 1) + '-01').getTime() });
const RET_KINDS = ['impaye', 'suivi15', 'suivi30', 'fincontrat', 'anniversaire', 'mandat'];
// Appels notés : issues de dossier impayé (dunning.history), actions de rétention (S.loyalty, hors impayé),
// autres relances (S.touches, appels hors impayé et rétention : déjà comptés par les deux premières).
function appelsDu(clubId, mk, uid = null) {
  const { t0, t1 } = moisBornes(mk); let n = 0; const ok = by => !uid || by === uid; const dans = at => at >= t0 && at < t1;
  Object.values(S.clients || {}).forEach(c => { if (c.clubId !== clubId) return; ((c.dunning || {}).history || []).forEach(h => { if (h && h.outcome && h.outcome !== 'envoye' && dans(h.at) && ok(h.by)) n++; }); });
  Object.values(S.loyalty || {}).forEach(a => { if (!a || a.type === 'impaye' || ['reopen', 'smsprog'].includes(a.outcome) || !dans(a.at) || !ok(a.userId)) return; const c = S.clients[a.clientId]; if (c && c.clubId === clubId) n++; });
  Object.values(S.touches || {}).forEach(x => { if (x && x.clubId === clubId && x.channel === 'call' && !RET_KINDS.includes(x.kind) && dans(x.at) && ok(x.by)) n++; });
  return n;
}
// Euros récupérés : régularisations canal équipe créditées au commercial (KPI Impayés récupérés).
const eurosRecuperes = (clubId, mk, uid = null) => { const b = moisBornes(mk); return Math.round(sumRange(clubId, uid, 'impayes', b.from, b.to) * 100) / 100; };
// Délai médian (jours) : incident vers régularisation, canal équipe (commercial : ses régularisations).
function delaiMedian(clubId, mk, uid = null) {
  if (!uid) return recoveryDelay(clubId, mk); const b = moisBornes(mk);
  const L = Object.values(S.recov || {}).filter(x => x && x.clubId === clubId && x.canal === 'equipe' && x.userId === uid && x.incidentDate && x.date >= b.from && x.date <= b.to).map(x => Math.round((dateOf(x.date) - dateOf(x.incidentDate)) / 864e5));
  return L.length ? medianOf(L) : null;
}
// Euros sauvés : saved_eur des sauvetages et renouvellements du mois (sauvetage de résiliation : valeur du dossier).
function eurosSauves(clubId, mk, uid = null) {
  const b = moisBornes(mk); let s = 0;
  Object.values(S.entries || {}).forEach(e => { if (!e || e.clubId !== clubId || e.kpiId !== 'sauvetage' || e.date < b.from || e.date > b.to || (uid && e.userId !== uid) || !entryCounts(e)) return;
    s += e.saved_eur != null ? Number(e.saved_eur) : /^sv_/.test(e.id) && S.resiliations[e.id.slice(3)] ? resValeur(S.resiliations[e.id.slice(3)]) : 0; });
  return Math.round(s * 100) / 100;
}
const eurosParHeure = (euros, appels, min) => appels ? Math.round(euros / (appels * min / 60)) : null;
function resultatsLigne(clubId, mk, uid) {
  const rec = eurosRecuperes(clubId, mk, uid), sauv = eurosSauves(clubId, mk, uid), app = appelsDu(clubId, mk, uid);
  return { uid, rec, sauv, garde: Math.round((rec + sauv) * 100) / 100, appels: app, parHeure: eurosParHeure(rec, app, minParAppel(clubId)), delai: delaiMedian(clubId, mk, uid) };
}
function eurosGardesClassement(clubId, mk) { return clubMembers(clubId).filter(u => !u.virtual).map(u => ({ u, ...resultatsLigne(clubId, mk, u.id) })).sort((a, b) => b.garde - a.garde || String(a.u.first).localeCompare(String(b.u.first))); }

// ── Scripts : bibliothèque du club et taux de succès ───────────────────────
const tplIdFor = kind => { const c = Object.values(S.templates || {}).find(t => t.active !== false && t.kind === kind && t.channel === 'script' && (!t.clubId || t.clubId === CLUB.id)); return c ? c.id : 'defaut:' + kind; };
// Taux de succès par script : dossiers gagnés / dossiers où le script a été affiché (issue notée avec ce script).
function tauxScripts(clubId, mk) {
  const { t0, t1 } = moisBornes(mk); const par = {};
  const vu = (tpl, cle, gagne) => { const x = par[tpl] = par[tpl] || { vus: new Set(), gagnes: new Set() }; x.vus.add(cle); if (gagne) x.gagnes.add(cle); };
  Object.values(S.clients || {}).forEach(c => { if (c.clubId !== clubId) return; const H = (c.dunning || {}).history || []; const tpls = H.filter(h => h && h.tplId && h.at >= t0 && h.at < t1).map(h => h.tplId);
    const gagne = H.some(h => h && ['paye', 'acompte'].includes(h.outcome) && h.at >= t0 && h.at < t1); [...new Set(tpls)].forEach(tp => vu(tp, c.id + '|impaye', gagne)); });
  Object.values(S.loyalty || {}).forEach(a => { if (!a || !a.tplId || a.at < t0 || a.at >= t1) return; const c = S.clients[a.clientId]; if (!c || c.clubId !== clubId) return; const o = OUTCOMES[a.outcome] || {}; vu(a.tplId, a.clientId + '|' + a.type, o.done && !o.lost); });
  return Object.entries(par).map(([id, x]) => ({ id, vus: x.vus.size, gagnes: x.gagnes.size, taux: x.vus.size ? x.gagnes.size / x.vus.size : null })).sort((a, b) => b.vus - a.vus);
}
const tplLibelle = id => { if (/^defaut:/.test(id)) { const k = id.slice(7); return `Script Fit Pulse : ${(REL_KINDS[k] || LOYALTY_TYPES[k] || { label: k }).label}`; } const t = (S.templates || {})[id]; return t ? (t.nom || `Script du club : ${(REL_KINDS[t.kind] || { label: t.kind }).label}`) : id; };

// ── L'onglet ──────────────────────────────────────────────────────────────
const tip = (t, f) => `<span class="has-tip" title="${esc(f)}">${t}</span>`;
function resultatsOnglet(origine = 'retention') {
  const mk = UI.resuMonth || curMonth(); const C = CLUB.id; const mgr = isManager();
  const uid = mgr ? (UI.resuUser || null) : ME.id;
  const L = resultatsLigne(C, mk, uid); const F = monthFigures(C, mk); const min = minParAppel(C);
  const membres = clubMembers(C).filter(u => !u.virtual);
  const lignes = mgr && !uid ? eurosGardesClassement(C, mk) : [];
  const J = typeof suivisRealises === 'function' ? suivisRealises(C, mk) : { j15: 0, j30: 0 };
  const S6 = tauxScripts(C, mk);
  const tuile = (k, label, v, sub, formule) => `<div class="stat" data-res="${k}">${tip(`<span>${label}</span>`, formule)}<b>${v}</b><small>${sub}</small></div>`;
  return `<div class="row wrap" style="margin-bottom:12px;gap:8px">${monthNav('resuMonth', mk)}${mgr ? `<select class="input sm" style="width:auto" data-change="resuUser"><option value="">Tout le club</option>${membres.map(u => `<option value="${u.id}" ${uid === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select>` : ''}<span class="spacer"></span>${mgr ? `<label class="small row" style="gap:6px">Minutes par appel <input class="input sm" style="width:60px" type="number" min="1" max="30" value="${min}" data-change="resuMin"></label>` : ''}</div>
    <div class="stat-row resu" data-origine="${origine}">
      ${tuile('recup', 'Euros récupérés', fmtE(L.rec), 'canal équipe, crédités au commercial', 'Somme des régularisations du canal équipe créditées au commercial (KPI Impayés récupérés), sur le mois.')}
      ${tuile('delai', 'Délai médian', L.delai == null ? 'n.d.' : plur(L.delai, 'jour', 'jours'), 'de l’incident à la régularisation', 'Médiane des jours entre la date de l’incident et la date de régularisation, canal équipe, régularisations du mois.')}
      ${tuile('parheure', 'Euros par heure d’appel', L.parHeure == null ? 'n.d.' : fmtE(L.parHeure), `${plur(L.appels, 'appel', 'appels')} à ${min} min`, `Euros récupérés / (nombre d’appels x ${min} min / 60). Durée par appel réglable par le manager.`)}
      ${tuile('sauves', 'Euros sauvés', fmtE(L.sauv), 'sauvetages et renouvellements', 'Somme des euros sauvés des sauvetages et des renouvellements du mois (renouvellement : mensualité x 12 ; sauvetage de résiliation : valeur du dossier).')}
      ${tuile('taux', 'Taux de sauvetage', fmtP(F.tauxSauvetage), `${F.sauvees} sur ${F.sauvees + F.resiliees} issues`, 'Sauvées / (sauvées + résiliées) du mois, club entier (même calcul que le récapitulatif).')}
      ${tuile('suivis', 'Suivis réalisés', `${J.j15} J+15 · ${J.j30} J+30`, 'adhérents joints ce mois', 'Adhérents joints (issue réussie) au suivi J+15 et au suivi J+30, sur le mois.')}</div>
    ${lignes.length ? `<div class="card" style="margin-top:12px"><h3>Par commercial</h3><div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">${tip('Récupérés', 'Régularisations équipe créditées')}</th><th class="num">${tip('Sauvés', 'Sauvetages et renouvellements')}</th><th class="num">${tip('Euros gardés', 'Récupérés + sauvés')}</th><th class="num">${tip('Appels', 'Issues notées (impayés, rétention, autres relances)')}</th><th class="num">${tip('Euros par heure', `Récupérés / (appels x ${min} min / 60)`)}</th><th class="num">${tip('Délai médian', 'Jours de l’incident à la régularisation')}</th></tr></thead><tbody>${lignes.map(x => `<tr data-resu-user="${x.u.id}"><td>${esc(fullName(x.u))}</td><td class="num">${fmtE(x.rec)}</td><td class="num">${fmtE(x.sauv)}</td><td class="num"><b>${fmtE(x.garde)}</b></td><td class="num">${x.appels}</td><td class="num">${x.parHeure == null ? 'n.d.' : fmtE(x.parHeure)}</td><td class="num">${x.delai == null ? 'n.d.' : x.delai + ' j'}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
    <div class="card" style="margin-top:12px"><div class="card-head"><h3>Taux de succès par script</h3><span class="spacer"></span>${mgr ? '<button class="btn sm" data-act="scriptsBiblio">Bibliothèque de scripts</button>' : ''}</div>
      ${S6.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Script</th><th class="num">${tip('Affiché', 'Dossiers où une issue a été notée avec ce script')}</th><th class="num">Gagnés</th><th class="num">${tip('Taux', 'Dossiers gagnés / dossiers où le script a été affiché')}</th></tr></thead><tbody>${S6.map(x => `<tr><td>${esc(tplLibelle(x.id))}</td><td class="num">${x.vus}</td><td class="num">${x.gagnes}</td><td class="num">${fmtP(x.taux)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted small">Le taux de succès apparaît dès qu’une issue est notée depuis la feuille d’appel, qui affiche le script.</p>'}</div>`;
}
ACTIONS.resuUser = el => { UI.resuUser = el.value || null; render(); };
ACTIONS.resuMin = el => { const v = Math.max(1, Math.min(30, Number(el.value) || RES_MIN_APPEL)); db.set(['roiCfg', CLUB.id, 'minCall'], v); toast(`Durée par appel : ${v} min`); };

// Classement « Euros gardés » (page Classement) : récupérés + sauvés, podium.
function eurosGardesCard(mk = curMonth()) {
  const L = eurosGardesClassement(CLUB.id, mk).filter(x => x.garde > 0 || x.appels > 0); const top = L.slice(0, 3);
  return `<div class="card" id="euros-gardes"><h3>${tip('Euros gardés', 'Euros récupérés (canal équipe) + euros sauvés (sauvetages et renouvellements), sur le mois')}</h3><p class="muted small" style="margin-top:0">${esc(monthLabel(mk))}</p>
    ${top.length ? `<div class="podium eg-podium">${[top[1], top[0], top[2]].map((x, i) => x ? `<div class="step p${[2, 1, 3][i]}" data-eg="${x.u.id}"><div class="pod-name">${avatar(x.u, 'xs')} ${esc(x.u.first)}</div><b class="num">${fmtE(x.garde)}</b></div>` : '<div></div>').join('')}</div>
      ${L.slice(3).map((x, i) => `<div class="row small" style="padding:6px 0;border-bottom:1px solid var(--line)"><b style="width:22px">${i + 4}</b><span class="spacer">${esc(fullName(x.u))}</span><b class="num">${fmtE(x.garde)}</b></div>`).join('')}`
      : '<p class="muted small">Un impayé récupéré ou un renouvellement noté ouvre le classement du mois.</p>'}</div>`;
}

// ── Bibliothèque de scripts : S.templates (kind, step, channel, text, author, sharedNetwork) ──
// Partage au réseau Fit Pulse : seuls le texte et le taux de succès arrondi circulent (aucun nom d'adhérent).
ACTIONS.scriptsBiblio = () => {
  const mine = Object.values(S.templates || {}).filter(t => t && t.clubId === CLUB.id && t.channel === 'script');
  const reseau = Object.values(S.scriptsReseau || {}).filter(Boolean).slice(0, 30);
  openModal({ title: 'Bibliothèque de scripts', drawer: true, body: `<form id="scf" class="grid"><div class="form-grid"><label class="field"><span>Relance</span><select class="input" name="kind">${Object.entries(REL_KINDS).filter(([k]) => RET_KINDS.includes(k) || k === 'resiliation').map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></label><label class="field"><span>Étape</span><select class="input" name="step"><option value="1">Ouverture</option><option value="2">Questions</option><option value="3">Conclusion</option></select></label></div>
    <label class="field"><span>Texte (variables : {prenom}, {club}, {commercial}, {montant}, {date_fin}, {offre})</span><textarea class="input" name="text" rows="4" maxlength="600"></textarea></label><button class="btn primary sm" type="button" data-act="scriptAjout">Ajouter au club</button></form>
    <h3 style="margin:16px 0 6px">Scripts du club</h3>${mine.map(t => `<div class="dhist"><b>${esc((REL_KINDS[t.kind] || {}).label || t.kind)}</b><div class="small">${esc(Array.isArray(t.body) ? t.body.filter(Boolean).join(' / ') : t.text || t.body || '')}</div><div class="row small" style="gap:8px;margin-top:4px"><span class="muted">${esc(fullName(S.users[t.author]) || '')}</span><span class="spacer"></span>${t.sharedNetwork ? '<span class="badge ok">partagé au réseau</span>' : `<button class="btn sm" data-act="scriptPartage" data-id="${t.id}">Partager au réseau</button>`}</div></div>`).join('') || '<p class="muted small">Aucun script du club : les scripts Fit Pulse sont utilisés.</p>'}
    <h3 style="margin:16px 0 6px">Scripts du réseau</h3>${reseau.map(x => `<div class="dhist"><b>${esc((REL_KINDS[x.kind] || {}).label || x.kind)}</b> <span class="muted small">taux de succès ${x.taux == null ? 'n.d.' : x.taux + ' %'}</span><div class="small">${esc(x.text)}</div></div>`).join('') || '<p class="muted small">Aucun script partagé pour l’instant.</p>'}` });
};
ACTIONS.scriptAjout = () => {
  const f = formData($('#scf')); const text = (f.text || '').trim(); if (text.length < 10) { toast('Écrivez le script (10 caractères au moins).'); return; }
  const id = 'tp' + newId(); const parts = ['', '', '']; parts[Number(f.step) - 1] = text; const base = tplFor(f.kind, 'script') || ['', '', '']; const body = [0, 1, 2].map(i => parts[i] || base[i] || '');
  db.set(['templates', id], { id, clubId: CLUB.id, kind: f.kind, step: Number(f.step), channel: 'script', body, text, author: ME.id, sharedNetwork: false, active: true, at: Date.now() }); closeModal(); toast('1 script ajouté au club');
};
ACTIONS.scriptPartage = el => {
  const t = S.templates[el.dataset.id]; if (!t) return; const tx = tauxScripts(CLUB.id, curMonth()).find(x => x.id === t.id);
  // Aucun nom d'adhérent : le texte garde ses variables, le taux est arrondi à 5 points près.
  const text = String(t.text || (t.body || []).filter(Boolean).join(' ')).slice(0, 600); const h = hkey(text + '|' + t.kind);
  db.batch([[['templates', t.id, 'sharedNetwork'], true], [['scriptsReseau', h], { kind: t.kind, step: t.step || null, channel: 'script', text, taux: tx && tx.taux != null ? Math.round(tx.taux * 20) * 5 : null, at: Date.now() }]]);
  toast('1 script partagé au réseau Fit Pulse');
};
