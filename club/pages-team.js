'use strict';
// ══ FIT PULSE — membres, profil, bilan mensuel ═══════════════════════════

PAGES.members = {
  title: 'Équipe & paliers',
  manager: true,
  render() {
    const tab = UI.memTab || 'org';
    const all = clubMembers(CLUB.id, { all: true });
    const T = [['org', 'Organigramme'], ['hist', 'Historique des saisies'], ['tasks', 'Tâches'], ['targets', 'Objectifs'], ['recaps', 'Récaps'], ['archived', `Archivés (${all.filter(u => u.status === 'archived').length})`], ['aliases', 'Correspondances Resamania']];
    T.splice(4, 0, ['paliers', 'Paliers collectifs']);
    T.splice(5, 0, ['presences', 'Présences'], ['journal', 'Journal']);
    const body = { org: memOrg, hist: memHistory, tasks: memTasks, targets: memTargets, recaps: memRecaps, archived: memArchived, aliases: memAliases, paliers: memPaliers, presences: memPresences, journal: memJournal }[tab]();
    return `<div class="page-head"><div><h1>Membres</h1><p>${esc(CLUB.name)} · ${plur(all.filter(u => u.role === 'manager' && u.status === 'active').length, 'manager', 'managers')}, ${plur(all.filter(u => u.role === 'membre' && u.status === 'active').length, 'membre actif', 'membres actifs')}, ${plur(all.filter(u => u.status === 'pending').length, 'invitation', 'invitations')} en attente</p></div><span class="spacer"></span><button class="btn primary" data-act="addMember">${ico('plus')} Ajouter un membre</button></div>
      ${tabs('memTab', T, tab)}${body}`;
  },
  mount() { if ((UI.memTab || 'org') === 'tasks') bindPlanner(); },
};

// Un createur gere tout le monde ; un manager gere les membres (et lui-meme).
const canEdit = u => isCreator() || u.id === ME.id || u.role === 'membre';
function memberRow(u) {
  return `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">${avatar(u)}<div class="spacer"><b>${esc(fullName(u))}</b>${u.id === ME.id ? ' <span class="muted small">(vous)</span>' : ''}<div class="muted small">${esc(u.email || 'pas d’e-mail')}</div></div>
    ${u.status === 'pending' ? '<span class="badge warn">En attente</span>' : ''}${u.codeHash ? '' : '<span class="badge bad" title="Sans code, cette personne ne peut pas se connecter">sans code</span>'}<span class="badge ${u.role === 'createur' ? 'fp' : u.role === 'manager' ? 'ok' : ''}">${roleLabel(u.role)}</span>
    ${u.role !== 'createur' && u.status === 'active' && isManager() ? `<a class="btn ghost sm" href="#/coach/${u.id}">Fiche</a>` : ''}
    ${canEdit(u) ? `<button class="btn ghost icon sm" data-act="editMember" data-id="${u.id}" title="Modifier">${ico('edit')}</button>` : '<span style="width:30px"></span>'}</div>`;
}
function memOrg() {
  const all = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'archived');
  const creators = Object.values(S.users).filter(u => u.role === 'createur' && u.status !== 'archived');
  return `<div class="card"><div class="card-head">${ico('building')}<h3>${esc(CLUB.name)}</h3></div>
    <h3 class="muted t-13" style="margin:8px 0 2px">Créateur</h3>${creators.map(memberRow).join('') || '<p class="muted">Aucun.</p>'}
    <h3 class="muted t-13" style="margin:8px 0 2px">Managers</h3>${all.filter(u => u.role === 'manager').map(memberRow).join('') || '<p class="muted">Aucun.</p>'}
    <h3 class="muted t-13" style="margin:18px 0 2px">Membres</h3>${all.filter(u => u.role !== 'manager').map(memberRow).join('') || '<p class="muted">Aucun membre. Ajoutez votre équipe.</p>'}
    <p class="muted small" style="margin-bottom:0">Une invitation en attente ne compte dans aucun total tant que la personne ne s’est pas connectée.</p></div>
  <div class="card" style="margin-top:14px"><h3>Accès et rôles</h3>
    <div class="table-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>Ce que l’on peut faire</th><th>Créateur</th><th>Manager</th><th>Membre</th></tr></thead><tbody>
    ${[['Saisir ses KPI, voir son tableau de bord, le classement, le feed, le chat', 1, 1, 1], ['Traiter les relances (Action Rétention) et les résiliations', 1, 1, 1],
       ['Vue club, saisir pour un membre, fixer les objectifs', 1, 1, 0], ['Imports CSV, planning des tâches, défis flash', 1, 1, 0], ['Ajouter un membre et lui générer un code', 1, 1, 0],
       ['Nommer un manager ou un créateur, modifier un manager', 1, 0, 0], ['Créer un club, régler les KPI et les points', 1, 0, 0], ['Sauvegarde, restauration, tout effacer', 1, 0, 0], ['Classé et soumis à objectifs', 0, 1, 1]]
      .map(([l, ...v]) => `<tr><td>${l}</td>${v.map(x => `<td>${x ? `<b class="ok">${ico('check', 'ico ico-xs')}</b>` : '<span class="muted">n.d.</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    <p class="muted small" style="margin-bottom:0">Le compte Créateur administre l’outil : il voit tous nos clubs mais n’apparaît ni au classement ni dans les objectifs. Une même adresse e-mail peut avoir un accès Créateur et un accès Manager : c’est le code qui choisit le compte.</p></div>`;
}
ACTIONS.addMember = () => memberForm(null);
ACTIONS.editMember = el => memberForm(S.users[el.dataset.id]);
function memberForm(u) {
  const clubs = Object.values(S.clubs);
  openModal({ title: u ? 'Modifier le membre' : 'Ajouter un membre', body: `<form id="mf" class="grid">
    <div class="form-grid"><label class="field"><span>Prénom</span><input class="input" name="first" required value="${esc(u ? u.first : '')}"></label><label class="field"><span>Nom</span><input class="input" name="last" value="${esc(u ? u.last : '')}"></label></div>
    <label class="field"><span>E-mail (identifiant de connexion)</span><input class="input" type="email" name="email" value="${esc(u ? u.email || '' : '')}"></label>
    <div class="form-grid"><label class="field"><span>Rôle</span><select class="input" name="role" ${u && u.id === ME.id && !isCreator() ? 'disabled' : ''}>${Object.entries(ROLES).filter(([r]) => isCreator() || r === 'membre' || (u && u.role === r)).sort((a, b) => a[1].rank - b[1].rank).map(([r, x]) => `<option value="${r}" ${(u ? u.role : 'membre') === r ? 'selected' : ''}>${x.label}</option>`).join('')}</select></label>
    <div class="field"><span>Clubs</span>${clubs.map(c => `<label class="row small"><input type="checkbox" name="club_${c.id}" ${(u ? (u.clubs || []).includes(c.id) : c.id === CLUB.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div></div>
    ${!u ? `<label class="row small"><input type="checkbox" name="pending" ${backend.mode === 'firebase' ? 'checked' : ''}> Invitation en attente (devient actif à la première connexion)</label><p class="muted small" style="margin:0">Un code d’accès personnel sera généré à l’enregistrement.</p>` : `<div class="row"><span class="small spacer">${u.codeHash ? 'Code d’accès actif.' : '<b class="bad">Aucun code : connexion impossible.</b>'}</span><button class="btn sm" type="button" data-act="regenCode" data-id="${u.id}">${ico('shield')} ${u.codeHash ? 'Générer un nouveau code' : 'Générer un code'}</button></div>`}
    </form>`,
    foot: `${u && u.id !== ME.id ? `<button class="btn danger" data-act="archiveMember" data-id="${u.id}" style="margin-right:auto">Archiver</button>` : ''}<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="saveMember" data-id="${u ? u.id : ''}">${u ? 'Enregistrer' : 'Ajouter'}</button>` });
}
ACTIONS.saveMember = async el => {
  const f = formData($('#mf'));
  if (!f.role) f.role = S.users[el.dataset.id].role;
  if (!isCreator() && f.role !== 'membre' && !(el.dataset.id && S.users[el.dataset.id].role === f.role)) { toast('Seul le créateur peut nommer un manager.'); return; }
  if (!f.first.trim()) { toast('Le prénom est obligatoire.'); return; }
  const clubs = Object.keys(S.clubs).filter(id => f['club_' + id]);
  if (!clubs.length) { toast('Choisissez au moins un club.'); return; }
  const email = (f.email || '').trim().toLowerCase();
  const id = el.dataset.id || newId();
  const old = S.users[id];
  const u = { ...(old || { createdAt: Date.now(), avatar: 'h1', status: f.pending ? 'pending' : 'active' }), id, first: f.first.trim(), last: f.last.trim(), email, role: f.role, clubs };
  if (old && old.role === 'createur' && f.role !== 'createur' && !Object.values(S.users).some(x => x.id !== id && x.role === 'createur' && x.status === 'active')) { toast('Il faut garder au moins un créateur actif.'); return; }
  if (!email && (!old || backend.mode === 'firebase')) { toast('L’e-mail est obligatoire : c’est l’identifiant de connexion.'); return; }
  if (email && Object.values(S.users).some(x => x.id !== id && x.status !== 'archived' && (x.email || '') === email && x.role === f.role)) { toast('Cette adresse a déjà un compte ' + roleLabel(f.role) + '.'); return; }
  // Nouveau membre, ou e-mail change (la cle de connexion en depend) : nouveau code.
  let code = null;
  if (!old || (old.email !== email && old.codeHash)) { const c = await issueCode(u, email); code = c.code; Object.assign(u, { salt: c.salt, codeHash: c.codeHash, bootKey: c.bootKey }); await backend.setBoot(c.boot); }
  const ops = [[['users', id], u]];
  if (email) ops.push([['team', email.replace(/\./g, ',')], true]);
  if (old && old.email && old.email !== email) ops.push([['team', old.email.replace(/\./g, ',')], null]);
  db.batch(ops); closeModal();
  if (code) showCode(u, code, { mail: true }); else toast('Membre mis à jour.');
};
// Nouveau code : empreinte (mode local) + cle de connexion (mode partage).
// L'ancienne cle est effacee dans le meme envoi : l'ancien code est coupe net.
async function issueCode(u, email) {
  const c = await newCodeRecord();
  const key = await bootKeyOf(email || u.email, c.code);
  await backend.precreate(key, c.code);
  const boot = { [key]: u.id };
  if (u.bootKey && u.bootKey !== key) boot[u.bootKey] = null;
  return { ...c, bootKey: key, boot };
}
// Invitation : un e-mail pret a partir (ouvert dans la messagerie du manager,
// marche partout, tout de suite). Si l'envoi automatique est active
// (PARKPULSE_MAIL_AUTO), la demande part aussi dans /fitpulse_mail : le serveur
// (club/outils/fitpulse-serveur.mjs) envoie le bel e-mail puis l'efface.
function inviteText(u, code) {
  const url = `${location.origin}${location.pathname}?email=${encodeURIComponent(u.email || '')}`;
  const club = CLUB ? CLUB.name : 'Fitness Park';
  return {
    subject: `Votre accès Fit Pulse · ${club}`,
    body: `Bonjour ${u.first || ''},

Bienvenue dans Fit Pulse, l’application de l’équipe ${club} : vos objectifs, les paliers, le classement et vos relances, sur votre téléphone.

VOTRE ACCÈS
• Lien : ${url}
• E-mail : ${u.email}
• Code personnel : ${normCode(code)}

INSTALLER L’APPLICATION SUR VOTRE TÉLÉPHONE
• iPhone (Safari) : ouvrez le lien, bouton Partager puis « Sur l’écran d’accueil ».
• Android ou Samsung : ouvrez le lien dans Chrome ou Samsung Internet, menu ⋮ puis « Ajouter à l’écran d’accueil ».

Votre code est personnel : ne le partagez pas.
À tout de suite sur le terrain.
${ME ? fullName(ME) : ''}`,
  };
}
async function sendInvite(u, code) {
  const st = $('#mail-state');
  if (!window.PARKPULSE_MAIL_AUTO || backend.mode !== 'firebase' || !u.email) return;
  if (st) st.innerHTML = '<span class="muted">Envoi automatique de l’invitation…</span>';
  try {
    await backend.queueMail({ email: u.email, first: (u.first || '').slice(0, 40) || 'Bonjour', code: normCode(code), role: u.role, club: (CLUB ? CLUB.name : '').slice(0, 60), by: fullName(ME).slice(0, 60) });
    if ($('#mail-state')) $('#mail-state').innerHTML = `<span class="ok">${ico('check')} Invitation envoyée à <b>${esc(u.email)}</b></span><br><span class="muted small">Elle arrive en moins de 5 minutes (pensez aux spams).</span>`;
  } catch (e) {
    if ($('#mail-state')) $('#mail-state').innerHTML = `<span class="bad">Envoi automatique impossible (${esc(e.code || e.message || 'erreur')}).</span> Utilisez « Envoyer par e-mail ».`;
  }
}
ACTIONS.mailInvite = () => { const l = UI.lastCode; const u = l && S.users[l.id]; if (!u) return; const t = inviteText(u, l.code); location.href = `mailto:${encodeURIComponent(u.email || '')}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`; };
ACTIONS.shareInvite = async () => { const l = UI.lastCode; const u = l && S.users[l.id]; if (!u) return; const t = inviteText(u, l.code); try { await navigator.share({ title: t.subject, text: t.body }); } catch (e) { /* annule */ } };
// Le code n'est affiche qu'une fois : seule son empreinte est enregistree.
function showCode(u, code, opt = {}) {
  UI.lastCode = { id: u.id, code };
  openModal({ title: 'Code d’accès', body: `<p style="margin-top:0">Code personnel de <b>${esc(fullName(u))}</b> (${roleLabel(u.role)}). Il ne sera plus affiché.</p>
    <div class="card" style="text-align:center;padding:18px"><div class="muted small">${esc(u.email || 'pas d’e-mail : ajoutez-en un pour la connexion')}</div><div class="title" id="code-val" style="font-size:clamp(20px,7vw,30px);letter-spacing:.06em;user-select:all;word-break:break-all">${code}</div></div>
    ${opt.mail ? '<div id="mail-state" class="small" style="margin-top:12px;line-height:1.5"></div>' : ''}
    <p class="muted small" style="margin-bottom:0">Connexion : <b>${esc(location.origin + location.pathname)}</b> avec l’e-mail ci-dessus et ce code, sur téléphone ou ordinateur.</p>`,
    foot: `<button class="btn" data-act="copyCode">Copier</button>${u.email ? `<button class="btn" data-act="mailInvite">${ico('mail')} Envoyer par e-mail</button>` : ''}${navigator.share ? `<button class="btn" data-act="shareInvite">${ico('share')} Partager</button>` : ''}<button class="btn primary" data-close>C’est noté</button>` });
  if (opt.mail) sendInvite(u, code);
}
ACTIONS.copyCode = () => { const t = $('#code-val').textContent; navigator.clipboard.writeText(t).then(() => toast('Code copié.'), () => { const r = document.createRange(); r.selectNodeContents($('#code-val')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Sélectionné : faites Ctrl+C.'); }); };
ACTIONS.regenCode = async el => {
  const u = S.users[el.dataset.id];
  if (u.codeHash && !await confirmDlg(`Générer un nouveau code pour ${esc(fullName(u))} ? L’ancien code ne fonctionnera plus.`, { ok: 'Générer' })) return;
  if (!u.email) { toast('Ajoutez d’abord un e-mail à ce membre : c’est son identifiant.'); return; }
  const c = await issueCode(u);
  await backend.setBoot(c.boot);
  db.batch([[['users', u.id, 'salt'], c.salt], [['users', u.id, 'codeHash'], c.codeHash], [['users', u.id, 'bootKey'], c.bootKey]]);
  closeModal(); showCode(S.users[u.id], c.code, { mail: true });
};
ACTIONS.archiveMember = async el => {
  const u = S.users[el.dataset.id];
  if (!canEdit(u)) return;
  if (u.role === 'createur' && !Object.values(S.users).some(x => x.id !== u.id && x.role === 'createur' && x.status === 'active')) { toast('Il faut garder au moins un créateur actif.'); return; }
  if (!await confirmDlg(`Archiver ${esc(fullName(u))} ? Il sort des calculs du mois et ne peut plus se connecter, mais garde son historique.`, { ok: 'Archiver', danger: true })) return;
  // Le code est retire : a la reactivation, on en genere un nouveau.
  const ops = [[['users', u.id, 'status'], 'archived'], [['users', u.id, 'archivedAt'], today()], [['users', u.id, 'codeHash'], null], [['users', u.id, 'salt'], null], [['users', u.id, 'bootKey'], null]];
  if (u.bootKey) await backend.setBoot({ [u.bootKey]: null });
  if (u.email) ops.push([['team', u.email.replace(/\./g, ',')], null]);
  db.batch(ops); toast('Membre archivé.');
};
function memArchived() {
  const list = clubMembers(CLUB.id, { all: true }).filter(u => u.status === 'archived');
  return `<div class="card">${list.map(u => `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">${avatar(u)}<div class="spacer"><b>${esc(fullName(u))}</b><div class="muted small">${esc(u.email || '')} · archivé le ${dmy(u.archivedAt)}</div></div><button class="btn sm" data-act="unarchive" data-id="${u.id}">Réactiver</button></div>`).join('') || '<div class="empty">Aucun membre archivé.</div>'}
    <p class="muted small" style="margin-bottom:0">Les membres archivés sortent des calculs du mois mais gardent leur historique (classement all-time, trophées).</p></div>`;
}
ACTIONS.unarchive = el => { const u = S.users[el.dataset.id]; const ops = [[['users', u.id, 'status'], 'active'], [['users', u.id, 'archivedAt'], null]]; if (u.email) ops.push([['team', u.email.replace(/\./g, ',')], true]); db.batch(ops); toast('Membre réactivé : générez-lui un nouveau code (fiche du membre).'); };

// Historique : grille membres x KPI (mois) ou jours x KPI (un membre), editable.
function memHistory() {
  const mode = UI.histMode || 'month';
  const mk = UI.histMonth || curMonth();
  const members = clubMembers(CLUB.id);
  const kpis = kpiList();
  const q = norm(UI.histQ || '');
  if (mode === 'month') {
    const r = rangeOf('month', mk);
    const rows = members.filter(u => !q || norm(fullName(u)).includes(q));
    const tot = {};
    return `<div class="row wrap" style="margin-bottom:12px">${seg('histMode', [['month', 'Mois'], ['day', 'Jour par jour']], mode)}${monthNav('histMonth', mk)}<span class="spacer"></span><input class="input sm" style="width:200px" placeholder="Rechercher un membre" data-input="histQ" data-focus="histQ" value="${esc(UI.histQ || '')}"></div>
      <p class="muted small">Montants TTC. Cliquez sur un membre pour éditer ses saisies jour par jour. Un point orange signale un règlement saisi depuis Action Rétention, à valider.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Membre</th>${kpis.map(k => `<th class="num">${esc(k.label)}<br><span class="muted">${k.unit === 'eur' ? '€' : 'Qté'}</span></th>`).join('')}</tr></thead><tbody>
      ${rows.map(u => `<tr><td><a href="javascript:void 0" data-act="histUser" data-id="${u.id}"><b>${esc(fullName(u))}</b></a></td>${kpis.map(k => { const v = sumRange(CLUB.id, u.id, k.id, r.from, r.to); tot[k.id] = (tot[k.id] || 0) + v; const nChk = Object.values(S.entries).filter(e => e.userId === u.id && e.kpiId === k.id && e.date >= r.from && e.date <= r.to && e.needsCheck && !e.checkedAt && entryCounts(e)).length; return `<td class="num">${v ? fmtV(v, k.unit) : '<span class="muted">0</span>'}${nChk ? ` <i class="hdot h-watch" title="${plur(nChk, 'saisie à valider', 'saisies à valider')}"></i>` : ''}</td>`; }).join('')}</tr>`).join('')}
      <tr class="total"><td>Total</td>${kpis.map(k => { const t = clubMonthTarget(mk, CLUB.id, k.id); return `<td class="num">${fmtV(tot[k.id] || 0, k.unit)}${t ? `<br><span class="muted small">/ ${fmtV(t, k.unit)} · ${fmtP((tot[k.id] || 0) / t)}</span>` : ''}</td>`; }).join('')}</tr></tbody></table></div>`;
  }
  const uid = UI.histUser && S.users[UI.histUser] ? UI.histUser : (members[0] && members[0].id);
  if (!uid) return `<div class="card">${emptyBox({ art: 'target', title: 'Aucun membre actif', text: 'Ajoutez votre équipe dans l’organigramme.' })}</div>`;
  const n = daysIn(mk);
  let html = `<div class="row wrap" style="margin-bottom:12px">${seg('histMode', [['month', 'Mois'], ['day', 'Jour par jour']], mode)}${monthNav('histMonth', mk)}
    <select class="input sm" style="width:auto" data-change="histUserSel">${members.map(u => `<option value="${u.id}" ${u.id === uid ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></div>
    <p class="muted small">Cliquez sur une case pour corriger le total du jour : la sauvegarde est automatique. Les saisies importées restent visibles dans Imports.</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Jour</th>${kpis.map(k => `<th class="num">${esc(k.label)}</th>`).join('')}</tr></thead><tbody>`;
  for (let d = 1; d <= n; d++) {
    const date = `${mk}-${pad(d)}`;
    const future = date > today();
    html += `<tr><td class="nowrap">${JOURS[dateOf(date).getDay()].slice(0, 3)} ${d}</td>${kpis.map(k => { const v = sumRange(CLUB.id, uid, k.id, date, date); const chk = toCheck(uid, k.id, date); return `<td class="num${chk.length ? ' to-check' : ''}"><input class="cell" type="number" min="0" step="${k.unit === 'eur' ? '0.01' : '1'}" value="${v ? Math.round(v * 100) / 100 : ''}" placeholder="0" data-change="histCell" data-u="${uid}" data-k="${k.id}" data-d="${date}" ${future ? 'disabled' : ''}>${chk.length ? `<label class="chk-v" title="Saisi depuis Action Rétention : à valider"><i class="hdot h-watch"></i><input type="checkbox" data-change="entryValid" data-ids="${chk.map(e => e.id).join(',')}"> Validé</label>` : ''}</td>`; }).join('')}</tr>`;
  }
  return html + '</tbody></table></div>';
}
// Saisies à valider (« Réglé » depuis la rétention) : comptées, mais signalées tant que le manager n'a pas validé.
const toCheck = (uid, kpiId, date) => Object.values(S.entries).filter(e => e.userId === uid && e.kpiId === kpiId && e.date === date && e.needsCheck && !e.checkedAt && entryCounts(e));
ACTIONS.entryValid = el => { const ops = el.dataset.ids.split(',').filter(id => S.entries[id]).flatMap(id => [[['entries', id, 'checkedAt'], Date.now()], [['entries', id, 'checkedBy'], ME.id]]); ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'valide_saisie', club: CLUB.id, ids: el.dataset.ids }]); db.batch(ops); toast('Saisie validée'); };
ACTIONS.histQ = el => { UI.histQ = el.value; render(); };
ACTIONS.histUser = el => { UI.histUser = el.dataset.id; UI.histMode = 'day'; render(); };
ACTIONS.histUserSel = el => { UI.histUser = el.value; render(); };
// Corriger le total d'un jour : on ajoute une saisie d'ajustement (manuelle)
// egale a l'ecart, sans toucher aux saisies importees.
// Correction d'une case : on ne supprime plus les saisies d'origine (elles
// gardent leur heure, utile aux defis flash). Une seule saisie d'ajustement par
// case, d'id fixe : une seconde correction remplace la premiere, deux managers
// en meme temps ne s'additionnent pas. Datee a midi du jour corrige.
ACTIONS.histCell = el => {
  const { u, k, d } = el.dataset;
  const v = parseMontant(el.value); const want = Number.isNaN(v) ? 0 : v;
  const adjId = `adj_${CLUB.id}_${u}_${k}_${d}`;
  const old = S.entries[adjId];
  const base = Math.round((sumRange(CLUB.id, u, k, d, d) - (old && entryCounts(old) ? Number(old.value) || 0 : 0)) * 100) / 100;
  const need = Math.round((want - base) * 100) / 100;
  const ops = [[['entries', adjId], need === 0 ? null : { id: adjId, userId: u, clubId: CLUB.id, kpiId: k, date: d, value: need, source: 'manual', at: dateOf(d).getTime() + 12 * 3600000, effectiveAt: Date.now(), by: ME.id, adjust: true }]];
  ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'adjust', club: CLUB.id, userId: u, kpiId: k, date: d, before: base + (old ? Number(old.value) || 0 : 0), after: want }]);
  db.batch(ops); toast('Correction enregistrée');
};

// Objectifs du mois : tableau editable, total = membres actifs uniquement.
function memTargets() {
  const mk = UI.tgMonth || curMonth();
  const members = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'archived');
  const kpis = kpiList();
  const locked = mk < curMonth();
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('tgMonth', mk)}<span class="spacer"></span>
    <button class="btn sm" data-act="yearPlan">${ico('cal')} Proposer les objectifs de l’année</button><button class="btn sm" data-act="copyTargets" data-mk="${mk}">${ico('history')} Reprendre les objectifs de ${monthLabel(addMonths(mk, -1))}</button></div>
    ${locked ? '<div class="alert" style="margin-bottom:12px">Mois terminé : les objectifs restent modifiables, mais cela change les scores et trophées déjà calculés.</div>' : ''}
    <div class="table-wrap"><table class="t"><thead><tr><th>Membre</th>${kpis.map(k => `<th class="num" title="${k.required ? 'KPI obligatoire' : ''}">${k.required ? ico('crown', 'ico ico-xs') + ' ' : ''}${esc(k.label)}<br><span class="muted">${k.unit === 'eur' ? '€' : 'Qté'} · ${fmtN(k.points)} pts</span></th>`).join('')}</tr></thead><tbody>
    ${members.map(u => `<tr><td class="nowrap"><b>${esc(fullName(u))}</b>${u.status === 'pending' ? ' <span class="badge warn">en attente</span>' : ''}</td>${kpis.map(k => `<td class="num"><input class="cell" type="number" min="0" value="${monthTarget(mk, u.id, k.id) || ''}" placeholder="0" data-change="tgCell" data-mk="${mk}" data-u="${u.id}" data-k="${k.id}"></td>`).join('')}</tr>`).join('')}
    <tr class="total"><td>Total club (actifs)</td>${kpis.map(k => `<td class="num">${fmtV(clubMonthTarget(mk, CLUB.id, k.id), k.unit)}</td>`).join('')}</tr></tbody></table></div>
    <p class="muted small">Couronne = KPI obligatoire du classement global. Points et KPI se règlent dans Mes clubs > Réglages. Une invitation en attente peut recevoir un objectif, il ne compte qu’une fois la personne active.</p>`;
}
ACTIONS.tgCell = el => { const v = parseFloat(String(el.value).replace(',', '.')); db.set(['targets', el.dataset.mk, el.dataset.u, el.dataset.k], v > 0 ? v : null); };
ACTIONS.copyTargets = async el => {
  const mk = el.dataset.mk, prev = addMonths(mk, -1);
  if (!S.targets[prev]) { toast('Aucun objectif le mois précédent.'); return; }
  if (!await confirmDlg(`Copier les objectifs de ${monthLabel(prev)} vers ${monthLabel(mk)} ? Les valeurs déjà saisies seront remplacées.`)) return;
  const ops = [];
  clubMembers(CLUB.id, { all: true }).forEach(u => { if (S.targets[prev][u.id]) ops.push([['targets', mk, u.id], JSON.parse(JSON.stringify(S.targets[prev][u.id]))]); });
  db.batch(ops); toast('Objectifs copiés.');
};

// Recaps : le bilan mensuel de chaque membre.
// Mois en or, argent, bronze : distinct des niveaux (Rookie a Legende).
const monthTier = s => s == null ? 'EN COURS' : s >= 1 ? 'OR' : s >= 0.75 ? 'ARGENT' : s >= 0.5 ? 'BRONZE' : 'EN COURS';
function memRecaps() {
  const mk = UI.recMonth || addMonths(curMonth(), -1);
  const r = rangeOf('month', mk);
  const rk = ranking(CLUB.id, r);
  const sort = UI.recSort || 'rank';
  const rows = rk.map(x => {
    const best = x.st.rows.filter(y => y.pct != null).sort((a, b) => b.pct - a.pct)[0];
    return { ...x, best, tr: trophies(x.u.id).filter(t => t.mk === mk).length, reached: x.st.reached, count: x.st.count };
  });
  if (sort === 'name') rows.sort((a, b) => fullName(a.u).localeCompare(fullName(b.u)));
  if (sort === 'badges') rows.sort((a, b) => b.tr - a.tr);
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('recMonth', mk)}<span class="spacer"></span><span class="muted small">Score = moyenne pondérée par les points, plafond 150 % par KPI.</span></div>
    <div class="table-wrap"><table class="t"><thead><tr><th class="sortable" data-act="ui" data-key="recSort" data-val="name">Membre</th><th class="num">Score</th><th>Mois</th><th class="num sortable" data-act="ui" data-key="recSort" data-val="rank">Rang</th><th class="num">KPI atteints</th><th>Top KPI</th><th class="num sortable" data-act="ui" data-key="recSort" data-val="badges">Trophées</th><th></th></tr></thead><tbody>
    ${rows.map(x => `<tr><td><b>${esc(fullName(x.u))}</b></td><td class="num">${fmtP(x.score)}</td><td><span class="tag ${x.score >= 1 ? 'is-brand' : x.score >= .75 ? 'is-ok' : x.score >= .5 ? 'is-info' : ''}">${monthTier(x.score)}</span></td><td class="num">${x.rank}</td><td class="num">${x.reached}/${x.count}</td><td>${x.best ? `${esc(x.best.k.label)} ${fmtP(x.best.pct)}` : 'n.d.'}</td><td class="num">${x.tr}</td><td class="nowrap"><a class="btn sm" href="#/wrap/${mk}/${x.u.id}">Voir le bilan</a> <button class="btn sm ghost" data-act="wrapNote" data-u="${x.u.id}" data-mk="${mk}">${deepGet(S, ['wrapNotes', mk, x.u.id]) ? 'Modifier le mot' : 'Ajouter un mot'}</button></td></tr>`).join('')}
    </tbody></table></div>`;
}

// ── Taches : planning journalier du club ──────────────────────────────────
function memTasks() {
  const plan = S.tasks.plan[CLUB.id] || {};
  const byHour = {}; Object.values(plan).forEach(p => { (byHour[p.hour] = byHour[p.hour] || []).push(p); });
  const done = {}; Object.values(S.tasks.done[today()] || {}).forEach(m => Object.keys(m).forEach(id => { done[id] = (done[id] || 0) + 1; }));
  const lib = Object.values(S.tasks.library);
  const cats = [...new Set(lib.map(t => t.cat))];
  let hours = '';
  for (let h = 6; h <= 23; h++) {
    hours += `<div class="hour"><div class="h">${pad(h)}:00</div><div class="slot" data-hour="${h}">${(byHour[h] || []).map(p => { const t = S.tasks.library[p.taskId]; return t ? `<span class="chip ${done[p.id] ? 'done' : ''}" draggable="true" data-plan="${p.id}" title="${done[p.id] ? `Validée par ${plur(done[p.id], 'personne', 'personnes')} aujourd’hui` : ''}">${esc(t.label)}<button data-act="unplan" data-id="${p.id}" aria-label="Retirer">${ico('x', 'ico ico-xs')}</button></span>` : ''; }).join('')}<button class="btn ghost sm" data-act="planAt" data-hour="${h}" title="Ajouter une tâche">${ico('plus')}</button></div></div>`;
  }
  const doneToday = Object.entries(S.tasks.done[today()] || {});
  return `<div class="planner"><div class="card"><div class="card-head"><h3>Planning type de la journée</h3><span class="spacer"></span><button class="btn sm" data-act="resetPlan">Réinitialiser au modèle par défaut</button></div>
      <p class="muted small" style="margin-top:-6px">Glissez une tâche de la bibliothèque vers une heure (ou bouton +). L’équipe coche ses tâches dans le panneau Saisies du tableau de bord.</p>${hours}</div>
    <div class="grid"><div class="card"><div class="card-head"><h3>Tâches disponibles</h3><span class="spacer"></span><button class="btn sm" data-act="newTask">${ico('plus')}</button></div>
      <div class="lib">${cats.map(c => `<div class="muted small" style="margin-top:6px;font-weight:700">${esc(c)}</div>${lib.filter(t => t.cat === c).map(t => `<span class="chip" draggable="true" data-lib="${t.id}">${esc(t.label)}</span>`).join('')}`).join('')}</div></div>
      <div class="card"><h3>Validations du jour</h3>${doneToday.length ? doneToday.map(([uid, m]) => `<div class="small" style="margin-top:8px"><b>${esc(fullName(S.users[uid]))}</b> : ${plur(Object.keys(m).length, 'tâche', 'tâches')}</div>`).join('') : '<p class="muted small">Aucune validation aujourd’hui.</p>'}</div></div></div>`;
}
function bindPlanner() {
  let drag = null;
  document.querySelectorAll('[data-lib],[data-plan]').forEach(c => c.addEventListener('dragstart', e => { drag = c.dataset.lib ? { lib: c.dataset.lib } : { plan: c.dataset.plan }; e.dataTransfer.effectAllowed = 'move'; }));
  document.querySelectorAll('.slot').forEach(s => {
    s.addEventListener('dragover', e => { e.preventDefault(); s.classList.add('over'); });
    s.addEventListener('dragleave', () => s.classList.remove('over'));
    s.addEventListener('drop', e => {
      e.preventDefault(); s.classList.remove('over'); if (!drag) return;
      const hour = Number(s.dataset.hour);
      if (drag.lib) { const id = newId(); db.set(['tasks', 'plan', CLUB.id, id], { id, taskId: drag.lib, hour }); }
      else db.set(['tasks', 'plan', CLUB.id, drag.plan, 'hour'], hour);
      drag = null;
    });
  });
}
ACTIONS.unplan = el => db.set(['tasks', 'plan', CLUB.id, el.dataset.id], null);
ACTIONS.planAt = el => {
  const h = Number(el.dataset.hour);
  const lib = Object.values(S.tasks.library);
  openModal({ title: `Ajouter une tâche à ${pad(h)}:00`, body: `<select class="input" id="pt">${lib.map(t => `<option value="${t.id}">${esc(t.cat)} : ${esc(t.label)}</option>`).join('')}</select>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="planAdd">Ajouter</button>', onMount: m => { m.dataset.hour = h; } });
};
ACTIONS.planAdd = () => { const m = $('.modal'); const id = newId(); db.set(['tasks', 'plan', CLUB.id, id], { id, taskId: $('#pt').value, hour: Number(m.dataset.hour) }); closeModal(); };
ACTIONS.newTask = () => openModal({ title: 'Nouvelle tâche', body: `<form id="ntf" class="grid"><label class="field"><span>Intitulé</span><input class="input" name="label" required></label><label class="field"><span>Catégorie</span><input class="input" name="cat" value="Club" list="cats"><datalist id="cats">${[...new Set(Object.values(S.tasks.library).map(t => t.cat))].map(c => `<option value="${esc(c)}">`).join('')}</datalist></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="saveTask">Créer</button>' });
ACTIONS.saveTask = () => { const f = formData($('#ntf')); if (!f.label.trim()) return; const id = 't' + newId(); db.set(['tasks', 'library', id], { id, label: f.label.trim(), cat: f.cat.trim() || 'Club' }); closeModal(); };
ACTIONS.resetPlan = async () => {
  if (!await confirmDlg('Remplacer le planning du club par le modèle par défaut ?', { ok: 'Réinitialiser', danger: true })) return;
  const lib = Object.values(S.tasks.library); const find = l => (lib.find(t => t.label === l) || {}).id;
  const model = [[7, 'Check passage du matin'], [7, 'Ouverture caisse'], [9, 'Réponse aux avis Google'], [10, 'Appels prospects de la veille'], [11, 'Appels J+15 nouveaux adhérents'], [14, 'Relance adhérents sans mandat'], [15, 'Relance impayés du jour'], [17, 'Story Instagram'], [18, 'Visites programmées'], [21, 'Saisie des KPI du jour dans Fit Pulse'], [22, 'Validation de caisse']];
  const plan = {}; model.forEach(([h, l]) => { const t = find(l); if (t) { const id = newId(); plan[id] = { id, taskId: t, hour: h }; } });
  db.set(['tasks', 'plan', CLUB.id], plan);
};

// ── Profil ─────────────────────────────────────────────────────────────────
PAGES.profile = {
  title: 'Mon profil',
  render() {
    const tab = UI.profTab || 'perf';
    const pts = allTime(ME.id); const lv = levelOf(pts);
    const head = `<div class="card" style="margin-bottom:14px"><div class="row wrap prof-head" style="gap:16px">${levelBadge(lv, 72)}${avatar(ME, 'lg')}<div class="spacer"><h1 class="h-profile">${esc(fullName(ME))}</h1>
      <div class="row wrap small" style="margin-top:4px"><span class="muted">${esc(ME.email || '')}</span><span class="badge">${roleLabel(ME.role)}</span>${(ME.clubs || []).map(c => S.clubs[c] ? `<span class="badge">${esc(S.clubs[c].name)}</span>` : '').join('')}</div></div>
      <div style="text-align:right"><div class="title t-28">${fmtN(pts)} pts</div><div class="muted small">${lv.next ? `${fmtN(lv.next.min - pts)} pts avant ${lv.next.label}` : 'Niveau maximum'}</div></div></div>
      <div class="lvl-row">${LEVELS.map((l, i) => { const got = pts >= l.min, nxt = lv.next && lv.next.id === l.id; const pr = nxt ? clamp((pts - LEVELS[i - 1].min) / (l.min - LEVELS[i - 1].min), 0, 1) : 0; return `<div class="lv ${nxt ? 'next' : ''}">${levelBadge(l, 40, { dim: !got && !nxt })}${nxt ? `<div class="lvl-prog"><i style="width:${Math.round(pr * 100)}%"></i></div>` : ''}<span>${fmtN(l.min)}</span></div>`; }).join('')}</div>
      ${lv.next ? `<p class="muted small" style="margin:8px 0 0">${fmtN(lv.next.min - pts)} pts avant ${lv.next.label}${(() => { const w = weeklyPace(ME.id); return w > 0 ? `, soit environ ${plur(Math.ceil((lv.next.min - pts) / w), 'semaine', 'semaines')} au rythme actuel` : ''; })()}.</p>` : ''}</div>`;
    return head + tabs('profTab', [['perf', 'Performances'], ['account', 'Compte']], tab) + (tab === 'perf' ? profPerf() : profAccount());
  },
};
function profPerf() {
  const acc = accomplishments(ME.id);
  const tr = trophies(ME.id);
  const groups = [['season', 'Saisons'], ['month', 'Mois'], ['week', 'Semaines'], ['flash', 'Défis flash']];
  const months = pastMonths().filter(m => m < curMonth()).reverse();
  const showAll = UI.profWraps === 'all';
  return `<div class="grid">
    <div class="card"><h3>Accomplissements</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(220px, 100%), 1fr));margin-top:10px">
      <div class="trophy"><div class="ic">${trophyArt({ kind: 'kpi', label: 'Régularité' }, 48, !acc.streak)}</div><b>Régularité : ${plur(acc.streak, 'jour', 'jours')} de suite</b><span class="muted small">${acc.streak >= 3 ? 'Série en cours, continuez !' : 'Prochain palier : trois jours de suite'}</span></div>
      <div class="trophy"><div class="ic">${trophyArt({ kind: 'month', icon: 'trophy', label: 'Premier 100 %' }, 48, !acc.first100)}</div><b>Premier 100 %</b><span class="muted small">${acc.first100 ? 'Obtenu' : 'Un KPI à 100 % sur un mois'}</span></div>
      <div class="trophy"><div class="ic">${trophyArt({ kind: 'season', icon: 'crown', label: 'Grand chelem' }, 48, !acc.all100)}</div><b>Grand chelem</b><span class="muted small">${acc.all100 ? 'Obtenu' : 'Tous les KPI à 100 % sur un mois'}</span></div></div></div>
    <div class="card"><h3>Mes trophées (${tr.length})</h3><p class="muted small">Le même décompte que le classement.</p>
      ${groups.map(([k, l]) => { const g = tr.filter(t => t.kind === k); return `<div class="muted small" style="font-weight:700;margin:12px 0 6px">${l} · ${g.length}</div>${g.length ? `<div class="trophies">${g.slice().reverse().map(t => `<div class="trophy"><div class="ic">${trophyIcon(t)}</div><b>${esc(t.label)}</b></div>`).join('')}</div>` : '<p class="muted small">Aucun pour l’instant.</p>'}`; }).join('')}</div>
    <div class="card"><h3>Mes bilans mensuels</h3>${months.length ? (showAll ? months : months.slice(0, 3)).map((m, i) => `<a class="row" style="padding:10px 0;border-bottom:1px solid var(--line);text-decoration:none" href="#/wrap/${m}/${ME.id}">${ico('chart')}<b class="spacer">${monthLabel(m)}</b>${i === 0 ? '<span class="badge fp">Dernier bilan, à revoir</span>' : ''}${ico('chevR')}</a>`).join('') : '<p class="muted">Votre premier bilan apparaîtra à la fin du mois.</p>'}
      ${months.length > 3 && !showAll ? `<button class="btn sm" style="margin-top:10px" data-act="ui" data-key="profWraps" data-val="all">Voir ${months.length - 3} mois de plus</button>` : ''}</div></div>`;
}
function profAccount() {
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(320px, 100%), 1fr))">
    <div class="card"><h3>Mes informations</h3><form id="pf" class="grid" style="margin-top:10px"><div class="form-grid"><label class="field"><span>Prénom</span><input class="input" name="first" value="${esc(ME.first)}"></label><label class="field"><span>Nom</span><input class="input" name="last" value="${esc(ME.last)}"></label></div>
      <p class="muted small" style="margin:0">Rôle : ${roleLabel(ME.role)} · membre depuis le ${dmy(isoOf(new Date(ME.createdAt || Date.now())))}</p><button class="btn primary" data-act="saveProfile" type="button">Enregistrer</button></form></div>
    ${notifCard()}
    <div class="card"><h3>Sécurité</h3>${`<p class="small">Connexion par e-mail et code d’accès personnel.</p><form id="cc" class="grid"><label class="field"><span>Code actuel</span><input class="input" name="cur" id="cc-cur" placeholder="FP-XXXX-XXXX-XXXX" autocomplete="current-password"></label><button class="btn" type="button" data-act="changeMyCode">${ico('shield')} Générer un nouveau code</button></form><p class="muted small">${backend.mode === 'firebase' ? 'Votre code ouvre la base de l’équipe depuis n’importe quel appareil. Le nouveau code remplace l’ancien partout.' : 'En mode local, les données restent dans ce navigateur : le code protège l’accès à l’écran.'}</p>`}</div></div>`;
}
ACTIONS.saveProfile = () => { const f = formData($('#pf')); if (!f.first.trim()) return; db.batch([[['users', ME.id, 'first'], f.first.trim()], [['users', ME.id, 'last'], f.last.trim()]]); toast('Profil enregistré.'); };
ACTIONS.setAvatar = el => db.set(['users', ME.id, 'avatar'], el.dataset.a);
ACTIONS.prefToggle = el => setPref(el.dataset.k, el.checked);

// Mot du manager sur le bilan d'un membre (une slide dediee, signee).
ACTIONS.wrapNote = el => {
  const { u, mk } = el.dataset; const cur = deepGet(S, ['wrapNotes', mk, u]) || {};
  openModal({ title: `Un mot pour ${esc(fullName(S.users[u]))}`, body: `<textarea class="input" id="wn" rows="4" maxlength="280" placeholder="280 caractères au plus">${esc(cur.text || '')}</textarea>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="wrapNoteSave" data-u="${u}" data-mk="${mk}">Enregistrer</button>` });
};
ACTIONS.wrapNoteSave = el => { const t = ($('#wn').value || '').trim().slice(0, 280); db.set(['wrapNotes', el.dataset.mk, el.dataset.u], t ? { text: t, by: ME.id, at: Date.now() } : null); closeModal(); toast('Mot enregistré'); };

// ── Bilan mensuel (format stories) ────────────────────────────────────────
// Toujours tourne vers le mois suivant : le bas du classement voit sa
// progression ou son meilleur KPI, jamais un rang qui decourage.
function wrapActions(uid, mk) {
  const from = mk + '-01', to = `${mk}-${daysIn(mk)}`;
  const saved = Object.values(S.entries).filter(e => e.userId === uid && e.kpiId === 'sauvetage' && e.date >= from && e.date <= to && entryCounts(e)).reduce((s, e) => s + Number(e.value || 0), 0);
  const paid = Object.values(S.entries).filter(e => e.userId === uid && e.kpiId === 'impayes' && e.date >= from && e.date <= to && entryCounts(e)).reduce((s, e) => s + Number(e.value || 0), 0);
  const good = Object.values(S.loyalty || {}).filter(l => l.userId === uid && isoOf(new Date(l.at)).slice(0, 7) === mk && OUTCOMES[l.outcome] && OUTCOMES[l.outcome].done && !OUTCOMES[l.outcome].lost).length;
  return { saved, paid, good };
}
PAGES.wrap = {
  render(args) {
    const [mk, uid0] = args; const uid = uid0 && S.users[uid0] ? uid0 : ME.id;
    if (!/^\d{4}-\d{2}$/.test(mk || '')) return '<div class="auth"><div class="auth-card">Bilan introuvable. <a href="#/profile">Retour</a></div></div>';
    if (uid !== ME.id && !isManager()) return '<div class="auth"><div class="auth-card">Ce bilan est personnel. <a href="#/profile">Retour</a></div></div>';
    const u = S.users[uid]; const clubId = (u.clubs || []).includes(CLUB.id) ? CLUB.id : u.clubs[0];
    const r = rangeOf('month', mk); const st = statsFor(clubId, uid, r, { requiredOnly: true }); const stAll = statsFor(clubId, uid, r);
    const prev = statsFor(clubId, uid, rangeOf('month', addMonths(mk, -1)), { requiredOnly: true });
    const rk = ranking(clubId, r); const me = rk.find(x => x.u.id === uid);
    const top = me && me.rank <= Math.ceil(rk.length / 2);
    const best = stAll.rows.filter(x => x.pct != null).sort((a, b) => b.pct - a.pct)[0];
    const worst = stAll.rows.filter(x => x.target > 0 && x.k.required && x.pct != null && x.pct < 1).sort((a, b) => a.pct - b.pct)[0];
    const tr = trophies(uid).filter(t => t.mk === mk);
    const club = S.clubs[clubId]; const act = wrapActions(uid, mk); const note = deepGet(S, ['wrapNotes', mk, uid]);
    const prog = st.score != null && prev.score != null ? Math.round((st.score - prev.score) * 100) : null;
    const nextMk = addMonths(mk, 1);
    const perWeek = worst ? Math.max(1, Math.ceil((worst.target - worst.real) / 4)) : 0;
    const phrase = st.score == null ? 'Vos objectifs arrivent : chaque vente compte déjà.'
      : worst ? `Le mois prochain : ${worst.k.unit === 'eur' ? fmtE(perWeek) : plur(perWeek, worst.k.label.toLowerCase(), worst.k.label.toLowerCase())} de plus par semaine.`
      : 'Tous vos objectifs sont tenus. On garde ce rythme.';
    const slides = [
      `<div class="title wrap-brand">FIT PULSE</div><div class="avatar lg" style="margin:0 auto">${esc(initials(u))}</div><h1 class="wrap-name">${esc(u.first)}</h1><div class="wrap-lead">Votre mois de ${monthLabel(mk)}</div><div class="muted small wrap-hint">Touchez ou utilisez les flèches pour continuer</div>`,
      `<div class="wrap-lead">Votre score du mois</div><div class="huge" id="wrap-count">0 %</div><div class="muted small">Moyenne de vos KPI obligatoires, chacun compté selon son importance</div>`,
      best ? `<div class="wrap-lead">Votre meilleur KPI</div><div class="wrap-ico">${kpiIcon(best.k, 'ico ico-xl')}</div><h1 class="wrap-kpi">${esc(best.k.label)}</h1><div class="huge wrap-mid">${fmtP(best.pct)}</div><div>${fmtV(best.real, best.k.unit)} sur ${fmtV(best.target, best.k.unit)}</div>` : '<div>Aucun KPI ce mois-là.</div>',
      `<div class="wrap-lead">Vos KPI du mois</div>${stAll.rows.filter(x => x.target > 0).map(x => `<div style="text-align:left;margin:6px 0"><div class="row small"><b>${esc(x.k.label)}</b><span class="spacer"></span>${fmtV(x.real, x.k.unit)} sur ${fmtV(x.target, x.k.unit)}</div>${progressBar(x.pct, { ticks: false })}</div>`).join('')}`,
      top ? `<div class="wrap-lead">Votre classement</div><div class="huge">${me.rank}<sup>${me.rank === 1 ? 'er' : 'e'}</sup></div><div class="title wrap-club">${esc(club ? club.name : '')}</div><div class="muted">sur ${plur(rk.length, 'membre classé', 'membres classés')}</div>`
        : prog != null && prog > 0 ? `<div class="wrap-lead">Votre progression</div><div class="huge">+${prog}</div><div class="muted">points de score par rapport à ${monthLabel(addMonths(mk, -1)).toLowerCase()}</div>`
        : `<div class="wrap-lead">Votre point fort</div><div class="huge wrap-mid">${best ? esc(best.k.label) : 'À venir'}</div><div class="muted">${best ? fmtP(best.pct) + ' de l’objectif' : ''}</div>`,
      `<div class="wrap-lead">Vos actions</div><div class="wrap-acts"><div><b>${fmtN(act.saved)}</b><span>${plur(act.saved, 'client sauvé', 'clients sauvés', false)}</span></div><div><b>${fmtE(act.paid)}</b><span>impayés récupérés</span></div><div><b>${fmtN(act.good)}</b><span>${plur(act.good, 'relance aboutie', 'relances abouties', false)}</span></div></div>`,
      `<div class="wrap-lead">Vos trophées</div><div class="huge">${tr.length}</div><div class="wrap-trophies">${tr.map(t => `<div class="wt">${trophyIcon(t)}<small>${esc(t.label)}</small></div>`).join('')}</div>`,
      ...(note && note.text ? [`<div class="wrap-lead">Le mot de votre manager</div><blockquote class="wrap-note">« ${esc(note.text)} »</blockquote><div class="muted">${S.users[note.by] ? esc(S.users[note.by].first) : ''}</div>`] : []),
      `<div class="wrap-lead">Votre résumé</div><canvas id="wrap-canvas" width="540" height="760" style="width:100%;max-width:300px;margin:0 auto;border-radius:14px"></canvas><div class="row" style="justify-content:center;gap:8px">${navigator.share ? `<button class="btn" data-act="wrapShare">${ico('share')} Partager</button>` : ''}<button class="btn primary" data-act="wrapDownload">${ico('download')} Télécharger</button></div><div class="muted small">Chiffres internes au club : à garder pour vous ou l’équipe.</div>`,
    ];
    UI.wrapData = { u, mk, st, me, top, tr, club, phrase, prog, slides: slides.length };
    return `<div class="wrap-stage" tabindex="-1"><div class="wrap-card"><div class="wrap-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
      <button class="wrap-close" data-act="wrapClose" aria-label="Fermer">${ico('x')}</button>
      <button class="wrap-tap l" data-act="wrapPrev" aria-label="Précédent"></button><button class="wrap-tap r" data-act="wrapNext" aria-label="Suivant"></button>
      ${slides.map((s, i) => `<div class="wrap-slide ${i ? 'hidden' : ''}" data-slide="${i}" aria-live="polite">${s}</div>`).join('')}</div></div>`;
  },
  mount() {
    UI.wrapIdx = 0; UI.wrapPaused = false; wrapShow(0);
    const st = $('.wrap-stage'); if (!st) return; st.focus({ preventScroll: true });
    st.addEventListener('pointerdown', () => { UI.wrapPaused = true; clearTimeout(wrapTimer); });
    st.addEventListener('pointerup', () => { UI.wrapPaused = false; });
  },
};
document.addEventListener('keydown', e => {
  if (!$('.wrap-stage')) return;
  if (e.key === 'ArrowRight') ACTIONS.wrapNext(); else if (e.key === 'ArrowLeft') ACTIONS.wrapPrev(); else if (e.key === 'Escape') ACTIONS.wrapClose();
});
let wrapTimer = null;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function wrapShow(i) {
  const n = UI.wrapData.slides; i = clamp(i, 0, n - 1); UI.wrapIdx = i;
  $$('.wrap-slide').forEach(s => s.classList.toggle('hidden', Number(s.dataset.slide) !== i));
  $$('.wrap-bars i').forEach((b, j) => { b.className = j < i ? 'done' : j === i ? (reducedMotion() ? 'done' : 'cur') : ''; const x = $('b', b); x.style.animation = 'none'; void x.offsetWidth; x.style.animation = ''; });
  clearTimeout(wrapTimer);
  if (i === 1) { const target = Math.round((UI.wrapData.st.score || 0) * 100); const el = $('#wrap-count'); if (reducedMotion()) { if (el) el.textContent = target + ' %'; } else { let v = 0; const t = setInterval(() => { v = Math.min(target, v + Math.max(1, Math.round(target / 40))); if (el) el.textContent = v + ' %'; if (v >= target) clearInterval(t); }, 30); } }
  if (i === n - 1) { drawWrapCard(); return; }
  if (!reducedMotion()) wrapTimer = setTimeout(() => { if (!UI.wrapPaused) wrapShow(i + 1); }, 6000);
}
ACTIONS.wrapNext = () => wrapShow(UI.wrapIdx + 1);
ACTIONS.wrapPrev = () => wrapShow(UI.wrapIdx - 1);
ACTIONS.wrapClose = () => { clearTimeout(wrapTimer); history.length > 1 ? history.back() : (location.hash = '#/profile'); };
async function drawWrapCard() {
  const c = $('#wrap-canvas'); if (!c) return; const x = c.getContext('2d'); const d = UI.wrapData;
  try { await document.fonts.load('800 italic 40px "Barlow Condensed"'); await document.fonts.load('600 20px Montserrat'); await document.fonts.ready; } catch (e) { /* polices systeme */ }
  const Y = getComputedStyle(document.documentElement).getPropertyValue('--fp').trim() || '#FFD600';
  const T = (size) => `italic 800 ${size}px "Barlow Condensed", Impact, sans-serif`, B = (size, w = 500) => `${w} ${size}px Montserrat, system-ui, sans-serif`;
  x.fillStyle = '#0A0A0A'; x.fillRect(0, 0, 540, 760);
  x.save(); x.fillStyle = Y; x.beginPath(); x.moveTo(380, 760); x.lineTo(540, 560); x.lineTo(540, 640); x.lineTo(460, 760); x.closePath(); x.fill(); x.globalAlpha = .35; x.beginPath(); x.moveTo(300, 760); x.lineTo(540, 460); x.lineTo(540, 520); x.lineTo(350, 760); x.closePath(); x.fill(); x.restore();
  x.fillStyle = Y; x.font = T(30); x.fillText('FIT PULSE', 36, 64);
  x.fillStyle = '#fff'; x.font = T(58); x.fillText(d.u.first.toUpperCase(), 36, 140);
  x.font = B(20); x.fillStyle = '#bbb'; x.fillText(`${d.club ? d.club.name : ''} · ${monthLabel(d.mk)}`, 36, 176);
  x.fillStyle = Y; x.font = T(120); x.fillText(fmtP(d.st.score).replace(' ', ''), 36, 300);
  x.fillStyle = '#fff'; x.font = T(26); x.fillText(`MOIS ${monthTier(d.st.score)} · ${d.top ? 'RANG ' + d.me.rank : d.prog > 0 ? '+' + d.prog + ' PTS' : 'EN PROGRESSION'} · ${plur(d.tr.length, 'TROPHÉE', 'TROPHÉES')}`, 36, 344);
  let y = 400; x.font = B(18);
  d.st.rows.filter(r => r.target > 0).slice(0, 6).forEach(r => {
    x.fillStyle = '#ddd'; x.font = B(18, 600); x.fillText(r.k.label, 36, y);
    x.fillStyle = '#fff'; x.textAlign = 'right'; x.fillText(fmtP(r.pct), 504, y); x.textAlign = 'left';
    x.fillStyle = '#2A2A2E'; x.fillRect(36, y + 10, 468, 6); x.fillStyle = Y; x.fillRect(36, y + 10, 468 * clamp(r.pct || 0, 0, 1), 6);
    y += 46;
  });
  x.fillStyle = '#fff'; x.font = B(17, 600); x.fillText(d.phrase.slice(0, 52), 36, 716);
}
ACTIONS.wrapDownload = () => { const c = $('#wrap-canvas'); c.toBlob(b => downloadFile(`bilan-${UI.wrapData.mk}-${norm(fullName(UI.wrapData.u)).replace(/ /g, '-')}.png`, b), 'image/png'); };
ACTIONS.wrapShare = () => { const c = $('#wrap-canvas'); c.toBlob(async b => { const f = new File([b], `bilan-${UI.wrapData.mk}.png`, { type: 'image/png' }); try { if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Mon bilan Fit Pulse' }); else downloadFile(f.name, b); } catch (e) { /* annule */ } }, 'image/png'); };

ACTIONS.changeMyCode = async () => {
  const cur = $('#cc-cur').value;
  if (ME.codeHash && await hashCode(ME.salt, cur) !== ME.codeHash) { toast('Code actuel incorrect.'); return; }
  if (!ME.email) { toast('Ajoutez d’abord un e-mail à votre profil.'); return; }
  const c = await issueCode(ME);
  const old = ME.bootKey;
  // Mode partage : la nouvelle cle d'abord, on bascule la session dessus, puis
  // on efface l'ancienne (sinon on se couperait soi-meme l'acces).
  await backend.setBoot({ [c.bootKey]: ME.id });
  db.batch([[['users', ME.id, 'salt'], c.salt], [['users', ME.id, 'codeHash'], c.codeHash], [['users', ME.id, 'bootKey'], c.bootKey]]);
  if (backend.mode === 'firebase') {
    try { await backend.codeLogin(ME.email, c.code); if (old && old !== c.bootKey) await backend.setBoot({ [old]: null }); }
    catch (e) { toast('Nouveau code enregistré : reconnectez-vous avec lui.'); }
  }
  showCode(S.users[ME.id], c.code);
};

// ── Presences : conges, maladie, formation (le rythme attendu en tient compte) ──
const ABS = { conge: { l: 'Congé', c: 'C' }, maladie: { l: 'Maladie', c: 'M' }, formation: { l: 'Formation', c: 'F' } };
const ABS_CYCLE = [null, 'conge', 'maladie', 'formation'];
function memPresences() {
  const mk = UI.presMonth || curMonth(); const n = daysIn(mk); const days = Array.from({ length: n }, (_, i) => `${mk}-${pad(i + 1)}`);
  const members = clubMembers(CLUB.id);
  return `<div class="card"><div class="card-head"><h3>Présences · ${monthLabel(mk)}</h3><span class="spacer"></span>${monthNav('presMonth', mk)}</div>
    <p class="muted small">Un clic fait tourner la case : vide, Congé, Maladie, Formation. Les jours fermés du club sont grisés. Le rythme attendu de chacun ne compte que ses jours travaillés.</p>
    <div class="table-wrap"><table class="t pres"><thead><tr><th>Membre</th>${days.map(d => `<th class="${openDaysOf(CLUB.id).includes(dateOf(d).getDay()) ? '' : 'closed'}">${Number(d.slice(8))}</th>`).join('')}<th class="num">Jours travaillés</th></tr></thead><tbody>
    ${members.map(u => `<tr><td class="nowrap">${esc(fullName(u))}</td>${days.map(d => { const a = deepGet(S, ['absences', u.id, d]); const open = openDaysOf(CLUB.id).includes(dateOf(d).getDay()); return `<td class="${open ? '' : 'closed'}">${open ? `<button class="pres-c ${a || ''}" data-act="presCycle" data-u="${u.id}" data-d="${d}" title="${a ? ABS[a].l : 'Présent'}" aria-label="${esc(fullName(u))}, ${dm(d)} : ${a ? ABS[a].l : 'présent'}">${a ? ABS[a].c : ''}</button>` : ''}</td>`; }).join('')}<td class="num"><b>${workdays(u.id, CLUB.id, mk + '-01', `${mk}-${n}`)}</b></td></tr>`).join('')}
    </tbody></table></div></div>`;
}
ACTIONS.presCycle = el => { const p = ['absences', el.dataset.u, el.dataset.d]; const cur = deepGet(S, p) || null; db.set(p, ABS_CYCLE[(ABS_CYCLE.indexOf(cur) + 1) % ABS_CYCLE.length]); };

// ── Journal : saisies pour autrui, corrections, suppressions ──────────────
function memJournal() {
  const f = UI.jrnType || 'all';
  const list = Object.entries(S.audit || {}).map(([id, a]) => ({ id, ...a })).filter(a => a.club === CLUB.id && (f === 'all' || a.action === f)).sort((a, b) => b.at - a.at).slice(0, 300);
  const L = { adjust: 'Correction', delete: 'Suppression', proxy: 'Saisie pour un collègue', export_csv: 'Export', restore: 'Restauration' };
  const who = id => S.users[id] ? esc(fullName(S.users[id])) : 'inconnu';
  const kl = id => S.kpis[id] ? esc(S.kpis[id].label) : esc(id || '');
  return `<div class="card"><div class="card-head"><h3>Journal des corrections</h3><span class="spacer"></span>${seg('jrnType', [['all', 'Tout'], ['adjust', 'Corrections'], ['delete', 'Suppressions'], ['proxy', 'Pour autrui']], f)}</div>
    ${list.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Quand</th><th>Par</th><th>Action</th><th>Détail</th></tr></thead><tbody>${list.map(a => `<tr><td class="nowrap">${dmy(isoOf(new Date(a.at)))} ${new Date(a.at).toTimeString().slice(0, 5)}</td><td>${who(a.by)}</td><td>${L[a.action] || esc(a.action)}</td><td class="small">${
      a.action === 'adjust' ? `${who(a.userId)} · ${kl(a.kpiId)} du ${dm(a.date)} : ${fmtN(a.before)} → ${fmtN(a.after)}` :
      a.action === 'delete' && a.entry ? `${who(a.entry.userId)} · ${kl(a.entry.kpiId)} du ${dm(a.entry.date)} : ${fmtN(a.entry.value)}` :
      a.action === 'proxy' ? `pour ${who(a.userId)} · ${plur(a.count || 1, 'saisie', 'saisies')}` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Aucune correction enregistrée.</p>'}
    <p class="muted small" style="margin-bottom:0">Chaque correction, suppression ou saisie faite pour un collègue laisse une trace ici.</p></div>`;
}
