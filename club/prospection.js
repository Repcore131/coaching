/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — relances prospects, comme dans Resamania, depuis le téléphone ══
// Onglet « Prospects » de la page Relances :
//  - liste classée chaud / tiède / froid, à relancer aujourd'hui, planifiées, KO ;
//  - fiche prospect : coordonnées, appel, SMS prêts, historique ;
//  - « Effectuer ma relance » : on coche ce qu'on a fait (appel 1, appel 2,
//    message vocal, SMS), on choisit le comportement, puis on replanifie,
//    on note un RDV, on passe en KO ou en « ne pas rappeler » ;
//  - « Placer des relances » : une même relance posée d'un coup sur les
//    prospects créés depuis 12 h, 24 h, 48 h, 7, 14 ou 30 jours.
// L'état de chaque relance vit dans S.relances (clé de la file d'appels) et
// chaque action dans S.touches : la file d'appels et le KPI du matin les voient.

const PR_TEMPS = { chaud: { label: 'Chaud', cls: 'is-bad', ico: 'flame' }, tiede: { label: 'Tiède', cls: 'is-warn', ico: 'sun' }, froid: { label: 'Froid', cls: 'is-info', ico: 'snow' } };
const PR_COMPORTEMENTS = [
  ['pas_decroche', 'Ne décroche pas', 'pasreponse'],
  ['messagerie', 'Messagerie / répondeur', 'messagerie'],
  ['repondeur_plein', 'Répondeur plein', 'pasreponse'],
  ['raccroche', 'Raccroche', 'pasreponse'],
  ['faux_numero', 'Numéro erroné', 'mauvaisnumero'],
  ['interesse', 'A décroché : intéressé', 'joint'],
  ['a_rappeler', 'A décroché : à rappeler', 'rappeler'],
  ['rdv', 'A décroché : RDV pris', 'rdv'],
  ['reflexion', 'A décroché : en réflexion', 'joint'],
  ['pas_interesse', 'A décroché : pas intéressé', 'refus'],
  ['trop_cher', 'Trop cher', 'refus'],
  ['ailleurs', 'Déjà inscrit ailleurs', 'refus'],
  ['plus_tard', 'Pas le moment, plus tard', 'rappeler'],
];
const PR_CHECKS = [['appel1', 'Appel 1'], ['appel2', 'Appel 2'], ['vocal', 'Message vocal'], ['sms', 'SMS']];
const PR_SMS = [
  ['premier', 'Premier contact', 'Bonjour {prenom}, c’est {commercial} de {club}. Merci pour votre intérêt. Je vous propose une séance découverte gratuite cette semaine : quel jour vous arrange ?'],
  ['manque', 'Après un appel manqué', 'Bonjour {prenom}, {commercial} de {club}. J’ai essayé de vous joindre au sujet de votre demande. Quand puis-je vous rappeler ? Vous pouvez aussi répondre à ce message.'],
  ['seance', 'Relance séance découverte', 'Bonjour {prenom}, votre séance découverte chez {club} vous attend toujours. Dites-moi le jour qui vous arrange et je vous la réserve. {commercial}'],
  ['offre', 'Offre du moment', 'Bonjour {prenom}, {commercial} de {club}. Nous avons une offre d’inscription en ce moment : je vous en dis plus en deux minutes au téléphone ou au club ?'],
  ['dernier', 'Dernière relance', 'Bonjour {prenom}, je ne veux pas vous déranger : je clôture votre demande chez {club}. Si vous souhaitez toujours essayer le club, répondez simplement à ce message. {commercial}'],
];
const PR_STOP = ' Répondez STOP pour ne plus recevoir ces messages.';

// ── Données ───────────────────────────────────────────────────────────────
function prospTempAuto(p) {
  const t = norm(`${p.valeurTxt || ''} ${p.statut || ''}`);
  if (/chaud|hot/.test(t)) return 'chaud'; if (/tiede|warm/.test(t)) return 'tiede'; if (/froid|cold/.test(t)) return 'froid';
  const a = ageDays(p.creeLe); if (a != null && a <= 2) return 'chaud'; if (a != null && a > 14) return 'froid'; return 'tiede';
}
const prospTemp = p => (PR_TEMPS[p.temp] ? p.temp : prospTempAuto(p));
const prospKey = p => relKey('prospect', p.id, p.creeLe);
const prospPhone = p => phoneE164(p.phone);
// Moment de création : exact pour un prospect saisi dans l'appli, midi du jour pour un import.
const prospCreatedAt = p => (p.manual && p.at ? p.at : dateOf(p.creeLe).getTime() + 12 * 3600000);
// La relance d'un prospect, même hors de la file d'appels (ancienne, close, planifiée plus tard).
function prospRel(p) {
  const key = prospKey(p); const st = deepGet(S, ['relances', key]) || {}; const nm = pName(p) || 'Prospect';
  const touches = touchesOf(key);
  return { key, kind: 'prospect', clubId: p.clubId, refId: p.id, clientId: null, clientName: nm, name: nm, anchor: p.creeLe, client: { id: null, clubId: p.clubId, name: nm, phone: p.phone, email: p.email }, ownerId: st.ownerId || p.commercialId || null, status: st.status || 'todo', ...st, touches, attempts: st.attempts || touches.filter(x => x.channel === 'call' && !(TOUCH_OUTCOMES[x.outcome] || {}).reached).length, st };
}
function prospState(p, rl = prospRel(p)) {
  if (['perdu', 'annule'].includes(rl.status)) return rl.lostReason === 'Ne plus contacter' || rl.status === 'annule' ? 'stop' : 'ko';
  if (rl.status === 'gagne') return 'gagne';
  if (prospectConv(p)) return 'inscrit';
  const endDay = dateOf(today()).getTime() + 864e5;
  if (rl.nextAt && rl.nextAt >= endDay) return 'planifie';
  return 'a_faire';
}
const PR_STATES = { a_faire: 'À relancer', planifie: 'Planifiée', gagne: 'RDV pris', inscrit: 'Inscrit', ko: 'KO', stop: 'Ne pas rappeler' };

// ── Onglet Prospects de la page Relances ──────────────────────────────────
function prospRender() {
  const vue = UI.prVue || 'a_faire', tf = UI.prTemp || 'all', q = norm(UI.prQ || '');
  const mine = (UI.prScope || (isManager() ? 'all' : 'mine')) === 'mine';
  const all = prospectsOf(CLUB.id).map(p => { const rl = prospRel(p); return { p, rl, temp: prospTemp(p), state: prospState(p, rl) }; });
  const base = all.filter(x => (!mine || x.rl.ownerId === ME.id || (!x.rl.ownerId && x.p.commercialId === ME.id)) && (tf === 'all' || x.temp === tf) && (!q || norm(`${pName(x.p)} ${x.p.phone || ''} ${x.p.email || ''}`).includes(q)));
  // À relancer : relance placée ou prise en main, ou prospect de moins de 21 jours.
  const aFaire = x => x.state === 'a_faire' && (x.rl.st.nextAt || x.rl.st.ownerId || (ageDays(x.p.creeLe) ?? 99) <= 21);
  const inVue = x => (vue === 'a_faire' ? aFaire(x) : vue === 'planifie' ? x.state === 'planifie' : vue === 'ko' ? ['ko', 'stop'].includes(x.state) : true);
  const order = { chaud: 0, tiede: 1, froid: 2 };
  const list = base.filter(inVue).sort((a, b) => (vue === 'planifie' ? (a.rl.nextAt || 0) - (b.rl.nextAt || 0) : order[a.temp] - order[b.temp] || (a.rl.nextAt || 0) - (b.rl.nextAt || 0) || prospCreatedAt(b.p) - prospCreatedAt(a.p)));
  const n = k => base.filter(x => (k === 'a_faire' ? aFaire(x) : k === 'planifie' ? x.state === 'planifie' : ['ko', 'stop'].includes(x.state))).length;
  const nt = t => all.filter(x => x.temp === t && aFaire(x) && (!mine || x.rl.ownerId === ME.id || (!x.rl.ownerId && x.p.commercialId === ME.id))).length;
  return `<div class="row wrap pr-bar" style="gap:8px;margin:12px 0">
      <button class="btn primary" data-act="prPlace">${ico('cal')} Placer des relances</button>
      <button class="btn" data-act="prNew">${ico('plus')} Nouveau prospect</button>
      <span class="spacer"></span>${seg('prScope', [['mine', 'Mes prospects'], ['all', 'Tout le club']], mine ? 'mine' : 'all')}</div>
    <div class="pr-temps">${Object.entries(PR_TEMPS).map(([k, t]) => `<button class="pr-temp-tile t-${k} ${tf === k ? 'on' : ''}" data-act="ui" data-key="prTemp" data-val="${tf === k ? 'all' : k}">${ico(t.ico)}<b>${nt(k)}</b><span>${t.label}${nt(k) > 1 ? 's' : ''} à relancer</span></button>`).join('')}</div>
    <div class="row wrap" style="gap:8px;margin:12px 0">${seg('prVue', [['a_faire', `À relancer · ${n('a_faire')}`], ['planifie', `Planifiées · ${n('planifie')}`], ['all', 'Tous'], ['ko', `KO · ${n('ko')}`]], vue)}
      <input class="input sm" style="max-width:220px" placeholder="Rechercher un prospect" value="${esc(UI.prQ || '')}" data-input="prSearchQ" aria-label="Rechercher un prospect"></div>
    ${list.length ? `<div class="pr-list">${list.slice(0, 150).map(prospRow).join('')}</div>${list.length > 150 ? `<p class="muted small">${list.length - 150} de plus : affinez avec la recherche.</p>` : ''}`
      : emptyBox({ art: 'board', title: vue === 'a_faire' ? 'Aucun prospect à relancer' : 'Aucun prospect ici', text: prospectsOf(CLUB.id).length ? 'Changez de filtre, ou placez des relances sur vos derniers prospects.' : 'Déposez l’export Prospects de Resamania (Imports) ou ajoutez un prospect.', cta: '<a class="btn sm" href="#/imports">Importer des prospects</a>' })}`;
}
function prospRow({ p, rl, temp, state }) {
  const T = PR_TEMPS[temp]; const ph = prospPhone(p); const last = rl.touches[0]; const owner = rl.ownerId && S.users[rl.ownerId];
  const checks = last && last.checks ? PR_CHECKS.filter(([k]) => last.checks[k]).map(([, l]) => l).join(' · ') : '';
  const comp = last && last.comportement ? (PR_COMPORTEMENTS.find(c => c[0] === last.comportement) || [])[1] : '';
  return `<div class="pr-row t-${temp}">
    <button class="pr-main" data-act="prOpen" data-id="${p.id}"><div class="pr-name"><b>${esc(pName(p) || 'Prospect')}</b><span class="tag ${T.cls}">${T.label}</span>${state !== 'a_faire' ? `<span class="tag">${PR_STATES[state]}</span>` : ''}</div>
      <div class="muted small">créé le ${dm(p.creeLe)}${p.provenance ? ' · ' + esc(p.provenance) : ''}${owner ? ' · ' + esc(owner.first) : ' · non attribué'}</div>
      <div class="small">${rl.nextAt ? `${ico('clock', 'ico ico-xs')} relance ${relWhen(rl.nextAt)}` : ''}${last ? `${rl.nextAt ? ' · ' : ''}dernière : ${ago(last.at)}${checks ? ' (' + esc(checks) + ')' : ''}${comp ? ' · ' + esc(comp) : ''}` : rl.nextAt ? '' : '<span class="muted">jamais relancé</span>'}</div></button>
    <div class="pr-acts">${ph ? `<a class="btn icon" href="tel:${esc(ph)}" data-act="prCallLink" data-id="${p.id}" aria-label="Appeler ${esc(pName(p))}">${ico('phone')}</a>` : ''}
      <button class="btn primary sm" data-act="prDo" data-id="${p.id}">Effectuer ma relance</button></div></div>`;
}
function relWhen(ts) {
  const d = new Date(ts); const day = isoOf(d); const hm = `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  if (ts < Date.now()) return `en retard (${dm(day)} ${hm})`;
  if (day === today()) return `aujourd’hui ${hm}`; if (day === addDays(today(), 1)) return `demain ${hm}`;
  return `le ${dm(day)} ${hm}`;
}
ACTIONS.prSearchQ = el => { UI.prQ = el.value; render(); };

// ── Fiche prospect ────────────────────────────────────────────────────────
ACTIONS.prOpen = el => prospCard(el.dataset.id);
function prospCard(id) {
  const p = S.prospects[id]; if (!p) return; const rl = prospRel(p); const ph = prospPhone(p); const temp = prospTemp(p); const state = prospState(p, rl);
  const owner = rl.ownerId && S.users[rl.ownerId];
  openModal({ title: pName(p) || 'Prospect', drawer: true, body: `<div class="pr-card">
    <div class="row wrap" style="gap:6px">${Object.entries(PR_TEMPS).map(([k, t]) => `<button class="chip-radio ${temp === k ? 'on' : ''}" data-act="prTemp" data-id="${p.id}" data-t="${k}"><span>${t.label}</span></button>`).join('')}<span class="tag">${PR_STATES[state]}</span></div>
    <div class="pr-coords">${ph ? `<a class="btn primary lg" href="tel:${esc(ph)}" data-act="prCallLink" data-id="${p.id}">${ico('phone')} ${esc(phoneFmt(ph))}</a>` : `<button class="btn" data-act="prEdit" data-id="${p.id}">${ico('plus')} Ajouter le numéro</button>`}
      ${ph ? `<a class="btn" href="https://wa.me/${esc(ph.replace('+', ''))}" target="_blank" rel="noopener">${ico('chat')} WhatsApp</a>` : ''}${p.email ? `<a class="btn" href="mailto:${esc(p.email)}">${ico('mail')} E-mail</a>` : ''}</div>
    <div class="small pr-meta"><div><span class="muted">Créé le</span> ${dmy(p.creeLe)}</div>${p.provenance ? `<div><span class="muted">Provenance</span> ${esc(p.provenance)}</div>` : ''}${p.statut ? `<div><span class="muted">Statut Resamania</span> ${esc(p.statut)}</div>` : ''}<div><span class="muted">Responsable</span> ${owner ? esc(fullName(owner)) : 'non attribué'}</div>${rl.nextAt ? `<div><span class="muted">Prochaine relance</span> ${relWhen(rl.nextAt)}</div>` : ''}${p.email ? `<div><span class="muted">E-mail</span> ${esc(p.email)}</div>` : ''}${p.note ? `<div><span class="muted">Note</span> ${esc(p.note)}</div>` : ''}</div>
    <button class="btn primary lg" style="width:100%" data-act="prDo" data-id="${p.id}">${ico('check')} Effectuer ma relance</button>
    ${ph ? `<h3 style="margin:16px 0 6px">SMS prêts</h3><div class="pr-sms">${prospSmsList(p).map(([k, label]) => `<button class="btn sm" data-act="prSms" data-id="${p.id}" data-tpl="${esc(k)}">${ico('chat')} ${esc(label)}</button>`).join('')}</div>` : ''}
    <h3 style="margin:16px 0 6px">Historique</h3>${rl.touches.length ? rl.touches.map(t => { const c = t.checks ? PR_CHECKS.filter(([k]) => t.checks[k]).map(([, l]) => l).join(' · ') : ''; const cp = t.comportement ? (PR_COMPORTEMENTS.find(x => x[0] === t.comportement) || [])[1] : '';
      return `<div class="tl-row"><span class="tl-ico">${ico(t.channel === 'sms' ? 'chat' : 'phone')}</span><div class="spacer"><b>${esc(cp || (TOUCH_OUTCOMES[t.outcome] || {}).label || t.outcome || '')}</b>${c ? `<div class="small">${esc(c)}</div>` : ''}${t.note ? `<div class="small">${esc(t.note)}</div>` : ''}${t.tplLabel ? `<div class="small muted">SMS « ${esc(t.tplLabel)} »</div>` : ''}<div class="muted small">${dmy(isoOf(new Date(t.at)))} ${new Date(t.at).toTimeString().slice(0, 5)}${S.users[t.by] ? ' · ' + esc(S.users[t.by].first) : ''}</div></div></div>`; }).join('') : '<p class="muted small">Aucune relance pour l’instant.</p>'}
    <div class="row wrap" style="gap:8px;margin-top:14px"><button class="btn sm ghost" data-act="prEdit" data-id="${p.id}">${ico('edit')} Modifier la fiche</button>${!rl.ownerId || rl.ownerId !== ME.id ? `<button class="btn sm ghost" data-act="prTake" data-id="${p.id}">Je m’en occupe</button>` : ''}${['ko', 'stop', 'gagne'].includes(state) ? `<button class="btn sm ghost" data-act="prReopen" data-id="${p.id}">Rouvrir la relance</button>` : ''}</div>
  </div>` });
}
function prospSmsList() {
  const custom = Object.values(S.templates || {}).filter(t => t.active !== false && t.kind === 'prospect' && t.channel === 'sms' && (!t.clubId || t.clubId === CLUB.id)).map(t => ['c:' + t.id, t.name || 'Modèle du club', t.body]);
  return [...PR_SMS, ...custom];
}
function prospSmsText(p, tplKey) {
  const t = prospSmsList(p).find(x => x[0] === tplKey) || PR_SMS[0];
  const f = fillTemplate(t[2] + (/STOP/.test(t[2]) ? '' : PR_STOP), { prenom: p.prenom || (pName(p).split(' ')[0]) || '', nom: pName(p), club: CLUB.name || '', commercial: ME.first || '' });
  return { text: f.text.replace(/\[[a-z_]+ manquant\]\s?/g, ''), label: t[1] };
}
// SMS depuis la fiche : journalisé, puis l'appli SMS du téléphone s'ouvre avec le texte.
ACTIONS.prSms = el => {
  const p = S.prospects[el.dataset.id]; const ph = prospPhone(p); if (!p || !ph) return; const s = prospSmsText(p, el.dataset.tpl);
  const rl = prospRel(p);
  db.batch([touchOp(rl, { channel: 'sms', outcome: 'envoye', text: s.text.slice(0, 1000), tplLabel: s.label }), ...relPatch(rl, { ownerId: rl.ownerId || ME.id })]);
  location.href = `sms:${ph}?&body=${encodeURIComponent(s.text)}`;
};
ACTIONS.prCallLink = el => { if (!matchMedia('(pointer: coarse)').matches) { const p = S.prospects[el.dataset.id]; toast(`Composez le ${phoneFmt(prospPhone(p))}`); } };
ACTIONS.prTemp = el => { db.set(['prospects', el.dataset.id, 'temp'], el.dataset.t); closeModal(); prospCard(el.dataset.id); };
ACTIONS.prTake = el => { const p = S.prospects[el.dataset.id]; db.batch(relPatch(prospRel(p), { ownerId: ME.id })); closeModal(); prospCard(p.id); toast('1 prospect à votre nom'); };
ACTIONS.prReopen = el => { const p = S.prospects[el.dataset.id]; db.batch(relPatch(prospRel(p), { status: 'todo', nextAt: null, closedAt: null, lostReason: null, result: null })); closeModal(); prospCard(p.id); };

// ── Effectuer ma relance ──────────────────────────────────────────────────
ACTIONS.prDo = el => prospSheet(el.dataset.id);
function prospSheet(id) {
  const p = S.prospects[id]; if (!p) return; const ph = prospPhone(p); const temp = prospTemp(p); const rl = prospRel(p);
  const done = rl.touches.filter(t => t.at > Date.now() - 864e5 && t.checks);
  const sms = prospSmsList(p);
  openModal({ title: `Relance · ${pName(p) || 'Prospect'}`, drawer: true, body: `<form id="prf" class="grid pr-sheet">
    ${ph ? `<a class="btn primary lg pr-callbig" href="tel:${esc(ph)}" data-act="prSheetCall" data-id="${p.id}">${ico('phone')} Appeler le ${esc(phoneFmt(ph))}</a>` : '<div class="alert">Pas de numéro : ajoutez-le depuis la fiche.</div>'}
    ${done.length ? `<p class="muted small" style="margin:0">Aujourd’hui déjà : ${esc(done.map(t => PR_CHECKS.filter(([k]) => t.checks[k]).map(([, l]) => l).join(', ')).join(' ; '))}</p>` : ''}
    <div><div class="field-label">Ce que j’ai fait</div><div class="pr-checks">${PR_CHECKS.map(([k, l]) => `<label class="pr-check"><input type="checkbox" name="c_${k}"><span>${l}</span></label>`).join('')}</div></div>
    ${ph ? `<div class="cond-sms" hidden><div class="row wrap" style="gap:6px"><select class="input sm" name="tpl" style="width:auto">${sms.map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select><button type="button" class="btn sm" data-act="prSheetSms" data-id="${p.id}">${ico('chat')} Ouvrir le SMS</button></div></div>` : ''}
    <label class="field"><span>Comportement</span><select class="input" name="comp"><option value="">Choisir…</option>${PR_COMPORTEMENTS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></label>
    <div><div class="field-label">Température</div><div class="row" style="gap:6px">${Object.entries(PR_TEMPS).map(([k, t]) => `<label class="chip-radio"><input type="radio" name="temp" value="${k}" ${temp === k ? 'checked' : ''}><span>${t.label}</span></label>`).join('')}</div></div>
    <div><div class="field-label">Et ensuite ?</div><div class="out-grid">${[['replan', 'Replanifier'], ['essai', 'Essai réservé'], ['rdv', 'RDV pris'], ['ko', 'KO'], ['stop', 'Ne pas rappeler']].map(([k, l]) => `<label class="out-btn"><input type="radio" name="suite" value="${k}"><span>${l}</span></label>`).join('')}</div></div>
    <div class="cond" data-for="replan"><div class="chips">${[['2h', 'Dans 2 h'], ['soir', 'Ce soir 18 h'], ['demain', 'Demain 10 h'], ['j2', 'Dans 2 jours'], ['j7', 'Dans 1 semaine']].map(([k, l]) => `<button type="button" class="chip-radio" data-act="prQuick" data-q="${k}"><span>${l}</span></button>`).join('')}</div><label class="field"><span>Relancer le</span><input class="input" type="datetime-local" name="nextAt"></label></div>
    <div class="cond" data-for="essai"><label class="field"><span>Séance d’essai le</span><input class="input" type="datetime-local" name="essaiAt"></label><p class="muted small" style="margin:0">Visite non transformée : la relance de J+2 après l’essai se programme toute seule.</p></div>
    <div class="cond" data-for="rdv"><label class="field"><span>Rendez-vous le</span><input class="input" type="datetime-local" name="rdvAt"></label></div>
    <label class="field"><span>Note</span><textarea class="input" name="note" rows="2" maxlength="280" placeholder="Ce qu’il faut retenir"></textarea></label>
  </form>`, foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="pr-ok" data-act="prSave" data-id="${p.id}" disabled>Valider la relance</button>`,
    onMount: m => {
      const upd = () => { const f = formData($('#prf', m)); $$('.cond', m).forEach(c => { c.hidden = c.dataset.for !== f.suite; }); const cs = $('.cond-sms', m); if (cs) cs.hidden = !f.c_sms;
        const did = PR_CHECKS.some(([k]) => f['c_' + k]) || f.comp;
        // Comportement « RDV pris » ou « pas intéressé » : la suite logique est proposée.
        if (f.comp && !f.suite) { const sug = { rdv: 'rdv', pas_interesse: 'ko', trop_cher: 'ko', ailleurs: 'ko' }[f.comp] || 'replan'; const r = $(`input[name=suite][value=${sug}]`, m); if (r) { r.checked = true; return upd(); } }
        $('#pr-ok', m).disabled = !(did && f.suite && !(f.suite === 'replan' && !f.nextAt) && !(f.suite === 'rdv' && !f.rdvAt) && !(f.suite === 'essai' && !f.essaiAt)); };
      m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
    } });
}
// Le bouton d'appel coche tout seul « Appel 1 », puis « Appel 2 ».
ACTIONS.prSheetCall = el => { const a = $('#prf [name=c_appel1]'), b = $('#prf [name=c_appel2]'); const box = a && !a.checked ? a : b; if (box && !box.checked) { box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true })); } ACTIONS.prCallLink(el); };
ACTIONS.prSheetSms = el => { const p = S.prospects[el.dataset.id]; const ph = prospPhone(p); const s = prospSmsText(p, $('#prf [name=tpl]').value); UI.prSmsSent = { id: p.id, label: s.label, text: s.text }; location.href = `sms:${ph}?&body=${encodeURIComponent(s.text)}`; };
ACTIONS.prQuick = el => {
  const d = new Date(); let t;
  const q = el.dataset.q;
  if (q === '2h') t = new Date(Date.now() + 2 * 3600000); else if (q === 'soir') t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18);
  else if (q === 'demain') t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10); else if (q === 'j2') t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 2, 10); else t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7, 10);
  const inp = $('#prf input[name=nextAt]'); inp.value = `${isoOf(t)}T${pad(t.getHours())}:${pad(t.getMinutes())}`; inp.dispatchEvent(new Event('input', { bubbles: true }));
};
ACTIONS.prSave = el => {
  const p = S.prospects[el.dataset.id]; if (!p) return; const f = formData($('#prf')); const rl = prospRel(p); const now = Date.now();
  const checks = {}; PR_CHECKS.forEach(([k]) => { if (f['c_' + k]) checks[k] = true; });
  const comp = PR_COMPORTEMENTS.find(c => c[0] === f.comp);
  let outcome = comp ? comp[2] : (checks.vocal ? 'messagerie' : checks.appel1 || checks.appel2 ? 'pasreponse' : 'envoye');
  const t = { channel: checks.appel1 || checks.appel2 || checks.vocal ? 'call' : 'sms', checks, comportement: f.comp || null, note: (f.note || '').trim().slice(0, 280) };
  if (checks.sms && UI.prSmsSent && UI.prSmsSent.id === p.id) { t.tplLabel = UI.prSmsSent.label; t.text = UI.prSmsSent.text.slice(0, 1000); }
  UI.prSmsSent = null;
  let patch;
  if (f.suite === 'replan') { const at = new Date(f.nextAt).getTime(); t.callbackAt = at; patch = { status: 'attente', nextAt: at }; if (outcome === 'joint') outcome = 'rappeler'; }
  else if (f.suite === 'essai') { const e = new Date(f.essaiAt); t.essaiAt = e.getTime(); outcome = 'rdv'; const j2 = new Date(e.getFullYear(), e.getMonth(), e.getDate() + 2, 10).getTime(); patch = { status: 'attente', nextAt: j2, essaiAt: e.getTime() }; }
  else if (f.suite === 'rdv') { t.rdvAt = new Date(f.rdvAt).getTime(); outcome = 'rdv'; patch = { status: 'gagne', nextAt: null, closedAt: now, closedBy: ME.id, result: 'rdv' }; }
  else if (f.suite === 'ko') { outcome = 'refus'; t.reason = comp ? comp[1] : 'KO'; patch = { status: 'perdu', nextAt: null, closedAt: now, closedBy: ME.id, lostReason: t.reason }; }
  else { outcome = 'stop'; patch = { status: 'perdu', nextAt: null, closedAt: now, closedBy: ME.id, lostReason: 'Ne plus contacter' }; }
  t.outcome = outcome;
  const calls = (checks.appel1 ? 1 : 0) + (checks.appel2 ? 1 : 0);
  const ops = [touchOp(rl, t), ...relPatch(rl, { ...patch, ownerId: rl.ownerId || ME.id, attempts: (rl.attempts || 0) + (TOUCH_OUTCOMES[outcome] && TOUCH_OUTCOMES[outcome].reached ? 0 : calls), step: (rl.step || 0) + 1, lastAt: now, claimedBy: null })];
  if (f.temp && f.temp !== p.temp) ops.push([['prospects', p.id, 'temp'], f.temp]);
  if (f.suite === 'rdv') ops.push([['prospects', p.id, 'statut'], 'RDV pris']);
  if (f.suite === 'essai') ops.push([['prospects', p.id, 'statut'], 'Essai réservé']);
  if (f.suite === 'stop') ops.push([['prospects', p.id, 'statut'], 'Ne pas rappeler']);
  if (f.suite === 'ko') ops.push([['prospects', p.id, 'statut'], 'Perdu']);
  db.batch(ops); closeModal();
  toast(f.suite === 'essai' ? `Essai noté. Relance J+2 : ${relWhen(patch.nextAt)}` : f.suite === 'replan' ? `Relance validée. Prochaine : ${relWhen(patch.nextAt)}` : f.suite === 'rdv' ? 'RDV noté' : f.suite === 'ko' ? 'Prospect passé en KO' : 'Ne plus rappeler : noté');
};

// ── Nouveau prospect / modifier la fiche ──────────────────────────────────
ACTIONS.prNew = () => prospForm(null);
ACTIONS.prEdit = el => prospForm(S.prospects[el.dataset.id]);
function prospForm(p) {
  const v = p || {};
  openModal({ title: p ? 'Modifier le prospect' : 'Nouveau prospect', body: `<form id="pnw" class="form-grid">
    <label class="field"><span>Prénom</span><input class="input" name="prenom" value="${esc(v.prenom || '')}" autocomplete="off"></label><label class="field"><span>Nom</span><input class="input" name="nom" value="${esc(v.nom || '')}" autocomplete="off"></label>
    <label class="field"><span>Téléphone</span><input class="input" name="phone" type="tel" inputmode="tel" value="${esc(v.phone ? phoneFmt(phoneE164(v.phone) || v.phone) : '')}" placeholder="06 12 34 56 78"></label><label class="field"><span>E-mail</span><input class="input" name="email" type="email" value="${esc(v.email || '')}"></label>
    <label class="field"><span>Provenance</span><input class="input" name="provenance" value="${esc(v.provenance || '')}" placeholder="Passage club, site web, Instagram…" list="pr-prov"><datalist id="pr-prov">${['Passage club', 'Site web', 'Téléphone', 'Instagram', 'Facebook', 'Parrainage', 'Salon / événement'].map(x => `<option>${x}</option>`).join('')}</datalist></label>
    <label class="field"><span>Température</span><select class="input" name="temp">${Object.entries(PR_TEMPS).map(([k, t]) => `<option value="${k}" ${(v.temp || (p ? prospTemp(p) : 'chaud')) === k ? 'selected' : ''}>${t.label}</option>`).join('')}</select></label>
    <label class="field full"><span>Note</span><input class="input" name="note" maxlength="200" value="${esc(v.note || '')}"></label></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="prFormSave" data-id="${p ? p.id : ''}">Enregistrer</button>` });
}
ACTIONS.prFormSave = el => {
  const f = formData($('#pnw')); if (!(f.prenom || '').trim() && !(f.nom || '').trim()) { toast('Indiquez au moins un prénom ou un nom.'); return; }
  const ph = f.phone ? phoneE164(f.phone) : null; if (f.phone && !ph) { toast('Téléphone invalide.'); return; }
  const em = (f.email || '').trim(); if (em && !/^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(em)) { toast('E-mail invalide.'); return; }
  const old = el.dataset.id ? S.prospects[el.dataset.id] : null; const id = old ? old.id : 'pm' + newId();
  const o = { ...(old || {}), id, clubId: old ? old.clubId : CLUB.id, prenom: f.prenom.trim(), nom: f.nom.trim(), phone: ph, email: em || null, provenance: (f.provenance || '').trim(), temp: f.temp, note: (f.note || '').trim() || null, creeLe: old ? old.creeLe : today(), at: old ? old.at : Date.now(), manual: old ? !!old.manual : true, commercialId: old ? old.commercialId || null : ME.id };
  const ops = [[['prospects', id], o]];
  if (!old) ops.push(...relPatch(prospRel(o), { ownerId: ME.id, status: 'todo' }), [['entries', 'pe' + id], { id: 'pe' + id, userId: ME.id, clubId: CLUB.id, kpiId: 'prospects', date: today(), value: 1, source: 'manual', at: Date.now(), by: ME.id }]);
  db.batch(ops); closeModal(); toast(old ? 'Fiche mise à jour' : 'Prospect ajouté : il est dans vos relances');
};

// ── Placer des relances d'un coup ─────────────────────────────────────────
const PR_PERIODS = [['12h', 'Depuis 12 h', 12], ['24h', 'Depuis 24 h', 24], ['48h', 'Depuis 48 h', 48], ['7j', 'Depuis 7 jours', 168], ['14j', 'Depuis 14 jours', 336], ['30j', 'Depuis 30 jours', 720]];
function prPlaceTargets(f) {
  const h = (PR_PERIODS.find(x => x[0] === f.period) || PR_PERIODS[1])[2]; const since = Date.now() - h * 3600000;
  return prospectsOf(CLUB.id).filter(p => prospCreatedAt(p) >= since).filter(p => { const rl = prospRel(p); const s = prospState(p, rl);
    if (['ko', 'stop', 'gagne', 'inscrit'].includes(s)) return false;
    if (f.temp && f.temp !== 'all' && prospTemp(p) !== f.temp) return false;
    if (f.onlyFree && rl.nextAt && rl.nextAt > Date.now()) return false;
    return true; });
}
ACTIONS.prPlace = () => {
  const mgr = isManager(); const team = clubMembers(CLUB.id);
  openModal({ title: 'Placer des relances', drawer: true, body: `<p class="muted small" style="margin-top:0">La même relance est posée sur tous les prospects choisis. Ils remontent dans « À relancer » à l’heure prévue.</p>
    <form id="ppf" class="grid">
    <div><div class="field-label">Prospects créés</div><div class="chips">${PR_PERIODS.map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="period" value="${k}" ${i === 1 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <div><div class="field-label">Température</div><div class="chips">${[['all', 'Toutes'], ...Object.entries(PR_TEMPS).map(([k, t]) => [k, t.label])].map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="temp" value="${k}" ${i ? '' : 'checked'}><span>${l}</span></label>`).join('')}</div></div>
    <label class="pr-check"><input type="checkbox" name="onlyFree" checked><span>Seulement ceux sans relance déjà planifiée</span></label>
    <label class="field"><span>Relancer le</span><input class="input" type="datetime-local" name="at"></label>
    <div class="chips">${[['now', 'Maintenant'], ['14h', 'Aujourd’hui 14 h'], ['18h', 'Aujourd’hui 18 h'], ['demain', 'Demain 10 h']].map(([k, l]) => `<button type="button" class="chip-radio" data-act="prPlaceQuick" data-q="${k}"><span>${l}</span></button>`).join('')}</div>
    <label class="field"><span>Attribuer à</span><select class="input" name="owner"><option value="${ME.id}">Moi</option>${mgr ? `<option value="_spread">Répartir entre les commerciaux</option><option value="_keep">Garder le responsable actuel (sinon moi)</option>${team.filter(u => u.id !== ME.id).map(u => `<option value="${u.id}">${esc(fullName(u))}</option>`).join('')}` : ''}</select></label>
    <p class="pr-count" id="pp-n"></p></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="pp-ok" data-act="prPlaceSave" disabled>Placer les relances</button>`,
    onMount: m => {
      const at = $('[name=at]', m); const d = new Date(Date.now() + 15 * 60000); at.value = `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      const upd = () => { const f = formData($('#ppf', m)); const n = prPlaceTargets(f).length; $('#pp-n', m).textContent = n ? `${plur(n, 'prospect concerné', 'prospects concernés')}` : 'Aucun prospect ne correspond.'; $('#pp-ok', m).disabled = !n || !f.at; };
      m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
    } });
};
ACTIONS.prPlaceQuick = el => {
  const d = new Date(); const q = el.dataset.q; let t;
  if (q === 'now') t = new Date(); else if (q === '14h') t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 14); else if (q === '18h') t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18); else t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10);
  const inp = $('#ppf [name=at]'); inp.value = `${isoOf(t)}T${pad(t.getHours())}:${pad(t.getMinutes())}`; inp.dispatchEvent(new Event('input', { bubbles: true }));
};
ACTIONS.prPlaceSave = () => {
  const f = formData($('#ppf')); const L = prPlaceTargets(f); const at = new Date(f.at).getTime(); if (!L.length || !at) return;
  const pool = clubMembers(CLUB.id).filter(u => u.role === 'membre'); const team = pool.length ? pool : clubMembers(CLUB.id);
  const ops = [];
  L.forEach((p, i) => { const rl = prospRel(p);
    const owner = f.owner === '_spread' ? team[i % team.length].id : f.owner === '_keep' ? rl.ownerId || ME.id : (isManager() ? f.owner : ME.id) || ME.id;
    ops.push(...relPatch(rl, { ownerId: owner, nextAt: at, status: 'todo', plannedBy: ME.id, plannedAt: Date.now() })); });
  db.batch(ops); closeModal(); UI.prVue = at > dateOf(today()).getTime() + 864e5 ? 'planifie' : 'a_faire';
  toast(`${plur(L.length, 'relance placée', 'relances placées')} pour ${relWhen(at)}`); render();
};
