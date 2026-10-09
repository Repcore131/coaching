/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — suivi des dossiers de résiliation ═══════════════════════════
// Données privées (e-mail, téléphone, extrait), rattachement à une fiche client,
// doublons, clôture automatique, retrait visuel avec « Annuler », contact
// (appel, SMS, réponse Gmail), proposition d'offre, validation, conformité.

// ── Données privées : /private/resiliations/{club}/{id}, lues à la demande ──
// Lisibles par le manager du club et le responsable du dossier seulement (règles de la base).
const RES_PRIV = {};
function resPriv(r) { return { ...(deepGet(S, ['private', 'resiliations', r.clubId, r.id]) || {}), ...(RES_PRIV[r.id] || {}) }; }
async function resPrivLoad(r) {
  if (backend.mode !== 'firebase') return resPriv(r);
  if (RES_PRIV[r.id] && RES_PRIV[r.id]._lu) return RES_PRIV[r.id];
  try { const snap = await backend.fb.database().ref(`${sidePaths().private}/resiliations/${r.clubId}/${r.id}`).once('value'); RES_PRIV[r.id] = { ...(snap.val() || {}), _lu: true }; }
  catch (e) { RES_PRIV[r.id] = { _lu: true, _refuse: true }; }
  return RES_PRIV[r.id];
}
function resPrivOps(r, patch) { RES_PRIV[r.id] = { ...(RES_PRIV[r.id] || {}), ...patch }; return Object.entries(patch).map(([k, v]) => [['private', 'resiliations', r.clubId, r.id, k], v == null || v === '' ? null : v]); }
// Téléphone affiché : fiche client rattachée, sinon donnée privée chargée, sinon ancien champ du dossier.
function resTelephone(r) { const c = r.clientId && S.clients[r.clientId]; return (c && (typeof clientPhone === 'function' ? clientPhone(c) : c.phone)) || resPriv(r).phone || r.phone || null; }
function resEmail(r) { const c = r.clientId && S.clients[r.clientId]; return resPriv(r).email || r.email || (c && c.email) || null; }

// ── Rattachement à une fiche client ───────────────────────────────────────
function resMatch(r) { return memo(`resmatch|${r.id}|${r.clientId || ''}`, () => RES_ENGINE.matchClient(S.clients, r.clubId, { email: resEmail(r), clientNum: r.clientNum || r.num, name: r.client })); }
// À la création : lien automatique si la confiance est forte ou moyenne.
function resLienAuto(clubId, q) { const m = RES_ENGINE.matchClient(S.clients, clubId, q); return m.clientId && ['forte', 'moyenne'].includes(m.confidence) ? { clientId: m.clientId, clientConfidence: m.confidence } : {}; }
// L'association recopie le téléphone, l'e-mail et le numéro de la fiche dans le dossier.
function resAssocOps(r, c) {
  return [[['resiliations', r.id, 'clientId'], c.id], [['resiliations', r.id, 'clientConfidence'], 'forte'], [['resiliations', r.id, 'clientNum'], c.num || r.clientNum || null],
    ...resPrivOps(r, { ...(c.phone ? { phone: c.phone } : {}), ...(c.email ? { email: c.email } : {}) }), resLogOp(r, `Fiche client associée : ${c.name || 'client'}`)];
}
ACTIONS.resAssoc = el => { const r = S.resiliations[el.dataset.id]; const c = S.clients[el.dataset.c]; if (!r || !c) return; db.batch(resAssocOps(r, c)); toast(`Dossier associé à la fiche de ${c.name}`); resDedupe(r.clubId); };
ACTIONS.resClientOk = el => { const r = S.resiliations[el.dataset.id]; const c = resClient(r); if (!c) return; db.batch(resAssocOps(r, c)); toast(`Fiche de ${c.name} confirmée`); };
ACTIONS.resCreerFiche = async el => {
  const r = S.resiliations[el.dataset.id]; const p = await resPrivLoad(r); const id = 'c' + newId();
  const c = { id, clubId: r.clubId, name: r.client, num: r.clientNum || null, phone: p.phone || r.phone || null, email: p.email || r.email || null, status: 'Client', createdAt: Date.now(), source: 'resiliation' };
  db.batch([[['clients', id], c], ...resAssocOps(r, c)]); toast(`Fiche de ${r.client} créée et associée`);
};

// ── Doublons (à chaque création) ───────────────────────────────────────────
function resDedupe(clubId) {
  const plan = RES_ENGINE.dedupePlan(S.resiliations, clubId, today(), Date.now()); if (!plan.length) return 0;
  const ops = []; plan.forEach(p => { Object.entries(p.set || {}).forEach(([k, v]) => ops.push([['resiliations', p.id, k], v])); if (p.action) ops.push([['resiliations', p.id, 'log', 'fu' + hkey(p.id + '|' + p.action.fusion)], p.action]); });
  db.batch(ops); return plan.filter(p => p.action).length;
}

// ── Clôture automatique (après chaque import Resamania ; la nuit, côté serveur) ─
function resAutoCloseOps(clubId, maintenant = Date.now()) {
  const plan = RES_ENGINE.autoClosePlan(S.resiliations, clubId, today(), maintenant); const ops = [], undo = [];
  for (const p of plan) {
    const r = S.resiliations[p.id]; const key = 'ac' + hkey(p.id + '|' + p.action.label);
    Object.entries(p.set).forEach(([k, v]) => { ops.push([['resiliations', p.id, k], v]); undo.push([['resiliations', p.id, k], r[k] === undefined ? null : r[k]]); });
    ops.push([['resiliations', p.id, 'log', key], p.action]); undo.push([['resiliations', p.id, 'log', key], null]);
    if (p.proof) {
      const sv = S.entries['sv_' + p.id]; undo.push([['entries', 'sv_' + p.id], sv || null]);
      if (sv) ops.push([['entries', 'sv_' + p.id, 'proof'], 'resamania'], [['entries', 'sv_' + p.id, 'proofAt'], maintenant]);
      else if (r.ownerId) ops.push([['entries', 'sv_' + p.id], { id: 'sv_' + p.id, userId: r.ownerId, clubId, kpiId: 'sauvetage', date: today(), value: 1, source: 'import', at: maintenant, proof: 'resamania' }]);
    }
  }
  return { plan, ops, undo };
}
function resAutoClose(clubId, { silent = false } = {}) {
  const { plan, ops, undo } = resAutoCloseOps(clubId); if (!plan.length) return 0;
  db.batch([...ops, [['clubs', clubId, 'resAutoCloseAt'], Date.now()]]);
  if (!silent) resToastUndo(`${plur(plan.length, 'dossier fermé', 'dossiers fermés')} d’après Resamania`, undo);
  return plan.length;
}

// ── Retrait visuel : la carte affiche l'issue 2 s, puis disparaît ──────────
const RES_VU = { ids: new Set(), hash: '' }; const RES_CLOSING = new Map();
const RES_ISSUE = r => r.outcome === 'suspension' ? 'Suspendue' : r.outcome === 'doublon' ? 'Fusionné' : r.outcome === 'faux_positif' ? 'Ignoré' : r.outcome === 'resiliee' || resStatus(r) === 'resiliee' ? 'Résiliée' : 'Sauvée';
function resFermetures() {
  const ouverts = new Set(resToHandle(CLUB.id).filter(mesDossiersRes).map(r => r.id)); const now = Date.now();
  if (RES_VU.hash === location.hash && !CFG.capture) RES_VU.ids.forEach(id => { const r = S.resiliations[id]; if (!ouverts.has(id) && !RES_CLOSING.has(id) && (!r || resPhase(r) === 'close')) RES_CLOSING.set(id, { at: now, label: r ? RES_ISSUE(r) : 'Clos', client: r ? r.client : '' }); });
  RES_VU.ids = ouverts; RES_VU.hash = location.hash;
  let html = '';
  for (const [id, x] of RES_CLOSING) {
    const age = now - x.at; if (age >= 2200) { RES_CLOSING.delete(id); continue; }
    html += `<div class="card dossier res-closing${age >= 2000 ? ' fade' : ''}" data-closing="${id}"><b>${esc(x.client)}</b><div class="res-issue">${esc(x.label)}</div></div>`;
    if (!x.timer) { x.timer = true; setTimeout(() => { const el = $(`[data-closing="${id}"]`); if (el) el.classList.add('fade'); }, Math.max(0, 2000 - age)); setTimeout(() => { RES_CLOSING.delete(id); const el = $(`[data-closing="${id}"]`); if (el) el.remove(); }, Math.max(0, 2200 - age)); }
  }
  return html;
}
// Toast avec « Annuler » pendant 8 s : rétablit l'état précédent et retire l'action ajoutée.
function resToastUndo(msg, undoOps) {
  if (CFG.capture) return;
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = `<span>${esc(msg)}</span><button type="button" data-undo="1">Annuler</button>`;
  el.style.pointerEvents = 'auto';
  $('button', el).addEventListener('click', () => { db.batch(undoOps); el.remove(); toast('1 action annulée'); });
  $('#toasts').appendChild(el); setTimeout(() => el.remove(), 8000);
}
// Fermeture par l'équipe : champs + action, avec retour arrière.
function resFermer(r, set, label, { extra = {}, ops: plus = [], undo: undoPlus = [], msg } = {}) {
  const key = newId(); const now = Date.now();
  const ops = Object.entries(set).map(([k, v]) => [['resiliations', r.id, k], v]);
  const undo = Object.keys(set).map(k => [['resiliations', r.id, k], r[k] === undefined ? null : r[k]]);
  ops.push([['resiliations', r.id, 'log', key], { at: now, by: ME.id, label, ...extra }]); undo.push([['resiliations', r.id, 'log', key], null]);
  db.batch([...ops, ...plus]); resToastUndo(msg || label, [...undo, ...undoPlus]);
}

// ── À vérifier (score 2) ──────────────────────────────────────────────────
ACTIONS.resVerifOui = el => { const r = S.resiliations[el.dataset.id]; db.batch([[['resiliations', r.id, 'status'], 'nouvelle'], resLogOp(r, 'Confirmée comme demande')]); toast('1 demande ajoutée à la liste à traiter'); resDedupe(r.clubId); };
ACTIONS.resVerifNon = el => { const r = S.resiliations[el.dataset.id]; resFermer(r, { outcome: 'faux_positif', hidden: true, closedAt: Date.now(), closedBy: ME.id, closedReason: 'faux_positif' }, 'Ignorée : pas une demande', { msg: 'Message ignoré' }); };

// ── Contacter : appel, SMS, réponse dans Gmail ────────────────────────────
const resMenuFermer = () => $$('.res-menu').forEach(m => m.remove());
document.addEventListener('click', e => { if (!e.target.closest('.res-menu') && !e.target.closest('[data-act="resContact"]')) resMenuFermer(); }, true);
ACTIONS.resContact = async el => {
  const r = S.resiliations[el.dataset.id]; const ouvert = el.parentElement.querySelector('.res-menu'); resMenuFermer(); if (ouvert) return;
  await resPrivLoad(r); const tel = resTelephone(r); const lien = r.mail && r.mail.link;
  const m = document.createElement('div'); m.className = 'res-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = (tel ? `<button role="menuitem" data-act="resAppeler" data-id="${r.id}">${ico('phone')} Appeler</button><button role="menuitem" data-act="resSms" data-id="${r.id}">${ico('chat')} SMS</button>`
    : `<form class="res-addtel" data-id="${r.id}"><label class="small" for="tel-${r.id}">Ajouter un numéro</label><div class="row" style="gap:6px"><input class="input" id="tel-${r.id}" name="tel" type="tel" inputmode="tel" placeholder="06 00 00 00 00"><button class="btn sm" data-act="resAddTel" data-id="${r.id}">Ajouter</button></div></form>`)
    + (lien ? `<button role="menuitem" data-act="resGmail" data-id="${r.id}">${ico('mail')} Répondre dans Gmail</button>` : '')
    + `<button role="menuitem" data-act="resCall" data-id="${r.id}">${ico('edit')} Noter un échange</button>`;
  el.parentElement.appendChild(m); const first = m.querySelector('button, input'); if (first) first.focus();
};
// Appel : tel:, puis la feuille de résultat au retour sur l'onglet (ou après 2,5 s si l'onglet n'a pas été quitté).
const RES_APPEL = { id: null, t: null };
function resAppelRetour() { if (!RES_APPEL.id || document.hidden) return; const id = RES_APPEL.id; RES_APPEL.id = null; clearTimeout(RES_APPEL.t); if (S.resiliations[id]) ACTIONS.resCall({ dataset: { id } }); }
document.addEventListener('visibilitychange', resAppelRetour);
ACTIONS.resAppeler = el => {
  const r = S.resiliations[el.dataset.id]; const tel = resTelephone(r); resMenuFermer(); if (!tel) return;
  RES_APPEL.id = r.id; const a = document.createElement('a'); a.href = 'tel:' + (phoneE164(tel) || String(tel).replace(/\s/g, '')); a.style.display = 'none'; document.body.appendChild(a);
  try { a.click(); } catch (e) { /* navigateur sans gestionnaire tel: */ } a.remove();
  RES_APPEL.t = setTimeout(resAppelRetour, 2500);
};
ACTIONS.resSms = el => {
  const r = S.resiliations[el.dataset.id]; const tel = resTelephone(r); resMenuFermer(); if (!tel) return;
  const f = resRemplir('sms1', r); const a = document.createElement('a'); a.href = `sms:${phoneE164(tel) || String(tel).replace(/\s/g, '')}?body=${encodeURIComponent(f.text)}`; a.style.display = 'none'; document.body.appendChild(a);
  try { a.click(); } catch (e) { /* pas d'application SMS */ } a.remove();
  db.batch([resLogOp(r, 'SMS préparé (modèle 1)')]);
};
ACTIONS.resAddTel = el => {
  const r = S.resiliations[el.dataset.id]; const v = ($(`#tel-${r.id}`) || {}).value || ''; const ph = phoneE164(v); if (!ph) { toast('Numéro invalide.'); return; }
  db.batch([...resPrivOps(r, { phone: ph }), resLogOp(r, 'Numéro ajouté')]); resMenuFermer(); toast('1 numéro ajouté');
};
// Fil de la boîte accueil : nouvel onglet ; en démonstration, une explication.
function resOuvrirFil(r) {
  const lien = r.mail && r.mail.link; if (!lien) return false;
  if (lien === '#demo') { openModal({ title: 'Ouvrir le fil', body: '<p>En production, ce bouton ouvre le fil dans la boîte Gmail de l’accueil.</p>', foot: '<button class="btn primary" data-close>Compris</button>' }); return true; }
  if (/^https:\/\//.test(lien)) { window.open(lien, '_blank', 'noopener'); return true; }
  return false;
}
ACTIONS.resFil = el => { const r = S.resiliations[el.dataset.id]; resOuvrirFil(r); };
ACTIONS.resGmail = el => { const r = S.resiliations[el.dataset.id]; resMenuFermer(); if (resOuvrirFil(r)) db.batch([resLogOp(r, 'Réponse en cours dans Gmail'), [['resiliations', r.id, 'ownerId'], r.ownerId || ME.id]]); };

// ── Proposer une offre ────────────────────────────────────────────────────
function resOffreApercu(r, offre, canal) { const f = resRemplir(canal === 'sms' ? 'sms3' : 'email3', r, { offre }); return resTplMontrer(f, { fil: canal === 'mail' && r.mail && r.mail.link ? r.id : null }); }
ACTIONS.resOffer = el => {
  const r = S.resiliations[el.dataset.id]; const offres = RES_OFFERS.filter(o => o !== 'Aucune'); const canal = r.mail ? 'mail' : 'sms';
  openModal({ title: `Proposer une offre · ${r.client}`, body: `<form id="rof" class="grid" data-id="${r.id}">
    <label class="field"><span>Offre</span><select class="input" name="offer" data-change="resOfferMaj">${offres.map(o => `<option>${esc(o)}</option>`).join('')}</select></label>
    <div class="field"><span>Message</span><div class="chips"><label class="chip-radio"><input type="radio" name="canal" value="mail" data-change="resOfferMaj" ${canal === 'mail' ? 'checked' : ''}><span>E-mail 3</span></label><label class="chip-radio"><input type="radio" name="canal" value="sms" data-change="resOfferMaj" ${canal === 'sms' ? 'checked' : ''}><span>SMS 3</span></label></div></div>
    <div id="rof-apercu">${resOffreApercu(r, offres[0], canal)}</div></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn" data-act="resOfferAccept" data-id="${r.id}">Offre acceptée</button><button class="btn primary" data-act="resOfferSave" data-id="${r.id}">Enregistrer la proposition</button>` });
};
ACTIONS.resOfferMaj = () => { const fm = $('#rof'); if (!fm) return; const r = S.resiliations[fm.dataset.id]; const f = formData(fm); $('#rof-apercu').innerHTML = resOffreApercu(r, f.offer, f.canal); };
ACTIONS.resOfferSave = el => {
  const r = S.resiliations[el.dataset.id]; const f = formData($('#rof')); const offre = f.offer; if (!offre) return;
  const rk = relKey('resiliation', r.id, r.date);
  db.batch([resLogOp(r, 'Offre proposée : ' + offre, { offer: offre, out: 'offer', canal: f.canal }), [['resiliations', r.id, 'status'], 'traitement'], [['resiliations', r.id, 'ownerId'], r.ownerId || ME.id],
    [['relances', rk, 'nextAt'], Date.now() + 2 * 864e5], [['relances', rk, 'ownerId'], r.ownerId || ME.id], [['relances', rk, 'note'], 'Relance de l’offre : ' + offre]]);
  closeModal(); toast('Offre notée, relance dans 2 jours');
};
ACTIONS.resOfferAccept = el => { const offre = formData($('#rof')).offer; ACTIONS.resSaveIt(el); const s = $('#rsf select[name=offer]'); if (s) s.value = offre; };

// ── Valider la résiliation (ou la suspension) ─────────────────────────────
const finMoisSuivant = (d = today()) => { const [y, m] = d.split('-').map(Number); const n = new Date(Date.UTC(y, m + 1, 0)); return n.toISOString().slice(0, 10); };
function resValidApercu(r, f) { return r.type === 'suspension' ? '' : resTplMontrer(resRemplir('email2', r, { date_fin: f.effective, dernier_prelevement: f.dernier }), { fil: r.mail && r.mail.link ? r.id : null }); }
ACTIONS.resValidate = el => {
  const r = S.resiliations[el.dataset.id]; const susp = r.type === 'suspension'; const eff = r.effective || finMoisSuivant();
  openModal({ title: `${susp ? 'Valider la suspension' : 'Valider la résiliation'} · ${r.client}`, body: `<form id="rvf" class="form-grid" data-id="${r.id}">
    <label class="field"><span>${susp ? 'Reprise prévue le' : 'Date d’effet'}</span><input class="input" type="date" name="effective" value="${eff}" data-change="resValidMaj"></label>
    ${susp ? '' : `<label class="field"><span>Dernier prélèvement</span><input class="input" type="date" name="dernier" value="${r.dernierPrelevement || ''}" data-change="resValidMaj"></label>`}
    <label class="field full"><span>Motif</span><select class="input" name="reason">${RES_REASONS.map(o => `<option ${o === (r.reason || 'Autre') ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label></form>
    ${susp ? '<p class="muted small">La suspension garde l’adhérent : le dossier passe en « Suspendue ».</p>' : `<h4 style="margin:12px 0 6px">Confirmation à envoyer (e-mail 2)</h4><div id="rvf-apercu">${resValidApercu(r, { effective: eff, dernier: r.dernierPrelevement || '' })}</div>`}`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resValidateOk" data-id="${r.id}">${susp ? 'Valider la suspension' : 'Valider la résiliation'}</button>` });
};
ACTIONS.resValidMaj = () => { const fm = $('#rvf'); if (!fm || !$('#rvf-apercu')) return; const r = S.resiliations[fm.dataset.id]; $('#rvf-apercu').innerHTML = resValidApercu(r, formData(fm)); };
ACTIONS.resValidateOk = el => { resValider(S.resiliations[el.dataset.id], formData($('#rvf'))); closeModal(); };
function resValider(r, f) {
  const now = Date.now(); const susp = r.type === 'suspension';
  const sv = S.entries['sv_' + r.id];
  if (susp) resFermer(r, { status: 'sauvee', saved: true, outcome: 'suspension', reprise: f.effective || null, reason: f.reason, closedAt: now, closedBy: ME.id, closedReason: 'fitpulse', ownerId: r.ownerId || ME.id }, 'Suspension validée', { msg: 'Suspension validée' });
  else resFermer(r, { status: 'resiliee', saved: false, outcome: 'resiliee', effective: f.effective || r.effective || null, dateFin: f.effective || null, dernierPrelevement: f.dernier || null, reason: f.reason, validatedAt: now, closedAt: now, closedBy: ME.id, closedReason: 'fitpulse', ownerId: r.ownerId || ME.id },
    'Résiliation validée, confirmation à envoyer', { ops: [[['entries', 'sv_' + r.id], null]], undo: [[['entries', 'sv_' + r.id], sv || null]], msg: 'Résiliation validée' });
}

// ── Obligation de confirmation écrite (point 13) ───────────────────────────
// Résiliation validée depuis plus de 24 h, demande arrivée par e-mail, aucune réponse lue dans le fil depuis.
const resConfirmee = r => RES_ENGINE.confirmee(r);
const resConformite = (clubId, maintenant = Date.now()) => RES_ENGINE.conformite(S.resiliations, clubId, maintenant);
function resConfirmationsDues(list) {
  const L = list.filter(r => r.outcome === 'resiliee' && r.mail && r.validatedAt && Date.now() - r.validatedAt > 24 * 3600000 && !resConfirmee(r) && (isManager() || r.ownerId === ME.id));
  return L.length ? `<div class="alert warn" data-confirmation-due="${L.length}" style="margin-bottom:12px">${ico('alert')}<div>Confirmation de résiliation non envoyée : ${L.map(r => `<a href="#" data-act="resOpen" data-id="${r.id}">${esc(RES_ENGINE.nomCourt(r.client))}</a>`).join(', ')}. L’adhérent doit recevoir une confirmation écrite.</div></div>` : '';
}

// ── Fiche client : ses dossiers de résiliation ────────────────────────────
function resDossiersClient(c) {
  const L = resList(c.clubId).filter(r => r.clientId === c.id || (!r.clientId && resClient(r) === c)).sort((a, b) => (resReceivedAt(b) || 0) - (resReceivedAt(a) || 0));
  if (!L.length) return '';
  return `<div class="card" data-res-client="${L.length}"><h3>Demandes de résiliation</h3>${L.map(r => { const ph = resPhase(r); const rec = resReceivedAt(r);
    return `<div class="row wrap rel-mini"><span class="badge ${ph === 'close' ? RES_STATUS[resStatus(r)].cls : RES_PHASE[ph].cls}">${ph === 'close' ? (r.outcome === 'suspension' ? 'Suspendue' : RES_STATUS[resStatus(r)].label) : RES_PHASE[ph].label}</span><span class="spacer small">${rec ? 'reçue le ' + dmy(isoOf(new Date(rec))) : dmy(r.date)} · ${esc(RES_ENGINE.sourceLabel(r))}${r.reason ? ' · ' + esc(r.reason) : ''}</span>${mesDossiersRes(r) ? `<button class="btn sm" data-act="resOpen" data-id="${r.id}">Ouvrir</button>` : ''}</div>`; }).join('')}</div>`;
}
