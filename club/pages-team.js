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
    const body = { org: memOrg, hist: memHistory, tasks: memTasks, targets: memTargets, recaps: memRecaps, archived: memArchived, aliases: memAliases, paliers: memPaliers }[tab]();
    return `<div class="page-head"><div><h1>Membres</h1><p>${esc(CLUB.name)} · ${all.filter(u => u.role === 'manager' && u.status === 'active').length} manager(s), ${all.filter(u => u.role === 'membre' && u.status === 'active').length} membre(s) actif(s), ${all.filter(u => u.status === 'pending').length} invitation(s) en attente</p></div><span class="spacer"></span><button class="btn primary" data-act="addMember">${ico('plus')} Ajouter un membre</button></div>
      ${tabs('memTab', T, tab)}${body}`;
  },
  mount() { if ((UI.memTab || 'org') === 'tasks') bindPlanner(); },
};

// Un createur gere tout le monde ; un manager gere les membres (et lui-meme).
const canEdit = u => isCreator() || u.id === ME.id || u.role === 'membre';
function memberRow(u) {
  return `<div class="row" style="padding:10px 0;border-bottom:1px solid var(--line)">${avatar(u)}<div class="spacer"><b>${esc(fullName(u))}</b>${u.id === ME.id ? ' <span class="muted small">(vous)</span>' : ''}<div class="muted small">${esc(u.email || 'pas d’e-mail')}</div></div>
    ${u.status === 'pending' ? '<span class="badge warn">En attente</span>' : ''}${u.codeHash ? '' : '<span class="badge bad" title="Sans code, cette personne ne peut pas se connecter">sans code</span>'}<span class="badge ${u.role === 'createur' ? 'fp' : u.role === 'manager' ? 'ok' : ''}">${roleLabel(u.role)}</span>
    ${canEdit(u) ? `<button class="btn ghost icon sm" data-act="editMember" data-id="${u.id}" title="Modifier">${ico('edit')}</button>` : '<span style="width:30px"></span>'}</div>`;
}
function memOrg() {
  const all = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'archived');
  const creators = Object.values(S.users).filter(u => u.role === 'createur' && u.status !== 'archived');
  return `<div class="card"><div class="card-head">${ico('building')}<h3>${esc(CLUB.name)}</h3></div>
    <h3 class="muted" style="font-size:13px;margin:8px 0 2px">Créateur</h3>${creators.map(memberRow).join('') || '<p class="muted">Aucun.</p>'}
    <h3 class="muted" style="font-size:13px;margin:8px 0 2px">Managers</h3>${all.filter(u => u.role === 'manager').map(memberRow).join('') || '<p class="muted">Aucun.</p>'}
    <h3 class="muted" style="font-size:13px;margin:18px 0 2px">Membres</h3>${all.filter(u => u.role !== 'manager').map(memberRow).join('') || '<p class="muted">Aucun membre. Ajoutez votre équipe.</p>'}
    <p class="muted small" style="margin-bottom:0">Une invitation en attente ne compte dans aucun total tant que la personne ne s’est pas connectée.</p></div>
  <div class="card" style="margin-top:14px"><h3>Accès et rôles</h3>
    <div class="table-wrap" style="margin-top:10px"><table class="t"><thead><tr><th>Ce que l’on peut faire</th><th>Créateur</th><th>Manager</th><th>Membre</th></tr></thead><tbody>
    ${[['Saisir ses KPI, voir son tableau de bord, le classement, le feed, le chat', 1, 1, 1], ['Traiter les relances (Action Rétention) et les résiliations', 1, 1, 1],
       ['Vue club, saisir pour un membre, fixer les objectifs', 1, 1, 0], ['Imports CSV, planning des tâches, défis flash', 1, 1, 0], ['Ajouter un membre et lui générer un code', 1, 1, 0],
       ['Nommer un manager ou un créateur, modifier un manager', 1, 0, 0], ['Créer un club, régler les KPI et les points', 1, 0, 0], ['Sauvegarde, restauration, tout effacer', 1, 0, 0], ['Classé et soumis à objectifs', 0, 1, 1]]
      .map(([l, ...v]) => `<tr><td>${l}</td>${v.map(x => `<td>${x ? '<b class="ok">✓</b>' : '<span class="muted">—</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
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
    <div class="field"><span>Club(s)</span>${clubs.map(c => `<label class="row small"><input type="checkbox" name="club_${c.id}" ${(u ? (u.clubs || []).includes(c.id) : c.id === CLUB.id) ? 'checked' : ''}> ${esc(c.name)}</label>`).join('')}</div></div>
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
    subject: `Ton accès Fit Pulse · ${club}`,
    body: `Salut ${u.first || ''} 👋

Bienvenue dans Fit Pulse, l’appli de l’équipe ${club} : tes objectifs, les paliers, le classement et tes relances, dans ta poche.

TON ACCÈS
• Lien : ${url}
• E-mail : ${u.email}
• Code personnel : ${normCode(code)}

INSTALLER L’APPLI SUR TON TÉLÉPHONE
• iPhone (Safari) : ouvre le lien, bouton Partager ⬆︎ puis « Sur l’écran d’accueil ».
• Android / Samsung : ouvre le lien dans Chrome ou Samsung Internet, menu ⋮ puis « Ajouter à l’écran d’accueil ».

Ton code est personnel : ne le partage pas.
À tout de suite sur le terrain 💪
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
      <p class="muted small">Montants TTC. Cliquez sur un membre pour éditer ses saisies jour par jour.</p>
      <div class="table-wrap"><table class="t"><thead><tr><th>Membre</th>${kpis.map(k => `<th class="num">${esc(k.label)}<br><span class="muted">${k.unit === 'eur' ? '€' : 'Qté'}</span></th>`).join('')}</tr></thead><tbody>
      ${rows.map(u => `<tr><td><a href="javascript:void 0" data-act="histUser" data-id="${u.id}"><b>${esc(fullName(u))}</b></a></td>${kpis.map(k => { const v = sumRange(CLUB.id, u.id, k.id, r.from, r.to); tot[k.id] = (tot[k.id] || 0) + v; return `<td class="num">${v ? fmtV(v, k.unit) : '<span class="muted">0</span>'}</td>`; }).join('')}</tr>`).join('')}
      <tr class="total"><td>Total</td>${kpis.map(k => { const t = clubMonthTarget(mk, CLUB.id, k.id); return `<td class="num">${fmtV(tot[k.id] || 0, k.unit)}${t ? `<br><span class="muted small">/ ${fmtV(t, k.unit)} · ${fmtP((tot[k.id] || 0) / t)}</span>` : ''}</td>`; }).join('')}</tr></tbody></table></div>`;
  }
  const uid = UI.histUser && S.users[UI.histUser] ? UI.histUser : (members[0] && members[0].id);
  if (!uid) return '<div class="card empty">Aucun membre actif.</div>';
  const n = daysIn(mk);
  let html = `<div class="row wrap" style="margin-bottom:12px">${seg('histMode', [['month', 'Mois'], ['day', 'Jour par jour']], mode)}${monthNav('histMonth', mk)}
    <select class="input sm" style="width:auto" data-change="histUserSel">${members.map(u => `<option value="${u.id}" ${u.id === uid ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></div>
    <p class="muted small">Cliquez sur une case pour corriger le total du jour : la sauvegarde est automatique. Les saisies importées restent visibles dans Imports.</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Jour</th>${kpis.map(k => `<th class="num">${esc(k.label)}</th>`).join('')}</tr></thead><tbody>`;
  for (let d = 1; d <= n; d++) {
    const date = `${mk}-${pad(d)}`;
    const future = date > today();
    html += `<tr><td class="nowrap">${JOURS[dateOf(date).getDay()].slice(0, 3)} ${d}</td>${kpis.map(k => { const v = sumRange(CLUB.id, uid, k.id, date, date); return `<td class="num"><input class="cell" type="number" min="0" step="${k.unit === 'eur' ? '0.01' : '1'}" value="${v ? Math.round(v * 100) / 100 : ''}" placeholder="0" data-change="histCell" data-u="${uid}" data-k="${k.id}" data-d="${date}" ${future ? 'disabled' : ''}></td>`; }).join('')}</tr>`;
  }
  return html + '</tbody></table></div>';
}
ACTIONS.histQ = el => { UI.histQ = el.value; render(); };
ACTIONS.histUser = el => { UI.histUser = el.dataset.id; UI.histMode = 'day'; render(); };
ACTIONS.histUserSel = el => { UI.histUser = el.value; render(); };
// Corriger le total d'un jour : on ajoute une saisie d'ajustement (manuelle)
// egale a l'ecart, sans toucher aux saisies importees.
ACTIONS.histCell = el => {
  const { u, k, d } = el.dataset;
  const want = parseFloat(String(el.value).replace(',', '.')) || 0;
  const manual = Object.values(S.entries).filter(e => e.userId === u && e.kpiId === k && e.date === d && e.clubId === CLUB.id && !e.importId);
  const imported = sumRange(CLUB.id, u, k, d, d) - manual.reduce((s, e) => s + Number(e.value), 0);
  const need = Math.round((want - imported) * 100) / 100;
  const ops = manual.map(e => [['entries', e.id], null]);
  if (need !== 0) { const id = newId(); ops.push([['entries', id], { id, userId: u, clubId: CLUB.id, kpiId: k, date: d, value: need, source: 'manual', at: Date.now(), by: ME.id, adjust: true }]); }
  db.batch(ops); toast('Enregistré');
};

// Objectifs du mois : tableau editable, total = membres actifs uniquement.
function memTargets() {
  const mk = UI.tgMonth || curMonth();
  const members = clubMembers(CLUB.id, { all: true }).filter(u => u.status !== 'archived');
  const kpis = kpiList();
  const locked = mk < curMonth();
  return `<div class="row wrap" style="margin-bottom:12px">${monthNav('tgMonth', mk)}<span class="spacer"></span>
    <button class="btn sm" data-act="copyTargets" data-mk="${mk}">${ico('history')} Reprendre les objectifs de ${monthLabel(addMonths(mk, -1))}</button></div>
    ${locked ? '<div class="alert" style="margin-bottom:12px">Mois terminé : les objectifs restent modifiables, mais cela change les scores et trophées déjà calculés.</div>' : ''}
    <div class="table-wrap"><table class="t"><thead><tr><th>Membre</th>${kpis.map(k => `<th class="num" title="${k.required ? 'KPI obligatoire' : ''}">${k.required ? '👑 ' : ''}${esc(k.label)}<br><span class="muted">${k.unit === 'eur' ? '€' : 'Qté'} · ${fmtN(k.points)} pts</span></th>`).join('')}</tr></thead><tbody>
    ${members.map(u => `<tr><td class="nowrap"><b>${esc(fullName(u))}</b>${u.status === 'pending' ? ' <span class="badge warn">en attente</span>' : ''}</td>${kpis.map(k => `<td class="num"><input class="cell" type="number" min="0" value="${monthTarget(mk, u.id, k.id) || ''}" placeholder="0" data-change="tgCell" data-mk="${mk}" data-u="${u.id}" data-k="${k.id}"></td>`).join('')}</tr>`).join('')}
    <tr class="total"><td>Total club (actifs)</td>${kpis.map(k => `<td class="num">${fmtV(clubMonthTarget(mk, CLUB.id, k.id), k.unit)}</td>`).join('')}</tr></tbody></table></div>
    <p class="muted small">👑 = KPI obligatoire du classement global. Points et KPI se règlent dans Mes clubs > Réglages. Une invitation en attente peut recevoir un objectif, il ne compte qu’une fois la personne active.</p>`;
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
const tierName = s => s == null ? '—' : s >= 1 ? 'ELITE' : s >= 0.75 ? 'PRO' : s >= 0.5 ? 'RISING' : 'STARTER';
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
    <div class="table-wrap"><table class="t"><thead><tr><th class="sortable" data-act="ui" data-key="recSort" data-val="name">Membre</th><th class="num">Score</th><th>Palier</th><th class="num sortable" data-act="ui" data-key="recSort" data-val="rank">Rang</th><th class="num">KPI atteints</th><th>Top KPI</th><th class="num sortable" data-act="ui" data-key="recSort" data-val="badges">Trophées</th><th></th></tr></thead><tbody>
    ${rows.map(x => `<tr><td><b>${esc(fullName(x.u))}</b></td><td class="num">${fmtP(x.score)}</td><td><span class="badge ${x.score >= 1 ? 'fp' : x.score >= .75 ? 'ok' : x.score >= .5 ? 'info' : ''}">${tierName(x.score)}</span></td><td class="num">${x.rank}</td><td class="num">${x.reached}/${x.count}</td><td>${x.best ? `${esc(x.best.k.label)} ${fmtP(x.best.pct)}` : '—'}</td><td class="num">${x.tr}</td><td><a class="btn sm" href="#/wrap/${mk}/${x.u.id}">Voir le bilan</a></td></tr>`).join('')}
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
    hours += `<div class="hour"><div class="h">${pad(h)}:00</div><div class="slot" data-hour="${h}">${(byHour[h] || []).map(p => { const t = S.tasks.library[p.taskId]; return t ? `<span class="chip ${done[p.id] ? 'done' : ''}" draggable="true" data-plan="${p.id}" title="${done[p.id] ? `Validée par ${done[p.id]} personne(s) aujourd’hui` : ''}">${esc(t.label)}<button data-act="unplan" data-id="${p.id}" aria-label="Retirer">✕</button></span>` : ''; }).join('')}<button class="btn ghost sm" data-act="planAt" data-hour="${h}" title="Ajouter une tâche">${ico('plus')}</button></div></div>`;
  }
  const doneToday = Object.entries(S.tasks.done[today()] || {});
  return `<div class="planner"><div class="card"><div class="card-head"><h3>Planning type de la journée</h3><span class="spacer"></span><button class="btn sm" data-act="resetPlan">Réinitialiser au modèle par défaut</button></div>
      <p class="muted small" style="margin-top:-6px">Glissez une tâche de la bibliothèque vers une heure (ou bouton +). L’équipe coche ses tâches dans le panneau Saisies du tableau de bord.</p>${hours}</div>
    <div class="grid"><div class="card"><div class="card-head"><h3>Tâches disponibles</h3><span class="spacer"></span><button class="btn sm" data-act="newTask">${ico('plus')}</button></div>
      <div class="lib">${cats.map(c => `<div class="muted small" style="margin-top:6px;font-weight:700">${esc(c)}</div>${lib.filter(t => t.cat === c).map(t => `<span class="chip" draggable="true" data-lib="${t.id}">${esc(t.label)}</span>`).join('')}`).join('')}</div></div>
      <div class="card"><h3>Validations du jour</h3>${doneToday.length ? doneToday.map(([uid, m]) => `<div class="small" style="margin-top:8px"><b>${esc(fullName(S.users[uid]))}</b> : ${Object.keys(m).length} tâche(s)</div>`).join('') : '<p class="muted small">Aucune validation aujourd’hui.</p>'}</div></div></div>`;
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
  openModal({ title: `Ajouter une tâche à ${pad(h)}:00`, body: `<select class="input" id="pt">${lib.map(t => `<option value="${t.id}">${esc(t.cat)} — ${esc(t.label)}</option>`).join('')}</select>`,
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
    const head = `<div class="card" style="margin-bottom:14px"><div class="row wrap" style="gap:16px">${avatar(ME, 'lg')}<div class="spacer"><h1 style="font-size:26px">${esc(fullName(ME))}</h1>
      <div class="row wrap small" style="margin-top:4px"><span class="badge fp">${lv.label}</span><span class="muted">${esc(ME.email || '')}</span><span class="badge">${roleLabel(ME.role)}</span>${(ME.clubs || []).map(c => S.clubs[c] ? `<span class="badge">${esc(S.clubs[c].name)}</span>` : '').join('')}</div></div>
      <div style="text-align:right"><div class="title" style="font-size:30px">${fmtN(pts)} pts</div><div class="muted small">${lv.next ? `${fmtN(lv.next.min - pts)} pts avant ${lv.next.label}` : 'Niveau maximum'}</div></div></div>
      <div class="levels">${LEVELS.map(l => `<div class="${pts >= l.min ? 'got' : ''}">${l.label}<br><span class="muted">${fmtN(l.min)}</span></div>`).join('')}</div></div>`;
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
      <div class="trophy"><div class="ic">📅</div><b>Régularité : ${acc.streak} jour(s) de suite</b><span class="muted small">${acc.streak >= 3 ? 'Série en cours, continuez !' : 'Prochain palier : trois jours de suite'}</span></div>
      <div class="trophy"><div class="ic">${acc.first100 ? '💯' : '🔒'}</div><b>Premier 100 %</b><span class="muted small">${acc.first100 ? 'Obtenu' : 'Un KPI à 100 % sur un mois'}</span></div>
      <div class="trophy"><div class="ic">${acc.all100 ? '🏅' : '🔒'}</div><b>Grand chelem</b><span class="muted small">${acc.all100 ? 'Obtenu' : 'Tous les KPI à 100 % sur un mois'}</span></div></div></div>
    <div class="card"><h3>Mes trophées (${tr.length})</h3><p class="muted small">Le même décompte que le classement.</p>
      ${groups.map(([k, l]) => { const g = tr.filter(t => t.kind === k); return `<div class="muted small" style="font-weight:700;margin:12px 0 6px">${l} · ${g.length}</div>${g.length ? `<div class="trophies">${g.slice().reverse().map(t => `<div class="trophy"><div class="ic">${trophyIcon(t)}</div><b>${esc(t.label)}</b></div>`).join('')}</div>` : '<p class="muted small">Aucun pour l’instant.</p>'}`; }).join('')}</div>
    <div class="card"><h3>Mes bilans mensuels</h3>${months.length ? (showAll ? months : months.slice(0, 3)).map((m, i) => `<a class="row" style="padding:10px 0;border-bottom:1px solid var(--line);text-decoration:none" href="#/wrap/${m}/${ME.id}">${ico('chart')}<b class="spacer">${monthLabel(m)}</b>${i === 0 ? '<span class="badge fp">Dernier bilan — replay</span>' : ''}${ico('chevR')}</a>`).join('') : '<p class="muted">Votre premier bilan apparaîtra à la fin du mois.</p>'}
      ${months.length > 3 && !showAll ? `<button class="btn sm" style="margin-top:10px" data-act="ui" data-key="profWraps" data-val="all">Voir ${months.length - 3} mois de plus</button>` : ''}</div></div>`;
}
function profAccount() {
  const live = pref('liveBanner', true); const digest = pref('digest', true);
  return `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(320px, 100%), 1fr))">
    <div class="card"><h3>Mes informations</h3><form id="pf" class="grid" style="margin-top:10px"><div class="form-grid"><label class="field"><span>Prénom</span><input class="input" name="first" value="${esc(ME.first)}"></label><label class="field"><span>Nom</span><input class="input" name="last" value="${esc(ME.last)}"></label></div>
      <p class="muted small" style="margin:0">Rôle : ${roleLabel(ME.role)} · membre depuis le ${dmy(isoOf(new Date(ME.createdAt || Date.now())))}</p><button class="btn primary" data-act="saveProfile" type="button">Enregistrer</button></form></div>
    <div class="card"><h3>Avatar du tableau de bord</h3><div class="row wrap" style="margin-top:10px">${['h1', 'h2', 'f1', 'f2'].map((a, i) => `<button class="btn ${ME.avatar === a ? 'primary' : ''}" style="flex-direction:column;padding:8px" data-act="setAvatar" data-a="${a}">${mascot(a, 'happy', 54)}<span class="small">${['Homme 1', 'Homme 2', 'Femme 1', 'Femme 2'][i]}</span></button>`).join('')}</div></div>
    <div class="card"><h3>Notifications</h3>
      <label class="row" style="margin-top:12px"><input type="checkbox" data-change="prefToggle" data-k="liveBanner" ${live ? 'checked' : ''}> <span>Bandeau en direct quand un collègue saisit</span></label>
      <label class="row" style="margin-top:10px"><input type="checkbox" data-change="prefToggle" data-k="digest" ${digest ? 'checked' : ''}> <span>Bilan hebdomadaire du club (lundi matin)</span></label>
      <p class="muted small">Le bandeau ne montre que les saisies de nos clubs.</p></div>
    <div class="card"><h3>Sécurité</h3>${`<p class="small">Connexion par e-mail et code d’accès personnel.</p><form id="cc" class="grid"><label class="field"><span>Code actuel</span><input class="input" name="cur" id="cc-cur" placeholder="FP-XXXX-XXXX-XXXX" autocomplete="current-password"></label><button class="btn" type="button" data-act="changeMyCode">${ico('shield')} Générer un nouveau code</button></form><p class="muted small">${backend.mode === 'firebase' ? 'Votre code ouvre la base de l’équipe depuis n’importe quel appareil. Le nouveau code remplace l’ancien partout.' : 'En mode local, les données restent dans ce navigateur : le code protège l’accès à l’écran.'}</p>`}</div></div>`;
}
ACTIONS.saveProfile = () => { const f = formData($('#pf')); if (!f.first.trim()) return; db.batch([[['users', ME.id, 'first'], f.first.trim()], [['users', ME.id, 'last'], f.last.trim()]]); toast('Profil enregistré.'); };
ACTIONS.setAvatar = el => db.set(['users', ME.id, 'avatar'], el.dataset.a);
ACTIONS.prefToggle = el => setPref(el.dataset.k, el.checked);

// ── Bilan mensuel (format stories) ────────────────────────────────────────
PAGES.wrap = {
  render(args) {
    const [mk, uid0] = args; const uid = uid0 && S.users[uid0] ? uid0 : ME.id;
    if (!/^\d{4}-\d{2}$/.test(mk || '')) return '<div class="auth"><div class="auth-card">Bilan introuvable. <a href="#/profile">Retour</a></div></div>';
    if (uid !== ME.id && !isManager()) return '<div class="auth"><div class="auth-card">Ce bilan est personnel. <a href="#/profile">Retour</a></div></div>';
    const u = S.users[uid]; const clubId = (u.clubs || []).includes(CLUB.id) ? CLUB.id : u.clubs[0];
    const r = rangeOf('month', mk); const st = statsFor(clubId, uid, r);
    const rk = ranking(clubId, r); const me = rk.find(x => x.u.id === uid);
    const best = st.rows.filter(x => x.pct != null).sort((a, b) => b.pct - a.pct)[0];
    const tr = trophies(uid).filter(t => t.mk === mk);
    const club = S.clubs[clubId];
    const phrase = st.score == null ? 'Pas d’objectif ce mois-là.' : st.score >= 1 ? 'Mois exceptionnel. Tu as tout donné.' : st.score >= .75 ? 'Très beau mois, l’élite n’est pas loin.' : st.score >= .5 ? 'À mi-chemin : le mois prochain sera le bon.' : 'Mois difficile. On repart plus fort.';
    const slides = [
      `<div class="title" style="font-size:22px;color:var(--fp)">FIT PULSE</div><div class="avatar lg" style="margin:0 auto">${esc(initials(u))}</div><h1 style="font-size:40px">${esc(u.first)}</h1><div style="font-size:18px">Ton mois de ${monthLabel(mk)}</div><div class="muted small" style="margin-top:30px">Touche pour continuer</div>`,
      `<div style="font-size:18px">Ton score global</div><div class="huge" id="wrap-count">0 %</div><div class="muted small">Moyenne de tes KPI pondérée par leurs points</div>`,
      best ? `<div style="font-size:18px">Ton meilleur KPI</div><div class="wrap-ico">${kpiIcon(best.k, 'ico ico-xl')}</div><h1 style="font-size:36px">${esc(best.k.label)}</h1><div class="huge" style="font-size:56px">${fmtP(best.pct)}</div><div>${fmtV(best.real, best.k.unit)} / ${fmtV(best.target, best.k.unit)}</div>` : '<div>Aucun KPI ce mois-là.</div>',
      `<div style="font-size:18px;margin-bottom:10px">Tes KPI ce mois</div>${st.rows.filter(x => x.target > 0).map(x => `<div style="text-align:left;margin:6px 0"><div class="row small"><b>${esc(x.k.label)}</b><span class="spacer"></span>${fmtV(x.real, x.k.unit)} / ${fmtV(x.target, x.k.unit)}</div>${progressBar(x.pct, { ticks: false })}</div>`).join('')}`,
      `<div style="font-size:18px">Ton classement</div><div class="huge">#${me ? me.rank : '—'}</div><div class="title" style="font-size:20px">${esc(club ? club.name : '')}</div><div class="muted">${rk.length} membres classés</div>`,
      `<div style="font-size:18px">Tes trophées</div><div class="huge">${tr.length}</div><div class="wrap-trophies">${tr.map(t => trophyIcon(t)).join('')}</div><div class="small">${tr.map(t => esc(t.label)).join('<br>')}</div>`,
      `<div style="font-size:18px">Ton résumé</div><canvas id="wrap-canvas" width="540" height="760" style="width:100%;max-width:300px;margin:0 auto;border-radius:14px"></canvas><div class="row" style="justify-content:center"><button class="btn primary" data-act="wrapDownload">${ico('download')} Télécharger</button></div><div class="muted small">Chiffres internes au club : à garder pour soi ou l’équipe.</div>`,
    ];
    UI.wrapData = { u, mk, st, me, tr, club, phrase, slides: slides.length };
    return `<div class="wrap-stage"><div class="wrap-card"><div class="wrap-bars">${slides.map(() => '<i><b></b></i>').join('')}</div>
      <button class="wrap-close" data-act="wrapClose" aria-label="Fermer">✕</button>
      <div class="wrap-tap l" data-act="wrapPrev"></div><div class="wrap-tap r" data-act="wrapNext"></div>
      ${slides.map((s, i) => `<div class="wrap-slide ${i ? 'hidden' : ''}" data-slide="${i}">${s}</div>`).join('')}</div></div>`;
  },
  mount() { UI.wrapIdx = 0; wrapShow(0); },
};
let wrapTimer = null;
function wrapShow(i) {
  const n = UI.wrapData.slides; i = clamp(i, 0, n - 1); UI.wrapIdx = i;
  $$('.wrap-slide').forEach(s => s.classList.toggle('hidden', Number(s.dataset.slide) !== i));
  $$('.wrap-bars i').forEach((b, j) => { b.className = j < i ? 'done' : j === i ? 'cur' : ''; const x = $('b', b); x.style.animation = 'none'; void x.offsetWidth; x.style.animation = ''; });
  clearTimeout(wrapTimer);
  if (i === 1) { const target = Math.round((UI.wrapData.st.score || 0) * 100); let v = 0; const el = $('#wrap-count'); const t = setInterval(() => { v = Math.min(target, v + Math.max(1, Math.round(target / 40))); if (el) el.textContent = v + ' %'; if (v >= target) clearInterval(t); }, 30); }
  if (i === n - 1) { drawWrapCard(); return; }
  wrapTimer = setTimeout(() => wrapShow(i + 1), 6000);
}
ACTIONS.wrapNext = () => wrapShow(UI.wrapIdx + 1);
ACTIONS.wrapPrev = () => wrapShow(UI.wrapIdx - 1);
ACTIONS.wrapClose = () => { clearTimeout(wrapTimer); history.length > 1 ? history.back() : (location.hash = '#/profile'); };
function drawWrapCard() {
  const c = $('#wrap-canvas'); if (!c) return; const x = c.getContext('2d'); const d = UI.wrapData;
  x.fillStyle = '#111113'; x.fillRect(0, 0, 540, 760);
  const g = x.createRadialGradient(470, 0, 10, 470, 0, 380); g.addColorStop(0, 'rgba(255,210,0,.35)'); g.addColorStop(1, 'rgba(255,210,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 540, 760);
  x.fillStyle = '#FFD200'; x.font = '30px Anton, Impact'; x.fillText('FIT PULSE', 36, 64);
  x.fillStyle = '#fff'; x.font = '52px Anton, Impact'; x.fillText(d.u.first.toUpperCase(), 36, 140);
  x.font = '22px Inter, sans-serif'; x.fillStyle = '#bbb'; x.fillText(`${d.club ? d.club.name : ''} · ${monthLabel(d.mk)}`, 36, 176);
  x.fillStyle = '#FFD200'; x.font = '110px Anton, Impact'; x.fillText(fmtP(d.st.score).replace(' ', ''), 36, 300);
  x.fillStyle = '#fff'; x.font = '24px Anton, Impact'; x.fillText(`${tierName(d.st.score)} · #${d.me ? d.me.rank : '—'} · ${d.tr.length} TROPHÉE(S)`, 36, 344);
  let y = 400; x.font = '20px Inter, sans-serif';
  d.st.rows.filter(r => r.target > 0).slice(0, 7).forEach(r => {
    x.fillStyle = '#ddd'; x.fillText(r.k.label, 36, y);
    const gap = r.real - r.target; x.fillStyle = gap >= 0 ? '#5BD38C' : '#ff8a7a'; x.textAlign = 'right'; x.fillText(`${fmtP(r.pct)}  (${gap >= 0 ? '+' : ''}${fmtV(gap, r.k.unit)})`, 504, y); x.textAlign = 'left';
    x.fillStyle = '#2a2a2e'; x.fillRect(36, y + 10, 468, 6); x.fillStyle = '#FFD200'; x.fillRect(36, y + 10, 468 * clamp(r.pct, 0, 1), 6);
    y += 46;
  });
  x.fillStyle = '#fff'; x.font = 'italic 22px Inter, sans-serif'; x.fillText(d.phrase, 36, 724);
}
ACTIONS.wrapDownload = () => { const c = $('#wrap-canvas'); c.toBlob(b => downloadFile(`bilan-${UI.wrapData.mk}-${norm(fullName(UI.wrapData.u)).replace(/ /g, '-')}.png`, b), 'image/png'); };

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
