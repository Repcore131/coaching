'use strict';
// ══ FIT PULSE — revenus : entonnoir, invités, opportunités classées en euros ══
// S'appuie sur le socle valeur (value.js : mensualite, prixMoyen, dureeVieMois,
// valeurEnJeu). Tout est calculé à la volée et mis en cache par révision (memo).

const dayDiff = (a, b) => Math.round((dateOf(b) - dateOf(a)) / 86400000);
const ageDays = d => (d ? dayDiff(d, today()) : null);
const fmtTaux = v => (v == null ? 'n.d.' : fmtP(v));

// Index de rapprochement des clients d'un club : nom (jetons triés) et téléphone.
function clientIndex(clubId) {
  return memo(`cidx|${clubId}`, () => {
    const byName = {}, byPhone = {}, byNum = {};
    clubClients(clubId).forEach(c => { const t = tokensKey(c.name || ''); if (t) (byName[t] = byName[t] || []).push(c); const p = phoneE164(c.phone); if (p) (byPhone[p] = byPhone[p] || []).push(c); if (c.num) byNum[String(c.num)] = c; });
    return { byName, byPhone, byNum };
  });
}
// Premier client du club qui correspond (nom ou téléphone) et a démarré dans la fenêtre [from, from + jours].
function matchClient(clubId, name, phone, from, jours) {
  const I = clientIndex(clubId); const to = addDays(from, jours);
  const cands = [...(I.byName[tokensKey(name || '')] || []), ...(I.byPhone[phoneE164(phone)] || [])];
  return cands.filter(c => c.start && c.start >= from && c.start <= to).sort((a, b) => a.start.localeCompare(b.start))[0] || null;
}

// ── Prospects et entonnoir par cohorte ────────────────────────────────────
const prospectsOf = clubId => Object.values(S.prospects || {}).filter(p => p && p.clubId === clubId);
const pName = p => `${p.prenom || ''} ${p.nom || ''}`.trim();
function prospectConv(p) {
  return memo(`pconv|${p.id}`, () => { const c = matchClient(p.clubId, pName(p), p.phone, p.creeLe, 60); return c ? { client: c, delai: dayDiff(p.creeLe, c.start) } : null; });
}
const touchesOfProspect = id => Object.values(S.touches || {}).filter(t => t.prospectId === id);
function prospectStage(p) {
  const st = norm(p.statut || ''); const conv = prospectConv(p);
  const guest = Object.values(S.guests || {}).some(g => g.clubId === p.clubId && tokensKey(g.nom || '') === tokensKey(pName(p)));
  const visite = !!conv || guest || /visite|essai|honor/.test(st);
  const contacte = visite || /contact|rdv|visite|essai/.test(st) || touchesOfProspect(p.id).length > 0;
  return { contacte, visite, contrat: !!conv, conv };
}
// Cohorte : prospects créés dans le mois mk. En cours tant que mk + 60 jours n'est pas passé.
function funnel(clubId, mk, userId = null) {
  return memo(`fun|${clubId}|${mk}|${userId}`, () => {
    const r = rangeOf('month', mk); const L = prospectsOf(clubId).filter(p => p.creeLe >= r.from && p.creeLe <= r.to && (!userId || p.commercialId === userId));
    const rows = L.map(p => ({ p, ...prospectStage(p) }));
    const n = k => rows.filter(x => x[k]).length;
    const conv = rows.filter(x => x.contrat);
    return { rows, crees: rows.length, contactes: n('contacte'), visites: n('visite'), contrats: conv.length, taux: rows.length ? conv.length / rows.length : null, enCours: addDays(r.to, 60) > today(),
      delai: median(conv.map(x => x.conv.delai).map(d => d || 0.5)), euros: Math.round(conv.reduce((s, x) => s + mensualite(x.conv.client) * 12, 0)) };
  });
}
// Taux de transformation de référence : 3 derniers mois de cohortes, club ou commercial.
function tauxCohorte(clubId, userId = null) {
  return memo(`tcoh|${clubId}|${userId}`, () => {
    let c = 0, n = 0; for (let i = 1; i <= 3; i++) { const f = funnel(clubId, addMonths(curMonth(), -i), userId); c += f.contrats; n += f.crees; }
    return n >= 5 ? c / n : null;
  });
}
const STAGES = [['crees', 'Créés'], ['contactes', 'Contactés'], ['visites', 'Visite ou essai'], ['contrats', 'Contrat']];
function fuitePhrase(f, fc, who) {
  let worst = null;
  for (let i = 1; i < STAGES.length; i++) { const a = f[STAGES[i - 1][0]], b = f[STAGES[i][0]]; if (a >= 3) { const loss = 1 - b / a; if (!worst || loss > worst.loss) worst = { i, loss }; } }
  if (!worst) return '';
  const a = fc[STAGES[worst.i - 1][0]], b = fc[STAGES[worst.i][0]]; const lc = a ? 1 - b / a : null;
  return `Le passage ${STAGES[worst.i - 1][1].toLowerCase()} vers ${STAGES[worst.i][1].toLowerCase()} perd ${fmtP(worst.loss)} des prospects${who ? ' de ' + esc(who) : ''}${lc != null && who ? `, contre ${fmtP(lc)} pour le club` : ''}.`;
}
function funnelView(mk, userId) {
  const clubId = CLUB.id;
  if (!prospectsOf(clubId).length) return `<div class="card">${emptyBox({ art: 'target', title: 'Entonnoir vide', text: 'Déposez l’export Prospects de Resamania (Clients > Prospects > Exporter) dans Imports > Resamania : chaque prospect sera suivi jusqu’au contrat.', cta: isManager() ? '<a class="btn primary sm" href="#/imports">Ouvrir les imports</a>' : '' })}</div>`;
  const f = funnel(clubId, mk, userId), fc = funnel(clubId, mk, null); const who = userId ? (S.users[userId] || {}).first : '';
  const max = Math.max(1, f.crees);
  const bars = STAGES.map(([k, l], i) => `<div class="fn-row"><span>${l}</span><div class="fn-bar"><i style="width:${Math.round(f[k] / max * 100)}%"></i></div><b>${fmtN(f[k])}</b><small>${i ? fmtTaux(f[STAGES[i - 1][0]] ? f[k] / f[STAGES[i - 1][0]] : null) : ''}</small></div>`).join('');
  const members = perimeterMembers(clubId, rangeOf('month', mk).from, rangeOf('month', mk).to);
  const byUser = members.map(u => ({ u, f: funnel(clubId, mk, u.id) })).filter(x => x.f.crees);
  const flag = deepGet(S, ['rsm', 'flags', clubId, 'prospects']) || {};
  const prov = {}; f.rows.forEach(x => { const k = x.p.provenance || ''; const o = prov[k] = prov[k] || { n: 0, c: 0, d: [], e: 0 }; o.n++; if (x.contrat) { o.c++; o.d.push(x.conv.delai); o.e += mensualite(x.conv.client) * 12; } });
  const hot = prospectsOf(clubId).filter(p => (!userId || p.commercialId === userId) && ageDays(p.creeLe) >= 2 && ageDays(p.creeLe) <= 21 && !prospectConv(p)).sort((a, b) => (Number(b.valeur) || 0) - (Number(a.valeur) || 0) || b.creeLe.localeCompare(a.creeLe));
  return `<div class="g12">
    <div class="card col7"><div class="card-head"><h3>Cohorte de ${monthLabel(mk).toLowerCase()}</h3><span class="spacer"></span>${f.enCours ? '<span class="tag is-info">en cours</span>' : ''}</div>
      ${bars}<p class="small" style="margin:10px 0 0">Transformation à 60 jours : <b>${fmtTaux(f.taux)}</b>${f.delai != null ? ` · délai médian ${plur(Math.round(f.delai), 'jour', 'jours')}` : ''} · signés : <b>${fmtE(f.euros)}</b> sur 12 mois</p>
      ${fuitePhrase(f, fc, who) ? `<p class="alert" style="margin-top:10px">${ico('alert')}<span>${fuitePhrase(f, fc, who)}</span></p>` : ''}</div>
    <div class="card col5"><div class="card-head"><h3>Prospects chauds non convertis</h3><span class="spacer"></span><button class="btn sm" data-act="guestNew">${ico('plus')} Invité</button></div>
      ${hot.slice(0, 8).map(p => `<div class="row opp-mini"><div class="spacer"><b>${esc(pName(p))}</b><div class="muted small">créé le ${dm(p.creeLe)}${p.statut ? ' · ' + esc(p.statut) : ''}${p.commercialId && S.users[p.commercialId] ? ' · ' + esc(S.users[p.commercialId].first) : ''}</div></div>${p.phone ? `<a class="btn sm" href="tel:${esc(p.phone)}">${ico('phone')}</a>` : ''}<button class="btn sm ghost" data-act="prospectNote" data-id="${p.id}">Noter</button></div>`).join('') || '<p class="muted small">Aucun prospect chaud en attente.</p>'}</div>
    ${isManager() && !userId ? `<div class="card col7"><h3>Par commercial</h3><div class="table-wrap"><table class="t"><thead><tr><th>Commercial</th><th class="num">Créés</th><th class="num">Convertis</th><th class="num">Taux</th><th class="num">Délai médian</th><th class="num">Signés (12 mois)</th></tr></thead><tbody>
      ${byUser.map(x => `<tr><td>${esc(fullName(x.u))}</td><td class="num">${x.f.crees}</td><td class="num">${x.f.contrats}</td><td class="num">${fmtTaux(x.f.taux)}</td><td class="num">${x.f.delai == null ? 'n.d.' : plur(Math.round(x.f.delai), 'j', 'j')}</td><td class="num">${fmtE(x.f.euros)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Aucun prospect attribué.</td></tr>'}</tbody></table></div></div>` : ''}
    <div class="card ${isManager() && !userId ? 'col5' : 'col12'}"><h3>Par provenance</h3>${flag.sansProvenance && !Object.keys(prov).some(Boolean) ? '<p class="muted small">Provenance non renseignée dans l’export.</p>' : `<div class="table-wrap"><table class="t"><thead><tr><th>Provenance</th><th class="num">Créés</th><th class="num">Convertis</th><th class="num">Taux</th><th class="num">Signés</th></tr></thead><tbody>
      ${Object.entries(prov).sort((a, b) => b[1].n - a[1].n).map(([k, o]) => `<tr><td>${esc(k || 'Non renseignée')}</td><td class="num">${o.n}</td><td class="num">${o.c}</td><td class="num">${fmtTaux(o.n ? o.c / o.n : null)}</td><td class="num">${fmtE(Math.round(o.e))}</td></tr>`).join('')}</tbody></table></div>`}</div>
  </div>`;
}
ACTIONS.prospectNote = el => {
  const p = S.prospects[el.dataset.id];
  openModal({ title: `Appel · ${esc(pName(p))}`, body: `<form id="pnf" class="grid"><div class="chips">${[['ok', 'Joint'], ['noanswer', 'Pas de réponse'], ['rdv', 'RDV pris'], ['refus', 'Pas intéressé']].map(([v, l], i) => `<label class="chip-radio"><input type="radio" name="o" value="${v}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div><input class="input" name="note" maxlength="200" placeholder="Note (facultatif)"></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="prospectNoteSave" data-id="${p.id}">Enregistrer</button>` });
};
ACTIONS.prospectNoteSave = el => { const f = formData($('#pnf')); const id = newId(); db.set(['touches', id], { id, clubId: CLUB.id, prospectId: el.dataset.id, at: Date.now(), by: ME.id, channel: 'call', outcome: f.o === 'refus' ? 'refus' : f.o === 'noanswer' ? 'noanswer' : 'ok', note: (f.note || '').slice(0, 200) + (f.o === 'rdv' ? ' (RDV pris)' : '') }); closeModal(); toast('Appel noté'); };

// ── Invités (et parrainage) ───────────────────────────────────────────────
const guestsOf = clubId => Object.values(S.guests || {}).filter(g => g && g.clubId === clubId);
const guestConv = g => memo(`gconv|${g.id}`, () => matchClient(g.clubId, g.nom, g.phone, g.date, 30));
ACTIONS.guestNew = () => {
  const cl = activeClients(CLUB.id).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  openModal({ title: 'Nouvel invité', body: `<form id="gstf" class="grid"><label class="field"><span>Nom et prénom</span><input class="input" name="nom" required maxlength="80"></label><div class="form-grid"><label class="field"><span>Téléphone</span><input class="input" name="tel" type="tel"></label><label class="field"><span>Date de passage</span><input class="input" type="date" name="date" value="${today()}" max="${today()}"></label></div>
    <label class="field"><span>Invité par (adhérent, facultatif)</span><input class="input" name="parrain" list="gst-cl" placeholder="Rechercher un adhérent"><datalist id="gst-cl">${cl.map(c => `<option value="${esc(c.name || '')}${c.num ? ' · ' + esc(c.num) : ''}"></option>`).join('')}</datalist></label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="guestSave">Enregistrer</button>` });
};
ACTIONS.guestSave = () => {
  const f = formData($('#gstf')); if (!f.nom.trim()) { toast('Indiquez le nom de l’invité.'); return; }
  const tel = f.tel ? phoneE164(f.tel) : null; if (f.tel && !tel) { toast('Téléphone invalide.'); return; }
  const num = (f.parrain.match(/· (\S+)$/) || [])[1]; const par = f.parrain ? activeClients(CLUB.id).find(c => (num && String(c.num) === num) || tokensKey(c.name || '') === tokensKey(f.parrain)) : null;
  const id = newId(); db.set(['guests', id], { id, clubId: CLUB.id, nom: f.nom.trim().slice(0, 80), phone: tel, date: f.date || today(), parrainId: par ? par.id : null, by: ME.id, at: Date.now() });
  closeModal(); toast(par ? `Invité enregistré, parrain : ${par.name}` : 'Invité enregistré');
};
// Parrain d'un client : invité converti dans les 30 jours, sinon offre ou canal « parrainage ».
function parrainOf(c) {
  const g = guestsOf(c.clubId).find(x => x.parrainId && guestConv(x) && guestConv(x).id === c.id);
  return g ? g.parrainId : null;
}
const isParrainage = c => !!parrainOf(c) || c.source === 'parrainage' || /parrain/.test(norm(`${c.offer || ''} ${c.canal || ''}`));

// ── Opportunités : quoi faire maintenant pour gagner le plus ──────────────
const DUN_AGE = [[7, 0.7, '0 à 7 j', 'age-1'], [30, 0.5, '8 à 30 j', 'age-2'], [60, 0.3, '31 à 60 j', 'age-3'], [Infinity, 0.1, 'plus de 60 j', 'age-4']];
const dunAge = c => ageDays(c.oldestIncident || c.balanceAt) ?? 0;
const dunTranche = c => { const a = dunAge(c); return DUN_AGE.findIndex(t => a <= t[0]); };
const dunAttendu = c => Math.round(Number(c.balance) * DUN_AGE[dunTranche(c)][1] * 100) / 100;
function tauxSauvetage(clubId) {
  return memo(`tsauv|${clubId}`, () => { const from = addDays(today(), -92); const L = resList(clubId).filter(r => (r.date || '') >= from && ['sauvee', 'resiliee'].includes(resStatus(r))); return L.length >= 5 ? L.filter(r => resStatus(r) === 'sauvee').length / L.length : 0.25; });
}
function panierNutrition(clubId) {
  return memo(`pan|${clubId}`, () => { const L = Object.values(S.entries).filter(e => e.clubId === clubId && e.kpiId === 'nutrition' && Number(e.value) > 0 && e.date >= addDays(today(), -90) && entryCounts(e)); return L.length >= 5 ? L.reduce((s, e) => s + Number(e.value), 0) / L.length : 35; });
}
const prixGamme = (clubId, g) => { const L = activeClients(clubId).filter(c => gammeOf(c.offer) === g).map(c => mensualite(c, true)).filter(x => x > 0); return L.length ? median(L) : null; };
const hasShop = c => c.num && Object.values(S.entries).some(e => e.clientNum && String(e.clientNum) === String(c.num) && ['nutrition', 'accessoires'].includes(e.kpiId) && e.date >= c.start && entryCounts(e));
const OPP_TYPES = {
  resiliation: { label: 'Résiliation', icon: 'door' }, impaye: { label: 'Impayé', icon: 'coins' }, prospect: { label: 'Prospect chaud', icon: 'magnet' }, invite: { label: 'Invité', icon: 'ticket' },
  fin: { label: 'Fin d’engagement', icon: 'calcheck' }, upsell: { label: 'Montée en gamme', icon: 'sparkle' }, nutrition: { label: 'Boutique J+15', icon: 'cup' }, ancien: { label: 'Ancien membre', icon: 'repeat' },
  mandat: { label: 'Sans mandat', icon: 'bank' }, parrainage: { label: 'Parrainage', icon: 'users' },
};
function opportunites(clubId) {
  return memo(`opp|${clubId}|${today()}`, () => {
    const out = []; const t = today(); const dvm = dureeVieMois(clubId), pm = prixMoyen(clubId);
    const add = o => { o.eurosAttendus = Math.round(o.eurosPotentiels * Math.min(1, o.probabilite)); if (o.eurosAttendus > 0) out.push(o); };
    const ts = tauxSauvetage(clubId);
    resToHandle(clubId).forEach(r => { const v = valeurEnJeu(r); const urg = resUrgent(r); const c = clubClients(clubId).find(x => tokensKey(x.name || '') === tokensKey(r.client || ''));
      add({ key: 'res_' + r.id, type: 'resiliation', titre: urg ? `Résiliation à J-${Math.max(0, daysTo(r.effective))}` : 'Demande de résiliation', client: r.client, clientId: c ? c.id : null, phone: c ? clientPhone(c) : null, eurosPotentiels: v.euros, probabilite: ts * (urg ? 1.5 : 1), echeance: r.effective, ownerId: r.ownerId || null, href: '#/resiliations', sous: `${r.reason || 'Motif non précisé'} · en jeu ${fmtE(v.euros)}${v.estimee ? ' (estimé)' : ''}` }); });
    dunRows(clubId).filter(c => Number(c.balance) > 0).forEach(c => { const tr = DUN_AGE[dunTranche(c)];
      add({ key: 'dun_' + c.id, type: 'impaye', titre: `Impayé de ${fmtE(Number(c.balance))}`, client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: Number(c.balance), probabilite: tr[1], echeance: dunOf(c).next || t, ownerId: dunOf(c).ownerId || null, href: '#/impayes', sous: `âge ${plur(dunAge(c), 'jour', 'jours')}` }); });
    prospectsOf(clubId).forEach(p => { const a = ageDays(p.creeLe); if (a < 2 || a > 21 || prospectConv(p)) return; const tx = tauxCohorte(clubId, p.commercialId) ?? 0.3;
      add({ key: 'pro_' + p.id, type: 'prospect', titre: 'Prospect à convertir', client: pName(p), phone: p.phone || null, prospectId: p.id, eurosPotentiels: pm * dvm, probabilite: a > 10 ? tx / 2 : tx, echeance: addDays(p.creeLe, 21), ownerId: p.commercialId || null, href: '#/opportunites', sous: `créé il y a ${plur(a, 'jour', 'jours')}${p.statut ? ' · ' + p.statut : ''}` }); });
    guestsOf(clubId).forEach(g => { const a = ageDays(g.date); if (a > 10 || guestConv(g)) return;
      add({ key: 'gst_' + g.id, type: 'invite', titre: 'Invité à rappeler', client: g.nom, phone: g.phone, eurosPotentiels: pm * dvm, probabilite: 0.35, echeance: addDays(g.date, 10), ownerId: g.by || null, href: '#/opportunites', sous: `passé le ${dm(g.date)}` }); });
    activeClients(clubId).forEach(c => {
      const bal = Number(c.balance) > 0; const since = c.start ? ageDays(c.start) : null;
      if (c.end && c.end >= t && c.end <= addDays(t, 45)) add({ key: 'fin_' + c.id + '_' + c.end, type: 'fin', titre: `Fin d’engagement le ${dm(c.end)}`, client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: mensualite(c) * dvm, probabilite: 0.15, echeance: c.end, ownerId: c.sellerId || null, href: '#/loyalty', sous: c.offer || '' });
      if (!bal && gammeOf(c.offer) === 'basic' && since >= 60 && since <= 400) { const up = prixGamme(clubId, 'premium'); const gap = up ? up - mensualite(c) : 0; if (gap > 0) add({ key: 'up_' + c.id, type: 'upsell', titre: 'Proposer Premium', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: gap * 12, probabilite: 0.05, echeance: null, ownerId: c.sellerId || null, href: '#/loyalty', sous: `+${fmtE(gap)} par mois` }); }
      if (since >= 12 && since <= 20 && !hasShop(c)) add({ key: 'nut_' + c.id, type: 'nutrition', titre: 'Aucun achat boutique depuis l’inscription', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: panierNutrition(clubId), probabilite: 0.2, echeance: addDays(c.start, 20), ownerId: c.sellerId || null, href: '#/loyalty', sous: `inscrit le ${dm(c.start)}` });
      if (c.noMandate) add({ key: 'man_' + c.id, type: 'mandat', titre: 'Abonné sans prélèvement', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: mensualite(c) * 2, probabilite: 0.5, echeance: null, ownerId: c.sellerId || null, href: '#/loyalty', sous: c.offer || '' });
    });
    reactivables(clubId).slice(0, 15).forEach(x => add({ key: 'anc_' + x.c.id, type: 'ancien', titre: 'Ancien membre à réactiver', client: x.c.name, clientId: x.c.id, phone: clientPhone(x.c), eurosPotentiels: pm * 6, probabilite: 0.04, echeance: null, ownerId: null, href: '#/loyalty', sous: `sorti il y a ${plur(x.mois, 'mois', 'mois')}` }));
    parrainCandidats(clubId).forEach(c => add({ key: 'par_' + c.id + '_' + t.slice(0, 7), type: 'parrainage', titre: 'Solliciter un parrainage', client: c.name, clientId: c.id, phone: clientPhone(c), eurosPotentiels: pm * dvm, probabilite: 0.03, echeance: null, ownerId: c.sellerId || null, href: '#/opportunites', sous: `adhérent depuis ${plur(Math.round(ageDays(c.start) / 30.44), 'mois', 'mois')}` }));
    return out.sort((a, b) => b.eurosAttendus - a.eurosAttendus);
  });
}
// Anciens membres réactivables : sortis il y a 3 à 24 mois, sans impayé, pas revenus.
function reactivables(clubId) {
  return memo(`react|${clubId}`, () => {
    const I = clientIndex(clubId);
    return clubClients(clubId).filter(c => /ancien|perdu/.test(norm(c.status || '')) && c.endDate && !(Number(c.balance) > 0)).map(c => {
      const mois = Math.round(ageDays(c.endDate) / 30.44);
      const again = (I.byName[tokensKey(c.name || '')] || []).some(o => o.id !== c.id && o.start && o.start > c.endDate && !/ancien|perdu/.test(norm(o.status || '')));
      return { c, mois, again, prio: mensualite(c) * (mois <= 6 ? 1 : mois <= 12 ? 0.6 : 0.3), seg: mois <= 6 ? '3-6' : mois <= 12 ? '6-12' : '12-24' };
    }).filter(x => x.mois >= 3 && x.mois <= 24 && !x.again && !x.c.returnedAt).sort((a, b) => b.prio - a.prio);
  });
}
// Adhérents à solliciter pour un parrainage : plus de 6 mois, sans impayé, 5 par jour au plus.
function parrainCandidats(clubId) {
  const L = activeClients(clubId).filter(c => c.start && ageDays(c.start) >= 183 && !(Number(c.balance) > 0) && clientPhone(c));
  const seed = Number(today().replace(/-/g, '')); return L.sort((a, b) => ((hkeyN(a.id) + seed) % 997) - ((hkeyN(b.id) + seed) % 997)).slice(0, 5);
}
const hkeyN = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

const oppState = key => (S.opps || {})[safeKey(key)] || {};
function oppsFor(clubId, scope = 'mine') {
  const now = Date.now();
  return opportunites(clubId).map(o => { const st = oppState(o.key); return { ...o, ownerId: st.ownerId || o.ownerId, st }; })
    .filter(o => !o.st.doneAt && !(o.st.snoozeUntil > now))
    .filter(o => scope === 'all' || o.ownerId === ME.id || !o.ownerId);
}
function oppsDoneToday(clubId, uid) { const d0 = dateOf(today()).getTime(); return Object.values(S.opps || {}).filter(x => x.clubId === clubId && x.doneAt >= d0 && (!uid || x.doneBy === uid)); }
function oppRow(o, mgr) {
  const T = OPP_TYPES[o.type]; const owner = o.ownerId && S.users[o.ownerId];
  return `<div class="opp-row" data-type="${o.type}"><span class="opp-ico">${ico(T.icon)}</span><div class="spacer"><div class="row wrap" style="gap:6px"><b>${esc(o.titre)}</b><span class="tag">${T.label}</span>${owner ? `<span class="muted small">${esc(owner.first)}</span>` : ''}</div>
    <div class="small">${esc(o.client || '')}${o.sous ? ' · <span class="muted">' + esc(o.sous) + '</span>' : ''}${o.echeance ? ' · <span class="muted">échéance ' + dm(o.echeance) + '</span>' : ''}</div></div>
    <div class="opp-eur"><b>${fmtE(o.eurosAttendus)}</b><small>attendus</small></div>
    <div class="opp-act">${o.phone ? `<a class="btn sm icon" href="tel:${esc(o.phone)}" aria-label="Appeler">${ico('phone')}</a>` : ''}${!o.ownerId ? `<button class="btn sm" data-act="oppTake" data-key="${esc(o.key)}">Je m’en occupe</button>` : ''}${mgr ? `<select class="input sm" data-change="oppAssign" data-key="${esc(o.key)}" aria-label="Attribuer"><option value="">Attribuer</option>${clubMembers(CLUB.id).map(u => `<option value="${u.id}" ${u.id === o.ownerId ? 'selected' : ''}>${esc(u.first)}</option>`).join('')}</select>` : ''}<button class="btn sm primary" data-act="oppDone" data-key="${esc(o.key)}">Fait</button><button class="btn sm ghost" data-act="oppLater" data-key="${esc(o.key)}">Pas maintenant</button></div></div>`;
}
PAGES.opportunites = {
  title: 'Opportunités',
  render() {
    const mgr = isManager(); const scope = mgr ? (UI.oppScope || 'all') : 'mine';
    const all = oppsFor(CLUB.id, scope); const f = UI.oppType || 'all'; const L = all.filter(o => f === 'all' || o.type === f);
    const top = L.slice(0, 12); const tot = top.reduce((s, o) => s + o.eurosAttendus, 0);
    const done = oppsDoneToday(CLUB.id, mgr && scope === 'all' ? null : ME.id); const doneE = done.reduce((s, x) => s + (Number(x.euros) || 0), 0);
    const counts = {}; all.forEach(o => { counts[o.type] = (counts[o.type] || 0) + 1; });
    const hasData = clubClients(CLUB.id).length || prospectsOf(CLUB.id).length;
    if (!hasData) return `<div class="page-head"><div><h1>Opportunités</h1></div></div><div class="card">${emptyBox({ art: 'target', title: 'Rien à classer pour l’instant', text: 'Déposez dans Imports > Resamania : Vente d’abonnements, Clients club, Clients en incident, Prospects, Résiliations et Évolution clients. Les actions les plus rentables apparaîtront ici, classées en euros.' })}</div>`;
    return `<div class="page-head"><div><h1>Opportunités</h1><p>Les actions qui rapportent le plus, classées par euros attendus.</p></div><span class="spacer"></span><button class="btn" data-act="guestNew">${ico('plus')} Invité</button></div>
      <div class="opp-hero"><b>Aujourd’hui, ${fmtE(tot)} attendus si vous traitez ces ${plur(top.length, 'action', 'actions')}.</b>${palierManque()}</div>
      <div class="row wrap" style="gap:8px;margin:12px 0">${mgr ? seg('oppScope', [['all', 'Tout le club'], ['mine', 'Les miennes']], scope) : ''}<select class="input sm" style="width:auto" data-change="oppType"><option value="all">Tous les types · ${all.length}</option>${Object.entries(OPP_TYPES).filter(([k]) => counts[k]).map(([k, T]) => `<option value="${k}" ${f === k ? 'selected' : ''}>${T.label} · ${counts[k]}</option>`).join('')}</select></div>
      <div class="card opp-list">${L.length ? L.slice(0, UI.oppAll ? 200 : 25).map(o => oppRow(o, mgr)).join('') : emptyBox({ art: 'done', title: 'Tout est traité', text: 'Aucune opportunité ouverte pour ce filtre.' })}
      ${L.length > 25 && !UI.oppAll ? `<button class="btn sm" style="margin-top:10px" data-act="ui" data-key="oppAll" data-val="1">Voir les ${L.length - 25} suivantes</button>` : ''}</div>
      <p class="opp-foot">Réalisé aujourd’hui : <b>${plur(done.length, 'action', 'actions')}</b>, <b>${fmtE(doneE)}</b> sécurisés.</p>
      <p class="muted small">Probabilités : résiliation au taux de sauvetage des 3 derniers mois (${fmtP(tauxSauvetage(CLUB.id))}), impayé selon l’âge (70 %, 50 %, 30 %, 10 %), prospect au taux de transformation du commercial, invité 35 %, fin d’engagement 15 %, montée en gamme 5 %, boutique 20 %, ancien membre 4 %, sans mandat 50 %.</p>`;
  },
};
ACTIONS.oppType = el => { UI.oppType = el.value; UI.oppAll = null; render(); };
const oppFind = key => opportunites(CLUB.id).find(o => o.key === key);
const oppPath = key => ['opps', safeKey(key)];
ACTIONS.oppTake = el => oppClaim(el.dataset.key, ME.id);
ACTIONS.oppAssign = el => oppClaim(el.dataset.key, el.value || null);
function oppClaim(key, uid) {
  const o = oppFind(key); if (!o) return;
  if (o.type === 'resiliation') db.set(['resiliations', key.slice(4), 'ownerId'], uid);
  else if (o.type === 'impaye') db.set(['clients', key.slice(4), 'dunning', 'ownerId'], uid);
  else db.batch([[[...oppPath(key), 'ownerId'], uid], [[...oppPath(key), 'clubId'], CLUB.id]]);
  toast(uid === ME.id ? 'C’est noté, à vous de jouer' : 'Attribué');
}
ACTIONS.oppDone = el => {
  const o = oppFind(el.dataset.key); if (!o) return; const ops = [[oppPath(o.key), { ...oppState(o.key), clubId: CLUB.id, doneAt: Date.now(), doneBy: ME.id, euros: o.eurosAttendus, type: o.type }]];
  if (o.clientId) { const id = newId(); ops.push([['touches', id], { id, clubId: CLUB.id, clientId: o.clientId, at: Date.now(), by: ME.id, channel: 'note', outcome: 'ok', note: `Opportunité traitée : ${o.titre}` }]); }
  db.batch(ops); celebrate('Action faite', `${fmtE(o.eurosAttendus)} sécurisés`, { kind: 'win' });
};
ACTIONS.oppLater = el => { const k = el.dataset.key; db.batch([[[...oppPath(k), 'snoozeUntil'], Date.now() + 3 * 864e5], [[...oppPath(k), 'clubId'], CLUB.id]]); toast('Masquée 3 jours'); };
// Accueil : les 5 premières opportunités de l'utilisateur.
function oppHomeList(n = 5) {
  const L = oppsFor(CLUB.id, 'mine').slice(0, n);
  if (!L.length) return todoList(3);
  return `<div class="opp-home">${L.map(o => `<a class="row opp-mini" href="#/opportunites"><span class="opp-ico">${ico(OPP_TYPES[o.type].icon)}</span><span class="spacer"><b>${esc(o.titre)}</b><span class="muted small">${esc(o.client || '')}</span></span><b>${fmtE(o.eurosAttendus)}</b></a>`).join('')}</div>`;
}
// « Il manque X pour le prochain palier » (repris de la prévision).
function palierManque() {
  const mk = curMonth(); const k = Object.keys(paliersFor(CLUB.id, mk))[0]; if (!k) return '';
  const s = palierState(CLUB.id, mk, k); if (!s || !s.next) return '';
  return `<span>Il manque ${fmtV(Math.ceil(s.next.target - s.real), S.kpis[k].unit)} ${S.kpis[k].label.toLowerCase()} pour le palier ${s.reached + 1}.</span>`;
}
