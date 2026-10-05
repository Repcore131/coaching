'use strict';
// ══ FIT PULSE — relances : un seul modèle, une file d'appels, un journal ════
// Les relances sont calculées à la volée depuis les fiches clients, les
// impayés et les résiliations (rien à synchroniser). Leur état de suivi
// (responsable, prochaine action, tentatives, issue) vit dans S.relances,
// et chaque contact dans S.touches. Les anciennes collections (S.loyalty,
// historique des résiliations et des impayés) restent écrites pour que les
// pages Rétention, Résiliations et Impayés montrent la même chose.

// ── Téléphone ─────────────────────────────────────────────────────────────
function phoneE164(raw) {
  if (raw == null) return null;
  let s = String(raw).trim().replace(/[\s.\-()/]/g, '');
  if (!s) return null;
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (/^0[1-9]\d{8}$/.test(s)) s = '+33' + s.slice(1);
  if (/^[1-9]\d{8}$/.test(s)) s = '+33' + s;
  if (!/^\+\d{9,15}$/.test(s)) return null;
  return s;
}
function phoneFmt(e164) {
  if (!e164) return '';
  if (e164.startsWith('+33') && e164.length === 12) return ('0' + e164.slice(3)).replace(/(\d{2})(?=\d)/g, '$1 ');
  return e164;
}
const clientPhone = c => c && !c.phoneBad ? phoneE164(c.phone) : null;

// ── Issues de contact, communes à toutes les relances ─────────────────────
const TOUCH_OUTCOMES = {
  joint: { label: 'Joint', reached: true },
  messagerie: { label: 'Messagerie', reached: false },
  pasreponse: { label: 'Pas de réponse', reached: false },
  mauvaisnumero: { label: 'Mauvais numéro', reached: false },
  rappeler: { label: 'Rappeler le', reached: true },
  promesse: { label: 'Promesse de paiement', reached: true },
  rdv: { label: 'Rendez-vous', reached: true },
  paye: { label: 'Payé', reached: true, win: true },
  sauve: { label: 'Sauvé', reached: true, win: true },
  ok: { label: 'Fait', reached: true, win: true },
  refus: { label: 'Refus', reached: true, lose: true },
  stop: { label: 'Ne plus contacter', reached: true, lose: true },
  envoye: { label: 'Message envoyé', reached: false },
};
const REL_KINDS = {
  resiliation: { label: 'Résiliation', base: 60, icon: 'door' },
  impaye: { label: 'Impayé', base: 50, icon: 'coins' },
  fincontrat: { label: 'Fin de contrat', base: 40, icon: 'repeat' },
  mandat: { label: 'Sans mandat', base: 35, icon: 'bank' },
  suivi15: { label: 'Suivi J+15', base: 32, icon: 'phone' },
  suivi30: { label: 'Suivi J+30', base: 30, icon: 'phone' },
  anniversaire: { label: 'Anniversaire', base: 15, icon: 'cake' },
};
const KIND_OUTCOMES = {
  impaye: ['promesse', 'paye'], resiliation: ['sauve'], suivi15: ['rdv'], suivi30: ['rdv'],
  fincontrat: ['ok'], mandat: ['ok'], anniversaire: ['ok'],
};
const REFUS_MOTIFS = {
  resiliation: () => RES_REASONS,
  impaye: () => ['Conteste la dette', 'Difficultés financières', 'Ne répond plus', 'Déjà payé'],
  fincontrat: () => ['Prix', 'Déménagement', 'Concurrence', 'Ne vient plus', 'Santé', 'Autre'],
};
// Cadences : étapes après une tentative non jointe (jours après l'ancre ou la tentative).
const CADENCES = {
  impaye: [{ d: 0, ch: 'call' }, { d: 0, ch: 'sms' }, { d: 2, ch: 'call' }, { d: 5, ch: 'whatsapp' }, { d: 9, ch: 'call' }, { d: 14, ch: 'email' }],
  mandat: [{ d: 0, ch: 'call' }, { d: 2, ch: 'sms' }, { d: 7, ch: 'call' }, { d: 14, ch: 'call' }],
  resiliation: [{ d: 0, ch: 'call' }, { d: 1, ch: 'call' }, { d: 3, ch: 'sms' }, { d: 5, ch: 'call' }, { d: 7, ch: 'call' }],
  fincontrat: [{ d: 0, ch: 'call' }, { d: 9, ch: 'sms' }, { d: 16, ch: 'call' }, { d: 23, ch: 'call' }, { d: 28, ch: 'sms' }],
  suivi15: [{ d: 0, ch: 'call' }, { d: 1, ch: 'sms' }, { d: 3, ch: 'call' }],
  suivi30: [{ d: 0, ch: 'call' }, { d: 1, ch: 'sms' }, { d: 3, ch: 'call' }],
  anniversaire: [{ d: 0, ch: 'sms' }],
};
const relCfg = clubId => ({ lockMinutes: 15, quietFrom: '09:00', quietTo: '20:00', sundayOff: true, ...(deepGet(S, ['relanceCfg', clubId]) || {}) });

// ── Les relances du club ──────────────────────────────────────────────────
const relKey = (kind, ref, anchor) => safeKey(`${kind}_${ref}_${anchor || ''}`);
function relancesFor(clubId) {
  return memo(`rel|${clubId}`, () => {
    const t = today(); const out = [];
    const add = (kind, o) => { const key = relKey(kind, o.clientId || o.refId, o.anchor); const st = deepGet(S, ['relances', key]) || {}; out.push({ key, kind, clubId, ...o, ...st, st }); };
    for (const c of Object.values(S.clients || {})) {
      if (c.clubId !== clubId || (c.status && /ancien|perdu|prospect|exclu|temporaire/.test(norm(c.status)))) continue;
      if (c.optOutCall && c.optOutSms) continue;
      if (c.start) {
        const age = Math.round((dateOf(t) - dateOf(c.start)) / 86400000);
        if (age >= 13 && age <= 20) add('suivi15', { clientId: c.id, anchor: c.start, due: addDays(c.start, 15), reason: `adhérent depuis le ${dm(c.start)}` });
        if (age >= 28 && age <= 40) add('suivi30', { clientId: c.id, anchor: c.start, due: addDays(c.start, 30), reason: `un mois au club depuis le ${dm(c.start)}` });
      }
      if (c.end && c.end >= t && c.end <= addDays(t, 45)) add('fincontrat', { clientId: c.id, anchor: c.end, due: addDays(c.end, -30), reason: `fin de contrat le ${dm(c.end)}` });
      if (c.birth) { const y = t.slice(0, 4); let bd = `${y}-${c.birth.slice(-5)}`; if (bd < t) bd = `${Number(y) + 1}-${c.birth.slice(-5)}`; if (bd <= addDays(t, 7)) add('anniversaire', { clientId: c.id, anchor: bd, due: bd, reason: `anniversaire le ${dm(bd)}` }); }
      if (Number(c.balance) > 0) add('impaye', { clientId: c.id, anchor: c.balanceAt || 'x', due: c.balanceAt || t, amount: Number(c.balance), reason: `${fmtE(Number(c.balance))} dus${c.balanceAt ? ' depuis le ' + dm(c.balanceAt) : ''}`, ownerHint: dunOf(c).ownerId || null });
      if (c.noMandate) add('mandat', { clientId: c.id, anchor: c.noMandateAt || 'x', due: t, reason: 'abonnement sans mandat de prélèvement' });
    }
    const byName = {}; Object.values(S.clients || {}).filter(c => c.clubId === clubId).forEach(c => { byName[tokensKey(c.name || '')] = c; });
    for (const r of resToHandle(clubId)) {
      const c = r.clientId ? S.clients[r.clientId] : byName[tokensKey(r.client || '')];
      const n = daysTo(r.effective);
      add('resiliation', { refId: r.id, clientId: c ? c.id : null, clientName: r.client, anchor: r.date, due: r.date, effective: r.effective, reason: `demande du ${dm(r.date)}${n != null ? ` · effective ${n <= 0 ? 'maintenant' : 'dans ' + plur(n, 'jour', 'jours')}` : ''}`, ownerHint: r.ownerId || null });
    }
    // responsable par défaut : celui du dossier, sinon le vendeur s'il est membre actif
    out.forEach(rl => {
      const c = rl.clientId ? S.clients[rl.clientId] : null;
      rl.client = c; rl.name = c ? c.name : rl.clientName || 'Client';
      if (!rl.ownerId) rl.ownerId = rl.ownerHint || (['suivi15', 'suivi30', 'fincontrat'].includes(rl.kind) && c && c.sellerId && S.users[c.sellerId] && isActive(S.users[c.sellerId]) ? c.sellerId : null);
      rl.touches = touchesOf(rl.key);
      rl.attempts = rl.attempts || rl.touches.filter(x => x.channel === 'call' && !(TOUCH_OUTCOMES[x.outcome] || {}).reached).length;
      rl.status = rl.status || 'todo';
      rl.score = relScore(rl);
    });
    return out.filter(rl => !['gagne', 'perdu', 'annule'].includes(rl.status));
  });
}
const touchesOf = key => Object.values(S.touches || {}).filter(x => x.relKey === key).sort((a, b) => b.at - a.at);
function relScore(rl) {
  let s = REL_KINDS[rl.kind].base;
  if (rl.kind === 'impaye') s += Math.min(30, (rl.amount || 0) / 10);
  if (rl.kind === 'resiliation') { const n = daysTo(rl.effective); if (n != null && n <= 7) s += 40; }
  if (rl.nextAt && rl.nextAt <= Date.now()) s += 40;
  if (rl.due && rl.due < today()) s += Math.min(30, 3 * Math.round((dateOf(today()) - dateOf(rl.due)) / 86400000));
  s -= 5 * (rl.attempts || 0);
  return Math.round(s);
}
// Une ligne par client : plusieurs motifs ouverts = un seul appel.
function relQueue(clubId, scope = 'mine') {
  const now = Date.now(), endDay = dateOf(today()).getTime() + 86400000;
  const all = relancesFor(clubId).filter(rl => scope === 'all' || (scope === 'mine' ? rl.ownerId === ME.id : !rl.ownerId));
  const groups = {};
  all.forEach(rl => { const g = rl.clientId || 'r:' + rl.refId; (groups[g] = groups[g] || []).push(rl); });
  const rows = Object.values(groups).map(list => {
    list.sort((a, b) => b.score - a.score);
    const next = Math.min(...list.map(rl => rl.nextAt || 0));
    return { list, top: list[0], score: Math.max(...list.map(rl => rl.score)), next, client: list[0].client, name: list[0].name, phone: clientPhone(list[0].client), lastTouch: list.flatMap(rl => rl.touches)[0] || null };
  });
  const now_ = rows.filter(r => !r.next || r.next <= now).sort((a, b) => b.score - a.score);
  return {
    now: now_.filter(r => r.phone || !r.client),
    nophone: now_.filter(r => r.client && !r.phone),
    later: rows.filter(r => r.next > now && r.next < endDay).sort((a, b) => a.next - b.next),
    count: rows.length,
  };
}

// ── Modèles de messages et scripts d'appel ────────────────────────────────
const TPL_DEFAULT = {
  suivi15: { sms: 'Bonjour {prenom}, c’est {commercial} du Fitness Park {club}. J’ai essayé de vous joindre pour savoir comment se passent vos débuts. Une question, un besoin ? Répondez ici, je vous rappelle.',
    script: ['Bonjour {prenom}, c’est {commercial} du Fitness Park {club}. Je vous appelle pour savoir comment se passent vos deux premières semaines. Vous avez deux minutes ?', 'Vous venez combien de fois par semaine ? Vous avez trouvé vos repères sur les machines ? Vous avez déjà fait votre séance avec un coach ?', 'Je vous propose un créneau avec un coach pour caler un programme. Plutôt en semaine ou le week-end ?'] },
  suivi30: { sms: 'Bonjour {prenom}, déjà un mois au Fitness Park {club}. Envie d’un point avec un coach pour garder le rythme ? Répondez OUI et je vous propose un créneau. {commercial}',
    script: ['Bonjour {prenom}, {commercial} du Fitness Park {club}. Ça fait un mois que vous êtes avec nous, je voulais faire le point.', 'Vous atteignez ce que vous visiez en vous inscrivant ? Qu’est-ce qui vous aiderait à venir plus souvent ? Vous connaissez quelqu’un qui aimerait essayer ?', 'Je peux lui offrir une séance découverte. Vous me donnez son prénom et son numéro ?'] },
  anniversaire: { sms: 'Joyeux anniversaire {prenom} ! Toute l’équipe du Fitness Park {club} vous souhaite une belle journée. Une petite attention vous attend à l’accueil cette semaine.',
    script: ['Bonjour {prenom}, c’est {commercial} du Fitness Park {club}. On voulait simplement vous souhaiter un bon anniversaire de la part de toute l’équipe.', '', 'Passez nous voir à l’accueil cette semaine, on a une petite attention pour vous.'] },
  fincontrat: { sms: 'Bonjour {prenom}, votre engagement {offre} se termine le {date_fin}. Renouvelez avant cette date pour garder vos conditions. Je reste disponible pour en parler. {commercial}, Fitness Park {club}',
    script: ['Bonjour {prenom}, {commercial} du Fitness Park {club}. Votre engagement {offre} arrive à échéance le {date_fin}, je voulais anticiper avec vous.', 'Comment s’est passée cette année ? Vous comptez continuer ? Votre formule correspond toujours à votre pratique ?', 'Si vous renouvelez avant le {date_fin}, je vous garde les conditions actuelles. On le fait ensemble à l’accueil ou par téléphone ?'] },
  impaye: { sms: 'Bonjour {prenom}, un prélèvement de {montant} n’a pas pu être effectué sur votre abonnement Fitness Park {club}. Vous pouvez régulariser à l’accueil. Merci, {commercial}',
    script: ['Bonjour {prenom}, {commercial} du Fitness Park {club}. Je vous appelle au sujet d’un prélèvement qui n’est pas passé, pour un montant de {montant}. Ça arrive souvent, je voulais simplement régler ça avec vous.', 'Vous étiez au courant ? Votre carte ou votre compte a changé récemment ?', 'Vous pouvez régler à l’accueil lors de votre prochaine séance. À quelle date je peux noter le règlement ?'] },
  mandat: { sms: 'Bonjour {prenom}, il manque le mandat de prélèvement sur votre abonnement Fitness Park {club}. Passez à l’accueil avec votre RIB, cela prend deux minutes.',
    script: ['Bonjour {prenom}, {commercial} du Fitness Park {club}. Il manque le mandat de prélèvement sur votre abonnement, ce qui peut bloquer votre accès.', '', 'Ça prend deux minutes à l’accueil avec votre RIB. Vous passez quand cette semaine ?'] },
  resiliation: { sms: 'Bonjour {prenom}, j’ai bien reçu votre demande. Avant de la traiter, j’aimerais en parler deux minutes avec vous. Quand puis-je vous appeler ? {commercial}, Fitness Park {club}',
    script: ['Bonjour {prenom}, {commercial} du Fitness Park {club}. J’ai bien reçu votre demande de résiliation. Avant de la traiter, je voulais comprendre ce qui vous amène à arrêter.', 'Qu’est-ce qui a changé pour vous ? Si on trouvait une solution à ce point, vous resteriez ?', 'Prix : une formule plus adaptée. Manque de temps ou santé : une suspension plutôt qu’un arrêt. Insatisfaction : une séance avec un coach. Toujours finir par : je note votre décision et je vous confirme par SMS.'] },
};
const MARKETING = ['anniversaire', 'suivi30'];
function tplFor(kind, ch) {
  const custom = Object.values(S.templates || {}).find(t => t.active !== false && t.kind === kind && t.channel === ch && (!t.clubId || t.clubId === CLUB.id));
  if (custom) return custom.body;
  const d = TPL_DEFAULT[kind] || {};
  if (ch === 'script') return d.script || ['', '', ''];
  let b = d.sms || '';
  if (MARKETING.includes(kind)) b += ' ' + (relCfg(CLUB.id).smsFooter || 'Répondez STOP pour ne plus recevoir ces messages.');
  return b;
}
function tplCtx(rl) {
  const c = rl.client || {};
  return { prenom: (c.name || rl.name || '').split(' ')[0] || '', nom: c.name || rl.name || '', club: (CLUB.name || '').replace(/^Fitness Park\s*/i, ''), commercial: ME.first || '', montant: rl.amount ? fmtE(rl.amount) : '', date_fin: c.end ? dmy(c.end) : '', offre: c.offer || '' };
}
function fillTemplate(body, ctx) {
  const missing = [];
  const out = String(body).replace(/\{([a-z_]+)\}/g, (m, k) => { const v = ctx[k]; if (v == null || v === '') { missing.push(k); return `[${k} manquant]`; } return v; });
  return { text: out, missing };
}
function contactLinks(rl, text = '') {
  const p = clientPhone(rl.client); const e = rl.client && rl.client.email;
  return {
    tel: p ? `tel:${p}` : null,
    sms: p ? `sms:${p}?&body=${encodeURIComponent(text)}` : null,
    wa: p ? `https://wa.me/${p.replace('+', '')}?text=${encodeURIComponent(text)}` : null,
    mail: e ? `mailto:${e}?subject=${encodeURIComponent('Fitness Park ' + (CLUB.name || ''))}&body=${encodeURIComponent(text)}` : null,
  };
}

// ── Écritures : état de la relance et journal ─────────────────────────────
function relPatch(rl, patch) { const ops = []; for (const [k, v] of Object.entries(patch)) ops.push([['relances', rl.key, k], v]); ops.push([['relances', rl.key, 'kind'], rl.kind], [['relances', rl.key, 'clubId'], rl.clubId]); return ops; }
function touchOp(rl, o) { const id = newId(); return [['touches', id], { id, clubId: rl.clubId, clientId: rl.clientId || null, refId: rl.refId || null, relKey: rl.key, kind: rl.kind, at: Date.now(), by: ME.id, ...o }]; }
// Prochaine étape de cadence, ramenée dans les horaires autorisés (4 h mini entre deux appels).
function nextStepAt(rl, step) {
  const cad = CADENCES[rl.kind] || [{ d: 1 }]; const st = cad[step]; if (!st) return null;
  const cfg = relCfg(rl.clubId);
  let at = Math.max(Date.now() + (st.ch === 'call' ? 4 * 3600000 : 0), dateOf(addDays(today(), st.d)).getTime() + 10 * 3600000);
  for (let i = 0; i < 8; i++) {
    const d = new Date(at); const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (cfg.sundayOff && d.getDay() === 0) { at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10).getTime(); continue; }
    if (hm < cfg.quietFrom) { at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(cfg.quietFrom.slice(0, 2)), Number(cfg.quietFrom.slice(3))).getTime(); continue; }
    if (hm > cfg.quietTo) { at = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10).getTime(); continue; }
    break;
  }
  return at;
}
function quietNow(clubId) { const cfg = relCfg(clubId); const d = new Date(); const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`; return (cfg.sundayOff && d.getDay() === 0) || hm < cfg.quietFrom || hm > cfg.quietTo; }

// ── Page Relances : file d'appels ─────────────────────────────────────────
PAGES.relances = {
  title: 'Relances',
  render() {
    const seg0 = UI.relSeg || 'file';
    const scope = UI.relScope || (isManager() ? 'all' : 'mine');
    const head = `<div class="page-head"><div><h1>Relances</h1><p>Une seule liste, triée par urgence : appeler, noter, passer au suivant.</p></div><span class="spacer"></span>${seg0 === 'file' ? '<button class="btn primary" data-act="relSession">Démarrer la session</button>' : ''}</div>
      ${tabs('relSeg', [['file', 'File d’appels'], ['resiliations', 'Résiliations'], ['impayes', 'Impayés'], ['retention', 'Rétention']], seg0)}`;
    if (seg0 === 'resiliations') return head + PAGES.resiliations.render().replace(/^<div class="page-head">[\s\S]*?<\/div>\s*<\/div>/, '');
    if (seg0 === 'impayes') return head + PAGES.impayes.render().replace(/^<div class="page-head">[\s\S]*?<\/div>\s*<\/div>/, '');
    if (seg0 === 'retention') return head + PAGES.loyalty.render().replace(/^<div class="page-head">[\s\S]*?<\/div>\s*<\/div>/, '');
    const Q = relQueue(CLUB.id, scope);
    const kf = UI.relKind || 'all';
    const f = rows => rows.filter(r => kf === 'all' || r.list.some(rl => rl.kind === kf));
    const counts = {}; relQueue(CLUB.id, scope).now.forEach(r => r.list.forEach(rl => { counts[rl.kind] = (counts[rl.kind] || 0) + 1; }));
    return head + `<div class="rel-tiles"><div><b>${Q.now.length}</b><span>à appeler maintenant</span></div><div><b>${Q.later.length}</b><span>rappels plus tard aujourd’hui</span></div><div><b>${Q.nophone.length}</b><span>sans téléphone</span></div></div>
      <div class="row wrap" style="gap:8px;margin:12px 0">${seg('relScope', [['mine', 'Mes relances'], ['nobody', 'Non attribuées'], ['all', 'Tout le club']], scope)}
        <div class="chips">${[['all', 'Tout'], ...Object.entries(REL_KINDS).filter(([k]) => counts[k]).map(([k, v]) => [k, `${v.label} ${counts[k]}`])].map(([k, l]) => `<button class="chip-radio ${kf === k ? 'on' : ''}" data-act="ui" data-key="relKind" data-val="${k}"><span>${l}</span></button>`).join('')}</div></div>
      ${f(Q.now).length ? `<div class="rel-list">${f(Q.now).map(relRow).join('')}</div>` : emptyBox({ art: 'done', title: scope === 'mine' ? 'Aucune relance à votre nom' : 'Tout est à jour', text: scope === 'mine' ? 'Prenez une relance non attribuée.' : 'Revenez après le prochain import Resamania.', cta: scope === 'mine' ? '<button class="btn primary sm" data-act="ui" data-key="relScope" data-val="nobody">Voir les non attribuées</button>' : '' })}
      ${Q.later.length ? `<h3 class="rel-h">Rappels plus tard aujourd’hui</h3><div class="rel-list">${Q.later.map(relRow).join('')}</div>` : ''}
      ${Q.nophone.length ? `<details class="card rel-nophone"><summary><b>Sans téléphone · ${Q.nophone.length}</b> <span class="muted small">ajoutez le numéro pour pouvoir appeler</span></summary><div class="rel-list">${Q.nophone.map(relRow).join('')}</div></details>` : ''}`;
  },
};
function relRow(r) {
  const rl = r.top; const kinds = [...new Set(r.list.map(x => x.kind))];
  const lock = r.list.find(x => x.claimedBy && x.claimedBy !== ME.id && (x.claimedUntil || 0) > Date.now());
  const owner = rl.ownerId && S.users[rl.ownerId] ? S.users[rl.ownerId].first : null;
  const L = contactLinks(rl);
  const last = r.lastTouch;
  return `<div class="rel-row ${lock ? 'locked' : ''}">
    <div class="rel-main"><div class="rel-name"><a href="#/client/${esc(rl.clientId || '')}" ${rl.clientId ? '' : 'onclick="return false"'}><b>${esc(r.name)}</b></a>${kinds.map(k => `<span class="tag ${k === 'resiliation' || k === 'impaye' ? 'is-warn' : ''}">${REL_KINDS[k].label}</span>`).join('')}</div>
      <div class="muted small">${r.list.map(x => esc(x.reason)).join(' · ')}</div>
      <div class="muted small">${owner ? 'Responsable : ' + esc(owner) : 'Non attribuée'}${rl.attempts ? ` · ${plur(rl.attempts, 'tentative', 'tentatives')}` : ''}${last ? ` · dernier contact ${ago(last.at)} : ${esc((TOUCH_OUTCOMES[last.outcome] || {}).label || last.outcome)}` : ''}${r.next > Date.now() ? ` · rappel à ${new Date(r.next).toTimeString().slice(0, 5)}` : ''}${lock ? ` · <b>en cours par ${esc((S.users[lock.claimedBy] || {}).first || 'un collègue')}</b>` : ''}</div></div>
    <div class="rel-acts">
      ${r.phone ? `<a class="btn primary rel-call" href="${L.tel}" data-act="relCall" data-key="${rl.key}" aria-label="Appeler ${esc(r.name)}">${ico('phone')}<span>Appeler</span></a>` : rl.client ? `<button class="btn sm" data-act="relPhone" data-id="${rl.clientId}">${ico('plus')} Ajouter le numéro</button>` : ''}
      ${r.phone ? `<button class="btn icon" data-act="relMsg" data-key="${rl.key}" data-ch="sms" aria-label="SMS" ${rl.client.optOutSms ? 'disabled title="Opposé aux SMS"' : ''}>${ico('chat')}</button><button class="btn icon" data-act="relMsg" data-key="${rl.key}" data-ch="whatsapp" aria-label="WhatsApp" ${rl.client.optOutSms ? 'disabled' : ''}>${ico('send')}</button>` : ''}
      ${rl.client && rl.client.email ? `<button class="btn icon" data-act="relMsg" data-key="${rl.key}" data-ch="email" aria-label="E-mail">${ico('mail')}</button>` : ''}
      <button class="btn sm" data-act="relNote" data-key="${rl.key}">Noter</button>
      ${!rl.ownerId ? `<button class="btn sm ghost" data-act="relTake" data-key="${rl.key}">Je m’en occupe</button>` : ''}
    </div></div>`;
}
const relByKey = key => relancesFor(CLUB.id).find(rl => rl.key === key) || null;
ACTIONS.relTake = el => { const rl = relByKey(el.dataset.key); if (!rl) return; const ops = relPatch(rl, { ownerId: ME.id }); if (rl.kind === 'impaye' && rl.client) ops.push(dunPatch(rl.client, { ownerId: ME.id }, 'Prise en charge')); if (rl.kind === 'resiliation') ops.push([['resiliations', rl.refId, 'ownerId'], ME.id]); db.batch(ops); toast('Relance ajoutée à votre liste'); };
ACTIONS.relPhone = el => {
  const c = S.clients[el.dataset.id];
  openModal({ title: `Téléphone · ${esc(c.name)}`, body: `<label class="field"><span>Numéro</span><input class="input" id="rp" type="tel" inputmode="tel" autocomplete="tel" placeholder="06 12 34 56 78" value="${esc(c.phone || '')}"></label>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="relPhoneSave" data-id="${c.id}">Enregistrer</button>` });
};
ACTIONS.relPhoneSave = el => { const p = phoneE164($('#rp').value); if (!p) { toast('Numéro invalide.'); return; } db.batch([[['clients', el.dataset.id, 'phone'], p], [['clients', el.dataset.id, 'phoneSrc'], 'manual'], [['clients', el.dataset.id, 'phoneBad'], null]]); closeModal(); toast('Numéro enregistré'); };

// Appel : verrou, garde-fou « déjà contacté », puis feuille de résultat au retour dans l'appli.
ACTIONS.relCall = async (el, ev) => {
  const rl = relByKey(el.dataset.key); if (!rl) return;
  const recent = Object.values(S.touches || {}).filter(x => x.clientId && x.clientId === rl.clientId && Date.now() - x.at < 864e5).sort((a, b) => b.at - a.at)[0];
  const quiet = quietNow(rl.clubId);
  if (recent || quiet) {
    const msg = [recent ? `Déjà contacté aujourd’hui par ${esc((S.users[recent.by] || {}).first || 'un collègue')} à ${new Date(recent.at).toTimeString().slice(0, 5)} : ${esc((TOUCH_OUTCOMES[recent.outcome] || {}).label || '')}.` : '', quiet ? `Il est ${new Date().toTimeString().slice(0, 5).replace(':', ' h ')}, hors des horaires d’appel.` : ''].filter(Boolean).join(' ');
    if (!await confirmDlg(msg + ' Appeler quand même ?', { ok: 'Appeler' })) return;
  }
  const cfg = relCfg(rl.clubId);
  db.batch(relPatch(rl, { claimedBy: ME.id, claimedUntil: Date.now() + cfg.lockMinutes * 60000 }));
  UI.pendingCall = { key: rl.key, at: Date.now() };
  // Sur ordinateur, pas d'appli telephone : on affiche le numero a composer.
  if (!matchMedia('(pointer: coarse)').matches) { openModal({ title: `Appeler ${esc(rl.name)}`, body: `<div class="title t-40" id="code-val">${esc(phoneFmt(clientPhone(rl.client)))}</div><p class="muted small">Composez ce numéro, puis notez le résultat.</p>`, foot: `<button class="btn" data-act="copyCode">Copier</button><button class="btn primary" data-act="relNote" data-key="${rl.key}">Noter le résultat</button>` }); UI.pendingCall = null; return; }
  location.href = el.getAttribute('href');
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' || !UI.pendingCall) return;
  const p = UI.pendingCall; UI.pendingCall = null;
  if (Date.now() - p.at < 2 * 3600000) setTimeout(() => relSheet(p.key, 'call'), 300);
});
ACTIONS.relNote = el => relSheet(el.dataset.key, 'call');

// Message : modèle prêt, aperçu modifiable, journalisé, puis ouverture de l'appli native.
ACTIONS.relMsg = el => {
  const rl = relByKey(el.dataset.key); if (!rl) return; const ch = el.dataset.ch;
  const f = fillTemplate(tplFor(rl.kind, 'sms'), tplCtx(rl));
  openModal({ title: `${ch === 'email' ? 'E-mail' : ch === 'whatsapp' ? 'WhatsApp' : 'SMS'} · ${esc(rl.name)}`, body: `<textarea class="input" id="rm" rows="6">${esc(f.text)}</textarea><p class="muted small" id="rm-n">${f.text.length} caractères${ch === 'sms' ? ` · ${Math.ceil(f.text.length / 160)} SMS` : ''}</p>${f.missing.length ? `<p class="bad small">À compléter : ${f.missing.join(', ')}</p>` : ''}`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="relMsgSend" data-key="${rl.key}" data-ch="${ch}">Envoyer</button>` });
};
ACTIONS.relMsgSend = el => {
  const rl = relByKey(el.dataset.key); const ch = el.dataset.ch; const text = $('#rm').value;
  if (/\[[a-z_]+ manquant\]/.test(text)) { toast('Complétez les éléments manquants avant d’envoyer.'); return; }
  const L = contactLinks(rl, text);
  db.batch([touchOp(rl, { channel: ch, outcome: 'envoye', text: text.slice(0, 1000) }), ...relPatch(rl, { status: 'attente', nextAt: nextStepAt(rl, (rl.step || 0) + 1) || Date.now() + 3 * 864e5, step: (rl.step || 0) + 1 })]);
  closeModal();
  const href = ch === 'email' ? L.mail : ch === 'whatsapp' ? L.wa : L.sms;
  if (href) { if (ch === 'whatsapp') window.open(href, '_blank'); else location.href = href; }
};

// Feuille de résultat : une issue, et toujours une suite datée.
function relSheet(key, channel = 'call') {
  const rl = relByKey(key); if (!rl) return;
  const outs = ['joint', 'messagerie', 'pasreponse', 'mauvaisnumero', 'rappeler', ...(KIND_OUTCOMES[rl.kind] || []), 'refus', 'stop'];
  const motifs = (REFUS_MOTIFS[rl.kind] || (() => ['Pas intéressé', 'Autre']))();
  openModal({ title: `Résultat · ${esc(rl.name)}`, drawer: true, body: `<form id="rsf" class="grid">
    <div class="out-grid">${outs.map(o => `<label class="out-btn"><input type="radio" name="out" value="${o}"><span>${TOUCH_OUTCOMES[o].label}</span></label>`).join('')}</div>
    <div class="cond" data-for="rappeler"><div class="field"><span>Rappeler le</span><input class="input" type="datetime-local" name="callbackAt"></div><div class="chips">${[['soir', 'Ce soir 18 h'], ['demain', 'Demain 10 h'], ['lundi', 'Lundi 10 h']].map(([k, l]) => `<button type="button" class="chip-radio" data-act="relQuick" data-q="${k}"><span>${l}</span></button>`).join('')}</div></div>
    <div class="cond" data-for="promesse"><div class="form-grid"><label class="field"><span>Montant promis (€)</span><input class="input" name="promiseAmount" inputmode="decimal" value="${rl.amount ? String(rl.amount).replace('.', ',') : ''}"></label><label class="field"><span>Date promise</span><input class="input" type="date" name="promiseDate" min="${today()}"></label></div></div>
    <div class="cond" data-for="rdv"><div class="form-grid"><label class="field"><span>Rendez-vous le</span><input class="input" type="datetime-local" name="rdvAt"></label><label class="field"><span>Objet</span><select class="input" name="rdvObj"><option>Bilan coach</option><option>Visite</option><option>Signature</option></select></label></div></div>
    <div class="cond" data-for="paye"><label class="field"><span>Montant encaissé (€)</span><input class="input" name="paidAmount" inputmode="decimal" value="${rl.amount ? String(rl.amount).replace('.', ',') : ''}"></label></div>
    <div class="cond" data-for="sauve"><label class="field"><span>Solution proposée</span><select class="input" name="offer">${RES_OFFERS.map(o => `<option>${o}</option>`).join('')}</select></label></div>
    <div class="cond" data-for="refus"><label class="field"><span>Motif (obligatoire)</span><select class="input" name="reason"><option value="">Choisir…</option>${motifs.map(m => `<option>${esc(m)}</option>`).join('')}</select></label></div>
    <label class="field"><span>Note</span><textarea class="input" name="note" maxlength="280" rows="2"></textarea></label>
  </form>`, foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" id="rs-ok" data-act="relSave" data-key="${key}" data-ch="${channel}" disabled>Enregistrer</button>`,
    onMount: m => {
      const upd = () => { const o = ($('input[name=out]:checked', m) || {}).value; $$('.cond', m).forEach(c => { c.hidden = c.dataset.for !== o; }); const f = formData($('#rsf', m));
        const ok = o && !(o === 'rappeler' && !f.callbackAt) && !(o === 'promesse' && (!f.promiseDate || Number.isNaN(parseMontant(f.promiseAmount)))) && !(o === 'refus' && !f.reason) && !(o === 'rdv' && !f.rdvAt);
        $('#rs-ok', m).disabled = !ok; };
      m.addEventListener('input', upd); m.addEventListener('change', upd); upd();
    } });
}
ACTIONS.relQuick = el => {
  const d = new Date(); let t;
  if (el.dataset.q === 'soir') t = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18);
  if (el.dataset.q === 'demain') t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 10);
  if (el.dataset.q === 'lundi') t = new Date(d.getFullYear(), d.getMonth(), d.getDate() + ((8 - d.getDay()) % 7 || 7), 10);
  const inp = $('#rsf input[name=callbackAt]'); inp.value = `${isoOf(t)}T${pad(t.getHours())}:00`; inp.dispatchEvent(new Event('input', { bubbles: true }));
};
ACTIONS.relSave = el => {
  const rl = relByKey(el.dataset.key); if (!rl) return; const f = formData($('#rsf')); const o = ($('#rsf input[name=out]:checked') || {}).value; const ch = el.dataset.ch; if (!o) return;
  const T = TOUCH_OUTCOMES[o]; const ops = []; let next = null, status = rl.status === 'todo' ? 'encours' : rl.status, extra = {};
  const t = { channel: ch, outcome: o, note: (f.note || '').trim().slice(0, 280) };
  if (o === 'rappeler') { next = new Date(f.callbackAt).getTime(); status = 'attente'; t.callbackAt = next; }
  else if (o === 'promesse') { const a = parseMontant(f.promiseAmount); t.promiseAmount = a; t.promiseDate = f.promiseDate; next = dateOf(addDays(f.promiseDate, 1)).getTime() + 10 * 3600000; status = 'attente'; if (rl.client) ops.push(dunPatch(rl.client, { status: 'promesse', promiseAmount: a, promiseDate: f.promiseDate, next: addDays(f.promiseDate, 1) }, `Promesse : ${fmtE(a)} le ${dm(f.promiseDate)}`)); }
  else if (o === 'rdv') { t.rdvAt = new Date(f.rdvAt).getTime(); t.rdvObj = f.rdvObj; status = 'gagne'; extra = { closedAt: Date.now(), closedBy: ME.id, result: 'rdv' }; }
  else if (o === 'paye') { const a = parseMontant(f.paidAmount) || rl.amount || 0; if (rl.client) ops.push(...markPaidOps(rl.client, a, 'equipe', rl.ownerId || ME.id, 'relances')); status = 'gagne'; extra = { closedAt: Date.now(), closedBy: ME.id, result: 'paye' }; }
  else if (o === 'sauve') { status = 'gagne'; extra = { closedAt: Date.now(), closedBy: ME.id, result: 'sauve' }; }
  else if (o === 'ok') { status = 'gagne'; extra = { closedAt: Date.now(), closedBy: ME.id, result: 'ok' }; }
  else if (o === 'refus') { status = 'perdu'; t.reason = f.reason; extra = { closedAt: Date.now(), closedBy: ME.id, lostReason: f.reason }; }
  else if (o === 'stop') { status = 'perdu'; extra = { closedAt: Date.now(), closedBy: ME.id, lostReason: 'Ne plus contacter' }; if (rl.clientId) ops.push([['clients', rl.clientId, 'optOutCall'], true], [['clients', rl.clientId, 'optOutSms'], true], [['clients', rl.clientId, 'optOutAt'], Date.now()]); }
  else if (o === 'mauvaisnumero') { if (rl.clientId) ops.push([['clients', rl.clientId, 'phoneBad'], true]); }
  else if (o === 'joint') { if (rl.kind === 'impaye') { next = Date.now() + 3 * 864e5; status = 'attente'; } else if (rl.kind === 'anniversaire') { status = 'gagne'; extra = { closedAt: Date.now(), closedBy: ME.id, result: 'ok' }; } else { next = Date.now() + 2 * 864e5; status = 'attente'; } }
  if (T && !T.reached && ch === 'call') {
    const attempts = (rl.attempts || 0) + 1; const step = (rl.step || 0) + 1; extra.attempts = attempts; extra.step = step;
    next = nextStepAt(rl, step);
    if (!next) { status = 'perdu'; extra = { ...extra, closedAt: Date.now(), closedBy: ME.id, lostReason: 'Injoignable' }; }
    else status = 'attente';
  }
  ops.push(touchOp(rl, t), ...relPatch(rl, { status, nextAt: next, claimedBy: null, claimedUntil: null, ownerId: rl.ownerId || ME.id, ...extra }));
  // Pages historiques : même information
  if (rl.kind === 'resiliation') {
    const r = S.resiliations[rl.refId];
    if (r) { ops.push(resLogOp(r, T.label + (f.offer && f.offer !== 'Aucune' ? ' · ' + f.offer : ''), { note: t.note, offer: f.offer || null }), [['resiliations', r.id, 'status'], o === 'sauve' ? 'sauvee' : 'traitement'], [['resiliations', r.id, 'ownerId'], r.ownerId || ME.id]);
      if (o === 'sauve') ops.push([['resiliations', r.id, 'saved'], true], [['resiliations', r.id, 'userId'], r.ownerId || ME.id], [['entries', 'sv_' + r.id], { id: 'sv_' + r.id, userId: r.ownerId || ME.id, clubId: CLUB.id, kpiId: 'sauvetage', date: today(), value: 1, source: 'manual', at: Date.now(), by: ME.id }]); }
  } else if (rl.kind === 'impaye' && rl.client && o !== 'paye' && o !== 'promesse') ops.push(dunPatch(rl.client, { status: 'relance', ownerId: dunOf(rl.client).ownerId || ME.id, next: next ? isoOf(new Date(next)) : null }, `${T.label}${t.note ? ' : ' + t.note : ''}`));
  else if (rl.clientId && ['suivi15', 'suivi30', 'fincontrat', 'anniversaire', 'mandat'].includes(rl.kind)) {
    const legacy = { joint: 'ok', ok: 'ok', rdv: 'rdv', messagerie: 'message', pasreponse: 'noanswer', refus: 'lost', stop: 'lost' }[o];
    const type = { suivi15: 'suivi', suivi30: 'suivi', fincontrat: 'renouvellement' }[rl.kind] || rl.kind;
    if (legacy) { const id = newId(); ops.push([['loyalty', id], { id, clubId: CLUB.id, clientId: rl.clientId, type, outcome: legacy, userId: ME.id, at: Date.now(), note: t.note || '' }]); }
  }
  db.batch(ops); closeModal();
  if (o === 'sauve') celebrate('Client sauvé', `${rl.name} reste au club`, { kind: 'win' });
  else if (o === 'paye') celebrate('Impayé récupéré', rl.name, { kind: 'win' });
  else toast(next ? `Noté. Prochaine relance ${dayLabel(isoOf(new Date(next))).toLowerCase()} ${new Date(next).toTimeString().slice(0, 5).replace(':', ' h ')}` : 'Noté');
  if (UI.session) setTimeout(() => sessionNext(), 250);
};

// ── Mode session : une fiche à la fois, enchaînée ─────────────────────────
ACTIONS.relSession = () => { const Q = relQueue(CLUB.id, UI.relScope || (isManager() ? 'all' : 'mine')); if (!Q.now.length) { toast('Aucune relance à appeler.'); return; } UI.session = { keys: Q.now.map(r => r.top.key), i: -1, start: Date.now() }; sessionNext(); };
function sessionNext() {
  const s = UI.session; if (!s) return; s.i++;
  if (s.i >= s.keys.length) { const min = Math.round((Date.now() - s.start) / 60000); UI.session = null; closeModal(); toast(`Session terminée : ${plur(s.keys.length, 'fiche', 'fiches')} en ${plur(min, 'minute', 'minutes')}`); render(); return; }
  const rl = relByKey(s.keys[s.i]); if (!rl) { sessionNext(); return; }
  const sc = tplFor(rl.kind, 'script'); const ctx = tplCtx(rl); const L = contactLinks(rl);
  const c = rl.client || {};
  openModal({ title: `${s.i + 1} sur ${s.keys.length} · ${esc(rl.name)}`, drawer: true, body: `<div class="sess">
    <div class="row wrap" style="gap:6px">${[rl.kind].map(k => `<span class="tag is-warn">${REL_KINDS[k].label}</span>`).join('')}<span class="muted small">${esc(rl.reason)}</span></div>
    <div class="muted small">${c.offer ? 'Offre : ' + esc(c.offer) + ' · ' : ''}${c.end ? 'fin ' + dmy(c.end) + ' · ' : ''}${rl.touches[0] ? 'dernière note : ' + esc(rl.touches[0].note || (TOUCH_OUTCOMES[rl.touches[0].outcome] || {}).label || '') : 'premier contact'}</div>
    ${['Ouverture', 'Questions', 'Conclusion'].map((h, i) => sc[i] ? `<div class="script"><b>${h}</b><p>${esc(fillTemplate(sc[i], ctx).text)}</p></div>` : '').join('')}
    <div class="row wrap" style="gap:8px;margin-top:10px">${L.tel ? `<a class="btn primary rel-call" href="${L.tel}" data-act="relCall" data-key="${rl.key}">${ico('phone')}<span>Appeler ${esc(phoneFmt(clientPhone(c)))}</span></a>` : '<span class="muted">Pas de numéro</span>'}<button class="btn" data-act="relNote" data-key="${rl.key}">Noter le résultat</button><button class="btn ghost" data-act="sessSkip">Passer</button><button class="btn ghost" data-act="sessStop">Terminer</button></div></div>` });
}
ACTIONS.sessSkip = () => sessionNext();
ACTIONS.sessStop = () => { UI.session = null; closeModal(); render(); };

// Pastille de l'onglet Relances : mes relances a faire maintenant.
function relBadge() { try { return relQueue(CLUB.id, 'mine').now.length; } catch (e) { return 0; } }

// ── Pole Equipe : fil, chat, defis ────────────────────────────────────────
PAGES.equipe = {
  title: 'Équipe',
  render() {
    const t = UI.eqTab || 'fil';
    const strip = h => h.replace(/^<div class="page-head">[\s\S]*?<\/div>\s*(<span class="spacer"><\/span>[\s\S]*?)?<\/div>/, '');
    const body = t === 'chat' ? PAGES.chat.render() : t === 'defis' ? PAGES.challenges.render() : PAGES.feed.render();
    const live = Object.values(S.challenges || {}).some(c => c.clubId === CLUB.id && c.start <= Date.now() && c.end > Date.now());
    return `<div class="page-head"><div><h1>Équipe</h1><p>Le fil des ventes, le chat et les défis du club.</p></div></div>
      ${tabs('eqTab', [['fil', `Fil d’équipe${unseenFeed() ? ' · ' + unseenFeed() : ''}`], ['chat', `Chat${unseenChat() ? ' · ' + unseenChat() : ''}`], ['defis', `Défis${live ? ' · en cours' : ''}`]], t)}${strip(body)}`;
  },
  mount() { const t = UI.eqTab || 'fil'; if (t === 'chat' && PAGES.chat.mount) PAGES.chat.mount(); if (t === 'fil' && PAGES.feed.mount) PAGES.feed.mount(); },
};
