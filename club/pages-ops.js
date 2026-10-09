/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — résiliations (circuit de traitement) et impayés (tableur) ═
//
// Deux listes de travail qui remplacent les Sheets et Google Docs du club.
// Chaque dossier a un statut, UN responsable et une échéance ; chaque action
// est datée et signée. Les imports Resamania mettent les dossiers à jour sans
// jamais effacer ce que l'équipe y a noté.

// ── Résiliations ──────────────────────────────────────────────────────────
const RES_STATUS = {
  averifier: { label: 'À vérifier', cls: 'warn' },
  nouvelle: { label: 'Nouvelle', cls: 'warn' },
  traitement: { label: 'En traitement', cls: 'info' },
  sauvee: { label: 'Sauvée', cls: 'ok' },
  resiliee: { label: 'Résiliée', cls: 'bad' },
  rejetee: { label: 'Demande rejetée', cls: 'info' },
};
const RES_REASONS = ['Prix', 'Déménagement', 'Santé', 'Manque de temps', 'Insatisfaction', 'Concurrence', 'Autre'];
const RES_OFFERS = ['Suspension', 'Changement de formule', 'Geste commercial', 'Offre fidélité', 'Rendez-vous coach', 'Aucune'];
const RES_CALLS = { noanswer: 'Pas de réponse', message: 'Message laissé', rdv: 'RDV pris', offer: 'Offre proposée', refus: 'Refus' };
// Statut, phase et contacts : règles communes à l'appli et au serveur (res-moteur.js).
// Une demande dont la date effective est passée (sans sauvetage) = le client est parti.
const resStatus = r => RES_ENGINE.statut(r, today());
// ── Modèle d'une demande (champs facultatifs pour les anciens dossiers) ──────
// source 'mail' | 'appli' | 'resamania' | 'manuel' | 'accueil' ; channel (texte libre) ; type 'resiliation' | 'suspension' ;
// clientId, clientConfidence, clientNum ; receivedAt (réception légale, ms) ; mail { threadId, link, subject, firstInAt,
// lastInAt, firstReplyAt, lastOutAt, inCount, outCount, awaitingReply, kind, score } ; dueAt (receivedAt + SLA du club) ;
// escalation { h4At, h24At, h48At } ; outcome 'sauvee' | 'resiliee' | 'suspension' | 'faux_positif' | 'doublon' ;
// closedAt, closedBy, closedReason ('fitpulse' | 'resamania' | 'manager' | 'sans_contact' | 'doublon').
// E-mail, téléphone et extrait du message : /private/resiliations/{club}/{id} (res-suivi.js, resPriv).
const resSlaHeures = (clubId = CLUB && CLUB.id) => Number(deepGet(S, ['clubs', clubId, 'mailRules', 'slaHours'])) || 24;
const resReceivedAt = r => r.receivedAt || minuitParis(r.date) || r.at || null;
// Échéance de réponse : depuis la réception, ou depuis le dernier message si l'adhérent a réécrit.
const resDueAt = r => { const d = RES_ENGINE.depart({ ...r, receivedAt: resReceivedAt(r) }); return r.mail && r.mail.lastInAt > (resReceivedAt(r) || 0) ? d + resSlaHeures(r.clubId) * 3600000 : r.dueAt || (d ? d + resSlaHeures(r.clubId) * 3600000 : null); };
const RES_CONTACT = RES_ENGINE.CONTACT;
const resContacts = r => RES_ENGINE.contacts(r);
// Délai de prise en charge (jours) : de la réception au premier contact.
function resDelai(r) { const c = resContacts(r)[0]; const rec = resReceivedAt(r); return c && rec && c.at >= rec ? (c.at - rec) / 864e5 : null; }
// Phases : 'verifier' (score 2), 'attente' (rouge : l'adhérent attend une réponse), 'encours' (orange : réponse partie
// ou contact noté, l'adhérent n'a pas réécrit depuis), 'close' (issue posée).
const resPhase = r => RES_ENGINE.phase(r, today());
const RES_PHASE = { verifier: { label: 'À vérifier', cls: 'warn' }, attente: { label: 'En attente de réponse', cls: 'bad' }, encours: { label: 'En cours', cls: 'warn' }, close: { label: 'Close', cls: '' } };
const resOpen = r => ['attente', 'encours'].includes(resPhase(r));
const daysTo = d => d ? Math.round((dateOf(d) - dateOf(today())) / 86400000) : null;
function resUrgent(r) { const n = daysTo(r.effective); return resOpen(r) && n != null && n <= 7; }
function resList(clubId) { return Object.values(S.resiliations).filter(r => r.clubId === clubId && !r.hidden); }
function resToHandle(clubId) { return resList(clubId).filter(r => resOpen(r)); }
const resAVerifier = clubId => resList(clubId).filter(r => resPhase(r) === 'verifier');
// Compteurs du badge de navigation et de la tuile du cockpit : en attente d'abord, en cours en second.
function resCompteurs(clubId, filtre = () => true) { const L = resToHandle(clubId).filter(filtre); return { attente: L.filter(r => resPhase(r) === 'attente').length, encours: L.filter(r => resPhase(r) === 'encours').length }; }

// Droits : un manager voit tous les dossiers du club ; un commercial ne voit que les siens.
const mesDossiersRes = r => isManager() || r.ownerId === ME.id;
const mesDossiersDun = c => isManager() || dunOf(c).ownerId === ME.id;
PAGES.resiliations = {
  title: 'Résiliations',
  // Une fois par jour, à l'ouverture par un manager : clôture automatique (le serveur la fait aussi à 2 h).
  mount() { if (isManager() && !CFG.capture && deepGet(S, ['clubs', CLUB.id, 'resAutoCloseDay']) !== today()) setTimeout(() => { const n = resAutoClose(CLUB.id, { silent: true }); db.set(['clubs', CLUB.id, 'resAutoCloseDay'], today()); if (n) toast(`${plur(n, 'dossier fermé', 'dossiers fermés')} automatiquement`); }, 0); },
  render() {
    const all = resList(CLUB.id).filter(mesDossiersRes);
    const verif = all.filter(r => resPhase(r) === 'verifier');
    const tab = UI.resTab === 'verif' && !verif.length ? 'todo' : UI.resTab || 'todo';
    // À traiter : en attente par échéance de réponse, puis en cours par date d'effet.
    const open = all.filter(resOpen).sort((a, b) => { const pa = resPhase(a) === 'attente' ? 0 : 1, pb = resPhase(b) === 'attente' ? 0 : 1; if (pa !== pb) return pa - pb;
      return pa === 0 ? (resDueAt(a) || 9e15) - (resDueAt(b) || 9e15) || (resValeur(b) - resValeur(a)) : (a.effective || '9999').localeCompare(b.effective || '9999') || (resValeur(b) - resValeur(a)); });
    const mk = UI.resMonth || curMonth();
    const K = resIndicateurs(CLUB.id, mk, all);
    const sla = resSlaHeures();
    const head = `<div class="page-head"><div><h1>Résiliations</h1><p>${esc(nomAffiche())} · les demandes reçues par e-mail, dans l’appli, à l’accueil ou lues dans Resamania.</p></div><span class="spacer"></span><button class="btn" data-act="resExport">${ico('download')} Exporter</button><button class="btn primary" data-act="resNew">${ico('plus')} Nouvelle demande</button></div>`;
    const h = ms => ms == null ? 'n.d.' : ms < 3600000 ? Math.max(1, Math.round(ms / 60000)) + ' min' : Math.floor(ms / 3600000) + ' h' + (Math.round(ms / 60000) % 60 ? ' ' + pad(Math.round(ms / 60000) % 60) : '');
    const kpis = `<div class="stat-row res-kpis">
      <div class="stat ${K.sansReponse && K.plusAncienneMs > sla * 3600000 ? 'alarm' : K.sansReponse ? 'hot' : ''}" data-tuile="sans-reponse"><span>Sans réponse</span><b>${plur(K.sansReponse, 'demande', 'demandes')}</b><small>${K.sansReponse ? 'plus ancienne : ' + Math.floor(K.plusAncienneMs / 3600000) + ' h' : 'toutes ont une réponse'}</small></div>
      <div class="stat" data-tuile="delai-median"><span>Délai médian de 1re réponse</span><b>${h(K.delaiMedianMs)}</b><small>${plur(K.repondues, 'demande répondue', 'demandes répondues')} en ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</small></div>
      <div class="stat" data-tuile="repondues24"><span>Répondues sous 24 h</span><b>${fmtP(K.repondues24)}</b><small>${K.recues ? `sur ${plur(K.recues, 'demande reçue', 'demandes reçues')}` : 'aucune demande reçue'}</small></div>
      <div class="stat" data-tuile="sauvetage"><span>Taux de sauvetage</span><b class="${K.sauvees ? 'ok' : ''}">${fmtP(K.tauxSauvetage)}</b><small>${K.sauvees} ${K.sauvees > 1 ? 'sauvées' : 'sauvée'} sur ${K.sauvees + K.resiliees} · <span data-v="${K.eurosSauves}">${fmtE(K.eurosSauves)}</span></small></div></div>`;
    const conf = resConformite(CLUB.id);
    const alerteConf = conf.manquantes ? `<div class="alert bad" data-conformite="${conf.manquantes}" style="margin-bottom:12px">${ico('alert')}<div>${conf.manquantes} résiliation(s) validée(s) sans confirmation écrite. Confirmations envoyées : ${fmtP(conf.taux)}.</div></div>` : '';
    let body;
    if (tab === 'todo') {
      body = (open.length ? `<div class="grid res-grid">${resFermetures('todo')}${open.map(resCard).join('')}</div>` : `${resFermetures('todo')}<div class="card">${emptyBox({ art: 'board', title: 'Aucune demande à traiter', text: 'Les demandes reçues par e-mail, dans l’appli ou lues dans Resamania arrivent ici. Les dossiers clos sont dans l’historique.', cta: '<a class="btn sm" href="#/imports">Ouvrir les imports</a>' })}</div>`);
    } else if (tab === 'verif') {
      body = `<p class="muted small">Messages au score de 2 : la relève n’est pas sûre qu’il s’agisse d’une demande. Confirmez ou ignorez.</p><div class="grid res-grid">${verif.map(resCardVerif).join('')}</div>`;
    } else if (tab === 'analyse') {
      body = `<div class="row wrap" style="margin-bottom:12px">${monthNav('resMonth', mk)}</div>${resAnalyse(CLUB.id, mk, all)}`;
    } else {
      const fermes = all.filter(r => resPhase(r) === 'close' && ((r.closedAt ? isoOf(new Date(r.closedAt)) : r.effective || r.date) || '').slice(0, 7) === mk);
      const month = [...new Map([...all.filter(r => (r.date || '').slice(0, 7) === mk), ...fermes].map(r => [r.id, r])).values()];
      body = `<div class="row wrap" style="margin-bottom:12px">${monthNav('resMonth', mk)}</div>
        ${month.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Demande</th><th>Client</th><th>Motif</th><th>Effective</th><th>Responsable</th><th>Statut</th><th>Fermé par</th></tr></thead><tbody>${month.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(r => `<tr class="click" data-act="resOpen" data-id="${r.id}"><td>${dmy(r.date)}</td><td><b>${esc(r.client)}</b></td><td>${esc(r.reason || 'Non précisé')}</td><td>${r.effective ? dmy(r.effective) : 'n.d.'}</td><td>${r.ownerId ? esc(fullName(S.users[r.ownerId])) : '<span class="muted">n.d.</span>'}</td><td><span class="badge ${RES_STATUS[resStatus(r)].cls}">${r.outcome === 'suspension' ? 'Suspendue' : RES_STATUS[resStatus(r)].label}</span>${resAConfirmer(r) ? ' <span class="badge warn" data-badge="a-confirmer">À confirmer</span>' : ''}</td><td data-ferme-par="${esc(resFermePar(r))}">${esc(resFermePar(r)) || '<span class="muted">ouvert</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="card empty">Aucune demande ce mois-ci.</div>'}`;
    }
    const onglets = [['todo', `À traiter (${open.length})`], ...(verif.length ? [['verif', `À vérifier (${verif.length})`]] : []), ['all', 'Historique du mois'], ['analyse', 'Analyse']];
    return head + resReleveInfo() + alerteConf + resConfirmationsDues(all) + (isManager() && typeof rrqBlock === 'function' && (rrqAll(CLUB.id).length || !deepGet(S, ['clubs', CLUB.id, 'mailSync'])) ? rrqBlock() : '') + kpis + tabs('resTab', onglets, tab) + body;
  },
};
// Qui a fermé le dossier : un membre, « Resamania » ou « Automatique ».
function resFermePar(r) {
  if (resPhase(r) !== 'close') return '';
  if (r.closedReason === 'resamania' || r.closedBy === 'resamania') return 'Resamania';
  if (r.closedBy === 'system' || r.closedReason === 'sans_contact' || r.closedReason === 'doublon') return 'Automatique';
  if (r.closedBy && S.users[r.closedBy]) return fullName(S.users[r.closedBy]);
  return r.status === 'resiliee' && r.effective && !r.outcome ? 'Automatique' : 'n.d.';
}
// Relève de la boîte accueil (fonction ingestResiliations) : heure du dernier passage ; au-delà de 3 h, bandeau orange au manager.
function resReleveInfo(clubId = CLUB.id) {
  const ms = deepGet(S, ['clubs', clubId, 'mailSync']); if (!ms || !ms.at) return '';
  const age = Date.now() - ms.at; const min = Math.max(0, Math.round(age / 60000));
  const quand = min < 60 ? `il y a ${plur(min, 'min', 'min')}` : min < 48 * 60 ? `il y a ${Math.floor(min / 60)} h ${pad(min % 60)}` : `le ${dmy(isoOf(new Date(ms.at)))}`;
  const ligne = `<div class="res-releve" data-releve="${ms.at}"><span>Dernière relève : ${quand}</span>${ms.ok === false && ms.error ? '<span class="bad">dernier passage en erreur</span>' : ''}${ms.scanned != null ? `<span>${plur(ms.scanned, 'fil lu', 'fils lus')}, ${plur(ms.found || 0, 'demande trouvée', 'demandes trouvées')}</span>` : ''}</div>`;
  const panne = age > 3 * 3600000 && isManager() ? `<div class="alert" data-releve-panne="1" style="margin-bottom:12px">${ico('alert')}<div>La relève de la boîte accueil ne répond plus depuis ${age > 20 * 3600000 ? `le ${dmy(isoOf(new Date(ms.at)))} à ` : ''}${timeOf(ms.at).replace(':', ' h ')}. Vérifiez le script Apps Script.</div></div>` : '';
  return panne + ligne;
}
// Sauvetage déclaré dans Fit Pulse, pas encore lu « annulée » dans Resamania depuis plus de 15 jours.
function resAConfirmer(r) { const sv = S.entries['sv_' + r.id]; return !!(sv && sv.proof === 'declaratif' && Date.now() - (sv.at || 0) > 15 * 864e5); }
const resAppliAcceptee = r => r.source === 'appli' && deepGet(r, ['rsm', 'state']) === 'accepted' && r.effective && daysTo(r.effective) > 3;
// Compte à rebours : réponse due (phase attente) ou date d'effet (phase en cours).
function resCompteARebours(r, maintenant = Date.now()) {
  const ph = resPhase(r);
  if (ph === 'attente') {
    const due = resDueAt(r); if (!due) return { txt: 'Réponse due', cls: 'warn' };
    const ms = due - maintenant; const hm = x => { const m = Math.floor(Math.abs(x) / 60000); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + pad(m % 60) : ''); };
    return ms >= 0 ? { txt: 'Réponse due dans ' + hm(ms), cls: 'warn' } : { txt: 'En retard de ' + (-ms < 3600000 ? hm(ms) : -ms < 72 * 3600000 ? Math.floor(-ms / 3600000) + ' h' : Math.floor(-ms / 864e5) + ' j'), cls: 'bad', fort: true };
  }
  if (ph === 'encours') { const n = daysTo(r.effective); return n == null ? { txt: 'Date d’effet inconnue', cls: 'muted' } : n > 0 ? { txt: 'Effective dans ' + n + ' j', cls: n <= 7 ? 'bad' : '' } : n === 0 ? { txt: 'Effective aujourd’hui', cls: 'bad' } : { txt: 'Effective depuis ' + (-n) + ' j', cls: 'bad' }; }
  return null;
}
const resSujet = s => { const t = String(s || '').trim(); return t.length > 60 ? t.slice(0, 59).trimEnd() + '…' : t; };
function resCard(r) {
  const ph = resPhase(r); const last = resActions(r).slice(-1)[0]; const mine = r.ownerId === ME.id;
  const c = resClient(r); const m = resMatch(r); const cr = resCompteARebours(r); const rec = resReceivedAt(r);
  const susp = r.type === 'suspension';
  const nom = c ? `<a href="#/client/${c.id}" class="res-nom">${esc(r.client)}</a>` : `<span class="res-nom">${esc(r.client)}</span>`;
  const badges = RES_ENGINE.sources(r).map(k => `<span class="badge src" data-badge="src-${k}">${RES_ENGINE.SOURCES[k]}</span>`).join('') + (susp ? '<span class="badge info" data-badge="suspension">Suspension</span>' : '') + (r.source === 'appli' ? '<span class="sr-only" data-badge="appli">Appli</span>' : '')
    + (c && (r.clientConfidence || m.confidence) === 'moyenne' && r.clientConfidence !== 'forte' ? `<button class="badge warn" data-act="resClientOk" data-id="${r.id}" data-badge="client-a-confirmer" title="Confirmer la fiche">Client à confirmer</button>` : '')
    + (resAConfirmer(r) ? '<span class="badge warn" data-badge="a-confirmer">À confirmer</span>' : '');
  const ligne2 = [esc(r.reason || 'Motif non renseigné'), rec ? `reçue le ${dmy(isoOf(new Date(rec))).slice(0, 5)} à ${timeOf(rec).replace(':', ' h ')}` : `demande du ${dmy(r.date)}`, r.mail && r.mail.subject ? `<span class="res-sujet">${esc(resSujet(r.mail.subject))}</span>` : ''].filter(Boolean).join(' · ');
  const tel = resTelephone(r);
  const assoc = !c && m.confidence !== 'forte' ? `<div class="res-assoc small" data-assoc="${r.id}"><span class="muted">Associer à :</span> ${m.candidates.map(id => S.clients[id]).filter(Boolean).map(x => `<button class="btn sm ghost" data-act="resAssoc" data-id="${r.id}" data-c="${x.id}">${esc(x.name || '')}${x.num ? ' · n° ' + esc(x.num) : ''}</button>`).join(' ')} <button class="btn sm ghost" data-act="resCreerFiche" data-id="${r.id}">Créer la fiche</button></div>` : '';
  return `<div class="card dossier ph-${ph}" data-phase="${ph}" data-id="${r.id}">
    <div class="res-l1"><div class="res-qui">${nom}<span class="res-badges">${badges}</span></div>${cr ? `<div class="res-cr ${cr.cls}" data-compte="${esc(cr.txt)}">${cr.fort ? '<b>' + cr.txt + '</b>' : cr.txt}</div>` : ''}</div>
    <div class="small muted res-l2">${ligne2}<span class="res-val" data-valeur="${resValeur(r)}"> · En jeu : ${fmtE(resValeur(r))}${!r.valeur && !r.enJeu && valeurEnJeu(r).estimee ? ' <span class="muted">estimé</span>' : ''}</span>${tel ? ` · <span class="res-tel" data-tel="1">${esc(phoneFmt(phoneE164(tel)) || tel)}</span>` : ''}</div>
    ${resAppliAcceptee(r) ? `<div class="small bad" data-mention="appli">Acceptée dans Resamania, effective le ${dmy(r.effective).slice(0, 5)} : appeler avant</div>` : ''}
    <div class="small res-l3">${last && !/^Demande (reçue|enregistrée)/.test(last.label || '') ? `<span class="muted">Dernière action :</span> ${esc(last.label)}${last.note ? ' <span class="muted">« ' + esc(last.note) + ' »</span>' : ''} <span class="muted">· ${last.by === 'system' ? 'automatique' : esc(fullName(S.users[last.by]))}, ${ago(last.at)}</span>` : '<span class="muted">Aucune réponse envoyée</span>'}</div>
    ${assoc}
    ${r.ownerId ? `<div class="small res-owner">${avatar(S.users[r.ownerId], 'xs')} ${mine ? '<b>Vous</b>' : esc(fullName(S.users[r.ownerId]))}</div>` : `<button class="btn sm res-take" data-act="resTake" data-id="${r.id}">Je m’en occupe</button>`}
    <div class="res-actions">
      <button class="btn sm ${ph === 'attente' ? 'primary' : ''}" data-act="resContact" data-id="${r.id}">${ico('phone')} Contacter</button>
      <button class="btn sm" data-act="resOffer" data-id="${r.id}">Proposer une offre</button>
      <button class="btn sm" data-act="resValidate" data-id="${r.id}">${susp ? 'Valider la suspension' : 'Valider la résiliation'}</button>
      <button class="btn ghost icon sm" data-act="resOpen" data-id="${r.id}" title="Détail" aria-label="Détail">${ico('chevR')}</button></div></div>`;
}
// Dossier au score de 2 : « C'est une demande » (passe en nouvelle) ou « Ignorer » (faux positif, retiré).
function resCardVerif(r) {
  const rec = resReceivedAt(r);
  return `<div class="card dossier ph-verifier" data-phase="verifier" data-id="${r.id}">
    <div class="res-l1"><div class="res-qui"><span class="res-nom">${esc(r.client)}</span><span class="res-badges">${RES_ENGINE.sources(r).map(k => `<span class="badge src">${RES_ENGINE.SOURCES[k]}</span>`).join('')}</span></div><div class="res-cr muted">score ${Number(deepGet(r, ['mail', 'score'])) || 2}</div></div>
    <div class="small muted res-l2">${rec ? `reçue le ${dmy(isoOf(new Date(rec))).slice(0, 5)} à ${timeOf(rec).replace(':', ' h ')}` : ''}${r.mail && r.mail.subject ? ' · ' + esc(resSujet(r.mail.subject)) : ''}</div>
    <div class="res-actions"><button class="btn sm primary" data-act="resVerifOui" data-id="${r.id}">C’est une demande</button><button class="btn sm" data-act="resVerifNon" data-id="${r.id}">Ignorer</button>${r.mail && r.mail.link ? `<button class="btn sm" data-act="resFil" data-id="${r.id}">Ouvrir le fil</button>` : ''}</div></div>`;
}
// Historique en ajout seul : chaque action est une cle a part (log/<id>), deux
// commerciaux qui notent en meme temps ne s'ecrasent plus. L'ancien tableau
// « actions » reste lu.
// Durée lisible : « 3 h 20 », « 2 j ».
const dureeCourte = ms => { const h = Math.floor(ms / 3600000); return h >= 48 ? Math.floor(h / 24) + ' j' : h ? h + ' h ' + pad(Math.floor(ms / 60000) % 60) : Math.max(1, Math.floor(ms / 60000)) + ' min'; };
function resLogOp(r, label, extra = {}) { const id = newId(); return [['resiliations', r.id, 'log', id], { at: Date.now(), by: ME.id, label, ...extra }]; }
// Offre proposée (champ structuré, ou ancien libellé « … · Offre »).
const actOffer = a => a.offer || RES_OFFERS.find(o => o !== 'Aucune' && (a.label || '').endsWith(' · ' + o)) || null;
function resOffersTables(month, enJeu, { motifs: avecMotifs = true } = {}) {
  const offers = {}; RES_OFFERS.filter(o => o !== 'Aucune').forEach(o => { offers[o] = { n: 0, ok: 0, v: 0 }; });
  const motifs = {};
  month.forEach(r => {
    const acts = resActions(r); acts.forEach(a => { const o = actOffer(a); if (o && offers[o]) offers[o].n++; });
    const lastO = acts.map(actOffer).filter(Boolean).pop();
    if (resStatus(r) === 'sauvee' && lastO && offers[lastO]) { offers[lastO].ok++; offers[lastO].v += enJeu(r); }
    const k = r.reason || 'Non renseigné'; const m = motifs[k] = motifs[k] || { n: 0, s: 0 }; m.n++; if (resStatus(r) === 'sauvee') m.s++;
  });
  return `<div class="g12" style="margin-bottom:14px"><div class="card col7"><h3>Offre proposée</h3><div class="table-wrap"><table class="t"><thead><tr><th>Offre</th><th class="num">Proposée</th><th class="num">Acceptée</th><th class="num">Taux</th><th class="num">Valeur sauvée</th></tr></thead><tbody>
    ${Object.entries(offers).map(([o, x]) => `<tr><td>${esc(o)}</td><td class="num">${x.n}</td><td class="num">${x.ok}</td><td class="num">${fmtP(x.n ? x.ok / x.n : null)}</td><td class="num">${fmtE(x.v)}</td></tr>`).join('')}</tbody></table></div></div>
    ${avecMotifs ? `<div class="card col5"><h3>Par motif</h3><div class="table-wrap"><table class="t"><thead><tr><th>Motif</th><th class="num">Demandes</th><th class="num">Sauvées</th><th class="num">Taux</th></tr></thead><tbody>
    ${Object.entries(motifs).sort((a, b) => b[1].n - a[1].n).map(([k, m]) => `<tr><td>${esc(k)}</td><td class="num">${m.n}</td><td class="num">${m.s}</td><td class="num">${fmtP(m.n ? m.s / m.n : null)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Aucune demande.</td></tr>'}</tbody></table></div></div>` : ''}</div>`;
}
const resActions = r => [...(r.actions || []), ...Object.values(r.log || {})].sort((a, b) => (a.at || 0) - (b.at || 0));
// Plusieurs fiches au même nom : le manager choisit (rattachement gardé dans r.clientId).
ACTIONS.resPickClient = el => { const r = S.resiliations[el.dataset.id]; const L = resCandidats(r);
  openModal({ title: `Fiche de ${r.client}`, body: `<div class="grid">${L.map(c => `<button class="btn" style="justify-content:flex-start" data-act="resPickOk" data-id="${r.id}" data-c="${c.id}">${esc(c.name || '')} ${c.num ? '· n° ' + esc(c.num) : ''} ${c.end ? '· fin ' + dmy(c.end) : ''} ${mensualite(c, true) ? '· ' + fmtE(mensualite(c, true)) + ' par mois' : ''}</button>`).join('')}</div>` }); };
ACTIONS.resPickOk = el => { db.batch([[['resiliations', el.dataset.id, 'clientId'], el.dataset.c], resLogOp(S.resiliations[el.dataset.id], 'Fiche client rattachée')]); closeModal(); };
ACTIONS.resMsgSauvetage = el => { const r = S.resiliations[el.dataset.id]; const v = valeurEnJeu(r);
  copierTexte(remplirMessage(reglage('messageSauvetage', MSG_DEFAUTS.messageSauvetage), { prenom: String(r.client || '').trim().split(/\s+/)[0], montant: fmtE(v.prix).replace(/\s*€$/, ''), club: CLUB.name }), 'Message copié'); };
ACTIONS.resTake = el => { const r = S.resiliations[el.dataset.id]; db.batch([[['resiliations', r.id, 'ownerId'], ME.id], [['resiliations', r.id, 'status'], 'traitement'], resLogOp(r, 'Prise en charge')]); toast('1 dossier ajouté à vos relances'); };
ACTIONS.resCall = el => {
  const r = S.resiliations[el.dataset.id];
  openModal({ title: `Appel · ${r.client}`, body: `<form id="rcf" class="grid">
    <div class="field"><span>Issue</span><div class="chips">${Object.entries(RES_CALLS).map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="out" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <label class="field"><span>Solution proposée</span><select class="input" name="offer">${RES_OFFERS.map(o => `<option>${o}</option>`).join('')}</select></label>
    <label class="field"><span>Note</span><textarea class="input" name="note" placeholder="Rappeler jeudi, intéressé par une suspension…"></textarea></label>
    <label class="field"><span>Prochaine action</span><input class="input" type="date" name="next" value="${addDays(today(), 1)}"></label></form>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resCallSave">Enregistrer</button>', onMount: m => { m.dataset.id = r.id; } });
};
ACTIONS.resCallSave = () => {
  const r = S.resiliations[$('.modal').dataset.id]; const f = formData($('#rcf'));
  const out = $('#rcf input[name=out]:checked').value;
  const next = f.next && f.next >= today() ? f.next : null; const rk = relKey('resiliation', r.id, r.date);
  db.batch([resLogOp(r, RES_CALLS[out] + (f.offer && f.offer !== 'Aucune' ? ' · ' + f.offer : ''), { note: f.note.trim(), out, offer: f.offer && f.offer !== 'Aucune' ? f.offer : null, next }), [['resiliations', r.id, 'status'], 'traitement'], [['resiliations', r.id, 'ownerId'], r.ownerId || ME.id],
    ...(next ? [[['relances', rk, 'nextAt'], dateOf(next).getTime() + 9 * 3600000], [['relances', rk, 'ownerId'], r.ownerId || ME.id]] : [])]);
  closeModal(); toast(next ? `1 appel noté, prochaine action le ${dmy(next).slice(0, 5)}` : '1 appel noté');
};
// Sauvetage : l'offre acceptée et une note sont exigées ; le point est « déclaratif » jusqu'à ce que
// Resamania lise l'annulation de la demande (proof passe alors à « resamania »).
ACTIONS.resSaveIt = el => {
  const r = S.resiliations[el.dataset.id];
  openModal({ title: `Sauvetage · ${r.client}`, body: `<form id="rsf" class="grid">
    <label class="field"><span>Offre acceptée</span><select class="input" name="offer" required><option value="">Choisir l’offre</option>${RES_OFFERS.filter(o => o !== 'Aucune').map(o => `<option>${esc(o)}</option>`).join('')}</select></label>
    <label class="field"><span>Note</span><textarea class="input" name="note" rows="3" maxlength="300" required placeholder="Ce qui a été convenu avec l’adhérent"></textarea></label>
    <p class="muted small" style="margin:0">Le sauvetage compte tout de suite au classement. Il passe « confirmé » quand l’import Resamania lit la demande annulée.</p></form>`,
    foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resSaveOk" data-id="${r.id}">Enregistrer le sauvetage</button>` });
};
ACTIONS.resSaveOk = el => {
  const r = S.resiliations[el.dataset.id]; const f = formData($('#rsf'));
  if (!f.offer || !RES_OFFERS.includes(f.offer) || f.offer === 'Aucune') { toast('Choisissez l’offre acceptée.'); return; }
  if (!(f.note || '').trim()) { toast('Indiquez une note sur le sauvetage.'); return; }
  const owner = r.ownerId || ME.id; const v = valeurEnJeu(r).euros; const now = Date.now();
  db.batch([[['resiliations', r.id, 'status'], 'sauvee'], [['resiliations', r.id, 'saved'], true], [['resiliations', r.id, 'enJeu'], v], [['resiliations', r.id, 'valeur'], v], [['resiliations', r.id, 'ownerId'], owner],
    [['resiliations', r.id, 'outcome'], 'sauvee'], [['resiliations', r.id, 'closedAt'], now], [['resiliations', r.id, 'closedBy'], ME.id], [['resiliations', r.id, 'closedReason'], 'fitpulse'],
    ...(resClient(r) && !r.clientId ? [[['resiliations', r.id, 'clientId'], resClient(r).id]] : []), resLogOp(r, 'Sauvée · ' + f.offer, { note: f.note.trim().slice(0, 300), offer: f.offer }),
    [['entries', 'sv_' + r.id], { id: 'sv_' + r.id, userId: owner, clubId: CLUB.id, kpiId: 'sauvetage', date: today(), value: 1, source: 'manual', at: now, by: ME.id, proof: 'declaratif', offer: f.offer }]]);
  closeModal(); toast(`Client sauvé : ${r.client} reste au club`);
};
ACTIONS.resLose = async el => {
  const r = S.resiliations[el.dataset.id];
  if (!await confirmDlg(`Confirmer la résiliation de ${esc(r.client)} ?`, { ok: 'Confirmer', danger: true })) return;
  db.batch([[['resiliations', r.id, 'status'], 'resiliee'], [['resiliations', r.id, 'saved'], false], [['resiliations', r.id, 'outcome'], 'resiliee'], [['resiliations', r.id, 'closedAt'], Date.now()], [['resiliations', r.id, 'closedBy'], ME.id], [['resiliations', r.id, 'closedReason'], 'fitpulse'], resLogOp(r, 'Résiliation confirmée'), [['entries', 'sv_' + r.id], null]]);
};
ACTIONS.resOpen = async el => {
  const r0 = S.resiliations[el.dataset.id]; const members = clubMembers(CLUB.id);
  // Coordonnées et extrait : chargés à l'ouverture du détail seulement (manager ou responsable).
  const pv = await resPrivLoad(r0); const r = S.resiliations[el.dataset.id] || r0;
  const tel = resTelephone(r), mail = resEmail(r);
  const coord = pv._refuse ? '<p class="muted small">Coordonnées réservées au responsable du dossier et au manager.</p>'
    : `<div class="small res-coord">${tel ? `Téléphone : <b>${esc(phoneFmt(phoneE164(tel)) || tel)}</b>` : 'Pas de téléphone'}${mail ? ` · E-mail : <b>${esc(mail)}</b>` : ''}${pv.excerpt ? `<blockquote class="muted">${esc(pv.excerpt)}</blockquote>` : ''}</div>`;
  openModal({ title: r.client, drawer: true, body: `${coord}<form id="rdf" class="grid">
    <div class="form-grid"><label class="field"><span>Statut</span><select class="input" name="status">${Object.entries(RES_STATUS).map(([k, v]) => `<option value="${k}" ${resStatus(r) === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select></label>
    <label class="field"><span>Responsable</span><select class="input" name="owner"><option value="">Aucun</option>${members.map(u => `<option value="${u.id}" ${r.ownerId === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></label>
    <label class="field"><span>Date de la demande</span><input class="input" type="date" name="date" value="${r.date}"></label>
    <label class="field"><span>Date effective</span><input class="input" type="date" name="effective" value="${r.effective || ''}"></label>
    <label class="field full"><span>Motif</span><select class="input" name="reason">${[...new Set([...(r.reason ? [r.reason] : []), ...RES_REASONS])].map(o => `<option ${o === r.reason ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></label>
    <label class="field"><span>Nature</span><select class="input" name="nature"><option value="abonnement" ${r.nature !== 'option' ? 'selected' : ''}>Abonnement</option><option value="option" ${r.nature === 'option' ? 'selected' : ''}>Option (ULTIMATE, ACCESS+, Yanga…)</option></select></label>
    <label class="row small" style="align-self:end;gap:8px"><input type="checkbox" name="sameDay" ${r.sameDay ? 'checked' : ''}> Résiliée le jour de la vente</label>
    <label class="field full"><span>Justification (obligatoire pour une option résiliée le jour de la vente)</span><textarea class="input" name="justif" rows="2" maxlength="300">${esc(r.justif || '')}</textarea></label></div>
    <button class="btn primary" type="button" data-act="resDetailSave" data-id="${r.id}">Enregistrer</button></form>
    <h3 style="margin:20px 0 8px">Historique</h3>${resActions(r).slice().reverse().map(a => `<div style="padding:8px 0;border-bottom:1px solid var(--line)" class="small"><b>${esc(a.label)}</b>${a.note ? '<br><span class="muted">« ' + esc(a.note) + ' »</span>' : ''}<div class="muted">${esc(fullName(S.users[a.by]))} · ${dmy(isoOf(new Date(a.at)))} ${timeOf(a.at)}</div></div>`).join('') || '<p class="muted small">Aucune action pour l’instant.</p>'}
    ${isManager() ? `<button class="btn sm danger" style="margin-top:16px" data-act="resDel" data-id="${r.id}">Supprimer la demande</button>` : ''}` });
};
ACTIONS.resDetailSave = el => {
  const r = S.resiliations[el.dataset.id]; const f = formData($('#rdf'));
  // Champ par champ (jamais l'objet entier) : l'historique d'un collegue n'est pas ecrase.
  const P = k => ['resiliations', r.id, k];
  if (f.nature === 'option' && f.sameDay && !(f.justif || '').trim()) { toast('Option résiliée le jour de la vente : la justification est obligatoire.'); return; }
  const ops = [[P('nature'), f.nature], [P('sameDay'), !!f.sameDay], [P('justif'), (f.justif || '').trim().slice(0, 300) || null], [P('status'), f.status], [P('saved'), f.status === 'sauvee'], [P('ownerId'), f.owner || null], [P('userId'), f.owner || null], [P('date'), f.date || r.date], [P('effective'), f.effective || null], [P('reason'), f.reason]];
  if (f.status !== resStatus(r)) {
    ops.push(resLogOp(r, 'Statut : ' + RES_STATUS[f.status].label));
    const ferme = ['sauvee', 'resiliee'].includes(f.status);
    ops.push([P('outcome'), ferme ? f.status : null], [P('closedAt'), ferme ? Date.now() : null], [P('closedBy'), ferme ? ME.id : null], [P('closedReason'), ferme ? (isManager() ? 'manager' : 'fitpulse') : null]);
  }
  // Déjà sauvé : le point garde sa date (corriger le motif ne déplace pas le sauvetage d'un mois à l'autre).
  const svOld = S.entries['sv_' + r.id]; const keep = resStatus(r) === 'sauvee' && svOld;
  if (f.status === 'sauvee' && (f.owner || ME.id)) ops.push([['entries', 'sv_' + r.id], { ...(keep ? svOld : {}), id: 'sv_' + r.id, userId: f.owner || ME.id, clubId: CLUB.id, kpiId: 'sauvetage', date: keep ? svOld.date : today(), value: 1, proof: keep ? svOld.proof || 'declaratif' : 'declaratif', source: keep ? svOld.source || 'manual' : 'manual', at: keep ? svOld.at || Date.now() : Date.now(), by: ME.id }]);
  if (f.status !== 'sauvee') ops.push([['entries', 'sv_' + r.id], null]);
  db.batch(ops); closeModal(); toast('1 dossier enregistré');
};
ACTIONS.resNew = () => openModal({ title: 'Nouvelle demande de résiliation', body: `<form id="rf" class="form-grid"><label class="field full"><span>Client (prénom et nom)</span><input class="input" name="client" required></label><label class="field"><span>Date de la demande</span><input class="input" type="date" name="date" value="${today()}"></label><label class="field"><span>Date effective</span><input class="input" type="date" name="effective" value="${addDays(today(), 30)}"></label><label class="field"><span>Motif</span><select class="input" name="reason">${RES_REASONS.map(r => `<option>${r}</option>`).join('')}</select></label><label class="field"><span>Reçue</span><select class="input" name="source"><option value="accueil">À l’accueil</option><option value="manuel">Par téléphone ou courrier</option><option value="mail">Par e-mail</option></select></label><label class="field"><span>Demande</span><select class="input" name="type"><option value="resiliation">Résiliation</option><option value="suspension">Suspension</option></select></label><label class="row full small"><input type="checkbox" name="mine" checked> Je m’en occupe</label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="resCreate">Créer le dossier</button>' });
ACTIONS.resCreate = () => {
  const f = formData($('#rf')); if (!f.client.trim()) { toast('Indiquez le nom du client.'); return; }
  const id = newId();
  // Réception : maintenant pour une demande du jour, sinon minuit (Paris) du jour indiqué.
  const now = Date.now(); const date = f.date || today(); const receivedAt = date === today() ? now : minuitParis(date);
  db.set(['resiliations', id], { id, clubId: CLUB.id, client: f.client.trim(), date, effective: f.effective || null, reason: f.reason, status: f.mine ? 'traitement' : 'nouvelle', saved: false, ownerId: f.mine ? ME.id : null, userId: f.mine ? ME.id : null,
    source: ['accueil', 'manuel', 'mail'].includes(f.source) ? f.source : 'manuel', type: f.type === 'suspension' ? 'suspension' : 'resiliation', receivedAt, dueAt: receivedAt + resSlaHeures() * 3600000,
    actions: [{ at: now, by: ME.id, label: 'Demande enregistrée' }], at: now, ...resLienAuto(CLUB.id, { name: f.client.trim() }) });
  closeModal(); toast('1 dossier créé'); resDedupe(CLUB.id);
};
ACTIONS.resDel = async el => { if (await confirmDlg('Supprimer définitivement cette demande ?', { ok: 'Supprimer', danger: true })) { db.batch([[['resiliations', el.dataset.id], null], [['entries', 'sv_' + el.dataset.id], null]]); closeModal(); } };
ACTIONS.resExport = () => {
  const list = resList(CLUB.id).sort((a, b) => a.date.localeCompare(b.date));
  const csv = ['Demande;Effective;Client;Motif;Statut;Responsable;Dernière action', ...list.map(r => [dmy(r.date), r.effective ? dmy(r.effective) : '', r.client, r.reason || '', RES_STATUS[resStatus(r)].label, r.ownerId ? fullName(S.users[r.ownerId]) : '', (resActions(r).slice(-1)[0] || {}).label || ''])];
  downloadFile(`resiliations-${norm(CLUB.name).replace(/ /g, '-')}-CONFIDENTIEL.csv`, toCsv(csv[0].split(';'), csv.slice(1)), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'resiliations', lignes: list.length });
};

// ── Impayés : le tableur de suivi ─────────────────────────────────────────
const DUN_STATUS = {
  arelancer: { label: 'À relancer', cls: 'warn' },
  relance: { label: 'Relancé', cls: 'info' },
  promesse: { label: 'Promesse de paiement', cls: 'info' },
  recupere: { label: 'Récupéré', cls: 'ok' },
  a_verifier: { label: 'Soldé, à vérifier', cls: 'warn' },
  perdu: { label: 'Huissier / perdu', cls: 'bad' },
};
const dunOf = c => c.dunning || {};
const dunStatus = c => dunPromiseLate(c) ? 'arelancer' : Number(c.balance) > 0 ? (dunOf(c).status && !['recupere', 'a_verifier'].includes(dunOf(c).status) ? dunOf(c).status : 'arelancer') : (['recupere', 'a_verifier'].includes(dunOf(c).status) ? dunOf(c).status : null);
function dunRows(clubId) {
  return Object.values(S.clients).filter(c => c.clubId === clubId && (Number(c.balance) > 0 || ['recupere', 'a_verifier'].includes(dunOf(c).status)));
}
function dunDue(c) { const n = dunOf(c).next; return Number(c.balance) > 0 && (dunPromiseLate(c) || !n || n <= today()); }
// Jours d'ouverture d'un dossier : date de régularisation (ou aujourd'hui) moins date d'apparition de l'impayé.
function joursOuvert(c, t = today()) {
  const d = dunOf(c); const start = c.oldestIncident || c.balanceAt || d.since; if (!start) return null;
  const end = ['recupere', 'a_verifier'].includes(d.status) && d.recoveredAt ? d.recoveredAt : t;
  return Math.max(0, Math.round((dateOf(end) - dateOf(start)) / 864e5));
}
// Promesse échue : date promise passée (le lendemain), solde toujours dû. Le dossier repasse « À relancer ».
const dunPromiseDate = c => dunOf(c).promiseDate || dunOf(c).next || null;
function dunPromiseLate(c, t = today()) { const d = dunOf(c); if (d.status !== 'promesse' || !(Number(c.balance) > 0)) return false; const p = dunPromiseDate(c); return !!p && p < t; }
const medianOf = a => { const b = a.filter(x => x != null && Number.isFinite(x)).sort((x, y) => x - y); if (!b.length) return null; const m = Math.floor(b.length / 2); return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
// En-tête de la page Impayés.
function dunStats(clubId, mk, t = today()) {
  const rows = dunRows(clubId); const open = rows.filter(c => Number(c.balance) > 0);
  const closed = rows.filter(c => ['recupere', 'a_verifier'].includes(dunOf(c).status) && (dunOf(c).recoveredAt || '').slice(0, 7) === mk);
  const rg = { from: mk + '-01', to: `${mk}-${daysIn(mk)}` }; const all = recoveredFor(clubId, rg), team = recoveredFor(clubId, rg, 'equipe');
  return {
    medianJours: medianOf(closed.map(c => joursOuvert(c, t))), nClos: closed.length,
    partEquipe: all ? team / all : null, team, all,
    du30: Math.round(open.filter(c => (joursOuvert(c, t) || 0) > 30).reduce((s, c) => s + Number(c.balance), 0) * 100) / 100, n30: open.filter(c => (joursOuvert(c, t) || 0) > 30).length,
    promessesEchues: open.filter(c => dunPromiseLate(c, t)).length,
  };
}

PAGES.impayes = {
  title: 'Impayés',
  render() {
    const tab = isManager() ? (UI.impTab2 || 'suivi') : 'suivi';
    const head = `<div class="page-head"><div><h1>Impayés</h1><p>${esc(nomAffiche())} · le suivi de chaque dossier, alimenté par les imports Resamania.</p></div><span class="spacer"></span><button class="btn" data-act="dunExport">${ico('download')} Exporter</button>${isManager() ? `<button class="btn primary" data-act="dunNew">${ico('plus')} Ajouter un impayé</button>` : ''}</div>`;
    return head + (isManager() ? tabs('impTab2', [['suivi', 'Suivi des dossiers'], ['canaux', 'Récupéré par canal']], tab) : '') + (tab === 'suivi' ? dunTable() : impayesAnalyse.render());
  },
};
// Ancienneté de la dette : today() moins la date du solde (c.balanceAt). Date inconnue : plus de 60 jours.
const DETTE_AGE = [[15, '0 à 15 jours'], [30, '16 à 30 jours'], [60, '31 à 60 jours'], [Infinity, 'plus de 60 jours']];
const detteAge = c => c.balanceAt ? Math.max(0, Math.round((dateOf(today()) - dateOf(String(c.balanceAt).slice(0, 10))) / 864e5)) : null;
const detteTranche = c => { const a = detteAge(c); return a == null ? 3 : DETTE_AGE.findIndex(t => a <= t[0]); };
function detteTranches(open) { return DETTE_AGE.map((t, i) => { const L = open.filter(c => detteTranche(c) === i); return { i, label: t[1], n: L.length, v: Math.round(L.reduce((s, c) => s + Number(c.balance), 0) * 100) / 100 }; }); }
// Message SMS (réglage commun dunSms) : {prénom} et {montant} remplacés.
function dunSmsTexte(c) {
  const tpl = reglage('dunSms', DUN_SMS_DEFAUT); const montant = fmtE(Number(c.balance)).replace(/\s*€$/, '');
  return remplirMessage(tpl, { prenom: (c.first || c.name || '').trim().split(/\s+/)[0] || '', montant, club: CLUB ? CLUB.name : '' });
}
ACTIONS.dunSms = el => {
  const c = S.clients[el.dataset.id]; const txt = dunSmsTexte(c);
  const done = () => { db.batch([dunPatch(c, {}, 'Message de relance copié')]); toast('1 message copié'); };
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done, () => { openModal({ title: 'Message à envoyer', body: `<textarea class="input" rows="5" readonly>${esc(txt)}</textarea>`, foot: '<button class="btn" data-close>Fermer</button>' }); done(); });
};
function dunTable() {
  const f = UI.dunFilter || 'todo';
  const rows = dunRows(CLUB.id).filter(mesDossiersDun);
  const open = rows.filter(c => Number(c.balance) > 0);
  const mk = curMonth();
  const recMonth = rows.filter(c => dunOf(c).status === 'recupere' && (dunOf(c).recoveredAt || '').slice(0, 7) === mk);
  const total = open.reduce((s, c) => s + Number(c.balance), 0);
  const rgM = { from: mk + '-01', to: `${mk}-${daysIn(mk)}` }; const recTot = recoveredFor(CLUB.id, rgM), recTeam = recoveredFor(CLUB.id, rgM, 'equipe');
  const pick = {
    todo: c => Number(c.balance) > 0 && dunStatus(c) !== 'perdu',
    due: c => dunDue(c) && dunStatus(c) !== 'perdu',
    mine: c => Number(c.balance) > 0 && dunOf(c).ownerId === ME.id,
    nobody: c => Number(c.balance) > 0 && !dunOf(c).ownerId,
    promesse: c => dunStatus(c) === 'promesse',
    recupere: c => ['recupere', 'a_verifier'].includes(dunOf(c).status) && (dunOf(c).recoveredAt || '').slice(0, 7) === mk,
    perdu: c => dunStatus(c) === 'perdu',
  };
  const q = norm(UI.dunQ || ''); const ageF = UI.dunAge === '' || UI.dunAge == null ? null : Number(UI.dunAge);
  const ageOf = c => { const a = detteAge(c); return a == null ? 1e6 : a; };
  const list = rows.filter(pick[f]).filter(c => !q || norm(c.name).includes(q) || String(c.num || '').includes(q)).filter(c => ageF == null || (Number(c.balance) > 0 && detteTranche(c) === ageF))
    .sort(UI.dunSort === 'age' ? (a, b) => ageOf(b) - ageOf(a) : UI.dunSort === 'age-' ? (a, b) => ageOf(a) - ageOf(b) : (a, b) => (Number(b.balance) > 0 && Number(a.balance) > 0 ? dunAttendu(b) - dunAttendu(a) : 0) || (Number(b.balance) - Number(a.balance)) || (dunOf(b).recoveredAt || '').localeCompare(dunOf(a).recoveredAt || ''));
  const anc = detteTranches(open);
  const tranches = DUN_AGE.map((t, i) => { const L = open.filter(c => dunTranche(c) === i); return { t, n: L.length, v: L.reduce((s, c) => s + Number(c.balance), 0) }; });
  const late30 = open.filter(c => dunAge(c) > 30 && !dunOf(c).ownerId);
  const members = clubMembers(CLUB.id);
  const cnt = k => rows.filter(pick[k]).length;
  const empty = !rows.length;
  const K = dunStats(CLUB.id, mk);
  return `<div class="stat-row dun-head">
      <div class="stat"><span>Délai médian du mois</span><b>${K.medianJours == null ? 'n.d.' : plur(K.medianJours, 'jour', 'jours')}</b><small>${plur(K.nClos, 'dossier régularisé', 'dossiers régularisés')} en ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</small></div>
      <div class="stat"><span>Part récupérée par l’équipe</span><b>${fmtP(K.partEquipe)}</b><small><span class="trace-n"${traceAttr({ t: 'recov', canal: 'equipe', club: CLUB.id, from: mk + '-01', to: `${mk}-${daysIn(mk)}`, v: K.team })}>${fmtE(K.team)}</span> sur ${fmtE(K.all)}</small></div>
      <div class="stat ${K.du30 ? 'alarm' : ''}"><span>Encore dû, plus de 30 jours</span><b>${fmtE(K.du30)}</b><small>${plur(K.n30, 'dossier', 'dossiers')}</small></div>
      <div class="stat ${K.promessesEchues ? 'alarm' : ''}"><span>Promesses échues</span><b>${plur(K.promessesEchues, 'dossier', 'dossiers')}</b><small>repassées « À relancer »</small></div></div>
    <div class="stat-row">
      <div class="stat hot"><span>Total dû</span><b>${fmtE(total)}</b><small>${plur(open.length, 'dossier ouvert', 'dossiers ouverts')}</small></div>
      <div class="stat ${cnt('due') ? 'alarm' : ''}"><span>À relancer aujourd’hui</span><b>${plur(cnt('due'), 'dossier', 'dossiers')}</b><small>${cnt('nobody')} sans responsable</small></div>
      <div class="stat"><span>Récupéré en ${MOIS[Number(mk.slice(5)) - 1].toLowerCase()}</span><b class="ok"><span class="trace-n"${traceAttr({ t: 'recov', canal: 'all', club: CLUB.id, from: rgM.from, to: rgM.to, v: recTot })}>${fmtE(recTot)}</span></b><small>tous canaux · dont équipe ${fmtE(recTeam)}</small></div>
      <div class="stat"><span>Dossiers soldés ce mois</span><b>${plur(recMonth.length, 'dossier', 'dossiers')}</b><small>passés en « Récupéré »</small></div></div>
    ${open.length ? `<div class="age-tiles">${tranches.map(x => `<div class="age-tile ${x.t[3]}"><span>${x.t[2]}</span><b>${fmtE(x.v)}</b><small>${plur(x.n, 'dossier', 'dossiers')} · attendu ${fmtP(x.t[1])}</small></div>`).join('')}</div>` : ''}
    ${open.length ? `<div class="card dette-age" style="margin-bottom:12px;padding:12px 14px"><div class="row wrap"><b>Ancienneté de la dette</b><span class="muted small spacer">depuis la date du solde ; date inconnue comptée dans « plus de 60 jours »</span>${ageF != null ? `<button class="btn sm ghost" data-act="ui" data-key="dunAge" data-val="">Toutes les anciennetés</button>` : ''}</div>
      <div class="dette-bar" role="group" aria-label="Ancienneté de la dette">${anc.map(x => `<button class="dette-t t${x.i} ${ageF === x.i ? 'on' : ''}" data-act="ui" data-key="dunAge" data-val="${ageF === x.i ? '' : x.i}" data-tranche="${x.i}" data-v="${x.v}" style="flex:${Math.max(x.v, total * 0.08) || 1}" aria-pressed="${ageF === x.i}"><span>${x.label}</span><b>${fmtE(x.v)}</b><small>${plur(x.n, 'dossier', 'dossiers')}</small></button>`).join('')}</div></div>` : ''}
    ${late30.length ? `<div class="alert" style="margin-bottom:12px">${ico('alert')}<div><b>${plur(late30.length, 'dossier a passé', 'dossiers ont passé')} 30 jours sans responsable</b>${late30.slice(0, 4).map(c => esc(c.name || '')).join(', ')}. Chaque semaine perdue fait baisser la chance de récupérer.</div></div>` : ''}
    ${empty ? `<div class="alert info" style="margin-bottom:14px">${ico('info')}<div><b>Aucun impayé pour l’instant</b>Dans Imports Resamania, déposez « Clients en incident » (Points d’attention) et la liste Incidents : chaque client débiteur devient une ligne ici.</div></div>` : ''}
    <div class="row wrap" style="margin-bottom:10px">${seg('dunFilter', [['todo', `En cours ${cnt('todo')}`], ['due', `À relancer ${cnt('due')}`], ['mine', `Mes dossiers ${cnt('mine')}`], ['nobody', `Sans responsable ${cnt('nobody')}`], ['promesse', `Promesses ${cnt('promesse')}`], ['recupere', `Récupérés ${cnt('recupere')}`], ['perdu', `Perdus ${cnt('perdu')}`]], f)}<span class="spacer"></span><input class="input sm" style="width:190px" placeholder="Nom ou n° client" data-input="dunQ" data-focus="dunQ" value="${esc(UI.dunQ || '')}"></div>
    ${list.length ? `<div class="table-wrap sheet"><table class="t"><thead><tr><th>Client</th><th class="num">Montant</th><th class="num sortable" data-act="ui" data-key="dunSort" data-val="${UI.dunSort === 'age' ? 'age-' : 'age'}" aria-sort="${UI.dunSort === 'age' ? 'descending' : UI.dunSort === 'age-' ? 'ascending' : 'none'}">Âge${UI.dunSort === 'age' ? ' ▼' : UI.dunSort === 'age-' ? ' ▲' : ''}</th><th>Ouvert depuis</th><th class="num">Attendu</th><th>Statut</th><th>Responsable</th><th>Prochaine relance</th><th>Note</th><th></th></tr></thead><tbody>
    ${list.slice(0, Number(UI.dunMax || 100)).map(c => { const d = dunOf(c); const st = dunStatus(c); const rec = st === 'recupere';
      return `<tr class="${dunDue(c) ? 'due' : ''}"><td><a href="#/client/${esc(c.id)}"><b>${esc(c.name || 'Sans nom')}</b></a><div class="muted small">${c.num ? 'n° ' + esc(c.num) : ''}${c.phone ? ' · ' + esc(c.phone) : ''}${c.incidents ? ' · ' + plur(c.incidents, 'incident', 'incidents') : ''}</div></td>
        <td class="num"><b>${fmtE(rec ? d.amount || 0 : Number(c.balance))}</b></td>
        <td class="num nowrap" data-age="${detteAge(c) ?? ''}">${rec ? '' : detteAge(c) == null ? '<span class="muted small">date inconnue</span>' : plur(detteAge(c), 'jour', 'jours')}</td>
        <td class="small nowrap">${rec ? `soldé le ${dm(d.recoveredAt)}${joursOuvert(c) != null ? ' · ' + plur(joursOuvert(c), 'jour', 'jours') : ''}` : `<span class="age-b ${DUN_AGE[dunTranche(c)][3]}">${joursOuvert(c) == null ? 'n.d.' : plur(joursOuvert(c), 'jour', 'jours')}</span>`}${dunPromiseLate(c) ? `<div class="bad">promesse du ${dm(dunPromiseDate(c))} non tenue</div>` : ''}</td>
        <td class="num">${rec ? '' : fmtE(dunAttendu(c))}</td>
        <td>${rec ? `<span class="badge ok">Récupéré${d.canal && RECOV_CHANNELS[d.canal] ? ' · ' + RECOV_CHANNELS[d.canal].label.toLowerCase() : ''}</span>${d.by ? `<div class="muted small">par ${esc(fullName(S.users[d.by]))}</div>` : ''}` : `<select class="input sm" data-change="dunSet" data-id="${c.id}" data-k="status">${Object.entries(DUN_STATUS).filter(([k]) => k !== 'recupere').map(([k, v]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`}</td>
        <td>${rec ? '' : d.ownerId ? `<select class="input sm" data-change="dunSet" data-id="${c.id}" data-k="ownerId"><option value="">Aucun</option>${members.map(u => `<option value="${u.id}" ${d.ownerId === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select>` : `<button class="btn sm primary" data-act="dunTake" data-id="${c.id}">Je m’en occupe</button>`}</td>
        <td>${rec ? '' : `<input class="input sm" type="date" value="${d.next || ''}" data-change="dunSet" data-id="${c.id}" data-k="next">`}</td>
        <td><input class="input sm note" value="${esc(d.note || '')}" placeholder="Ajouter une note" data-change="dunSet" data-id="${c.id}" data-k="note"></td>
        <td class="nowrap">${rec ? '' : `${c.phone ? `<a class="btn sm" href="tel:${esc(String(c.phone).replace(/[^\d+]/g, ''))}" data-appel="1">${ico('phone')} Appeler</a> ` : ''}<button class="btn sm" data-act="dunSms" data-id="${c.id}">Copier le message</button> <button class="btn sm" data-act="dunLink" data-id="${c.id}" title="Copier un SMS avec le lien de paiement">Lien de paiement</button> <button class="btn sm ok-btn" data-act="dunPaid" data-id="${c.id}">Récupéré</button>`}</td></tr>`; }).join('')}</tbody></table></div>${list.length > Number(Number(UI.dunMax || 100)) ? `<button class="btn sm" style="margin-top:8px" data-act="ui" data-key="dunMax" data-val="${Number(UI.dunMax || 100) + 100}">Afficher 100 de plus (${list.length - Number(UI.dunMax || 100)} restants)</button>` : ''}`
      : `<div class="card">${emptyBox({ art: 'eur', title: f === 'mine' ? 'Aucun dossier à votre nom' : 'Rien dans cette vue', text: f === 'mine' ? 'Prenez un dossier sans responsable avec « Je m’en occupe ».' : 'Changez de filtre pour voir les autres dossiers.', cta: f === 'mine' ? '<button class="btn primary sm" data-act="ui" data-key="dunFilter" data-val="nobody">Voir les dossiers sans responsable</button>' : '<button class="btn sm" data-act="ui" data-key="dunFilter" data-val="todo">Voir les dossiers en cours</button>' })}</div>`}
    <p class="muted small">Un client absent du prochain export « Clients en incident » passe automatiquement en « Récupéré », avec le canal lu dans la liste Incidents (équipe, client en ligne, prélèvement…). Les notes, responsables et dates restent d’un import à l’autre.</p>`;
}
// Message de paiement prêt à envoyer (modifiable dans Réglages), noté dans l'historique.
const DUN_SMS = 'Bonjour {prenom}, il reste {montant} à régler sur votre abonnement. Vous pouvez payer en ligne depuis votre espace adhérent ou à l’accueil. Merci, l’équipe du club.';
ACTIONS.dunLink = el => {
  const c = S.clients[el.dataset.id]; const tpl = (S.clubs[CLUB.id] || {}).dunSms || DUN_SMS;
  const txt = tpl.replace(/\{prenom\}/g, (c.name || '').split(' ')[0]).replace(/\{montant\}/g, fmtE(Number(c.balance)));
  const done = () => { db.batch([dunPatch(c, {}, 'Lien de paiement envoyé')]); toast('1 message copié : collez-le dans un SMS'); };
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(done, () => { openModal({ title: 'Message de paiement', body: `<textarea class="input" rows="5" readonly>${esc(txt)}</textarea>`, foot: '<button class="btn" data-close>Fermer</button>' }); done(); });
};
ACTIONS.dunQ = el => { UI.dunQ = el.value; render(); };
function dunPatch(c, patch, label) {
  const d = { ...dunOf(c), ...patch };
  if (label) d.history = [...(dunOf(c).history || []), { at: Date.now(), by: ME.id, label }];
  return [['clients', c.id, 'dunning'], d];
}
ACTIONS.dunSet = el => {
  const c = S.clients[el.dataset.id]; const k = el.dataset.k; const v = el.value;
  const label = k === 'status' ? 'Statut : ' + DUN_STATUS[v].label : k === 'ownerId' ? 'Responsable : ' + (v ? fullName(S.users[v]) : 'aucun') : null;
  db.batch([dunPatch(c, { [k]: v || null }, label)]);
  if (k !== 'note') toast('1 valeur enregistrée');
};
ACTIONS.dunTake = el => { const c = S.clients[el.dataset.id]; db.batch([dunPatch(c, { ownerId: ME.id, status: dunStatus(c) === 'arelancer' ? 'relance' : dunStatus(c) }, 'Prise en charge')]); toast('1 dossier ajouté à vos relances'); };
ACTIONS.dunPaid = el => {
  const c = S.clients[el.dataset.id];
  openModal({ title: `Récupéré · ${c.name}`, body: `<form id="dpf" class="grid"><label class="field"><span>Montant encaissé (€)</span><input class="input" type="number" step="0.01" name="amount" value="${Number(c.balance) || ''}"></label>
    <div class="field"><span>Comment ?</span><div class="chips">${[['equipe', 'Encaissé par l’équipe'], ['client', 'Payé en ligne par le client'], ['auto', 'Prélèvement']].map(([k, l], i) => `<label class="chip-radio"><input type="radio" name="canal" value="${k}" ${i === 0 ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div></div>
    <p class="muted small" style="margin:0">Encaissé par l’équipe : le montant s’ajoute aux impayés récupérés de ${esc(fullName(S.users[dunOf(c).ownerId || ME.id]))} (KPI et prime).</p></form>`,
    foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="dunPaidSave">Valider</button>', onMount: m => { m.dataset.id = c.id; } });
};
ACTIONS.dunPaidSave = () => {
  const c = S.clients[$('.modal').dataset.id]; const f = formData($('#dpf')); const canal = $('#dpf input[name=canal]:checked').value;
  const amount = Math.round(toNum(f.amount) * 100) / 100;
  const ops = markPaid(c, amount, { canal, author: ME.id, from: 'impayes' }); closeModal();
  if (!ops.length) { toast(`${c.name} : dossier déjà soldé, rien à ajouter`); return; }
  db.batch(ops); toast(`Impayé récupéré : ${fmtE(amount)}, ${c.name}`);
};
// Un seul chemin pour « payé » (Impayés, Rétention, Relances, saisie détaillée) : markPaid.
//  - crédit unique : au responsable du dossier (dunning.ownerId), sinon à l'auteur de l'action ;
//  - dédoublonnage : un dossier déjà soldé ne crée plus rien (Rétention puis Impayés le même
//    jour = une seule saisie) ; à l'import, une régularisation équipe du même client, même
//    montant à 7 jours près, reconnaît la saisie (rsmCommitPlan) ;
//  - la saisie porte clientId et clientNum.
const arr2 = x => Math.round((Number(x) || 0) * 100) / 100;
function markPaid(c, amount, { canal = 'equipe', author = ME && ME.id, from = '', force = false } = {}) {
  if (!c) return [];
  const solde = arr2(c.balance); const montant = arr2(amount);
  if (!(montant > 0)) return [];
  const by = dunOf(c).ownerId || author;
  const id = 'dn_' + c.id + '_' + today();
  if (!(solde > 0)) {
    // Dossier déjà soldé : rien, sauf une saisie détaillée (force) qui n'a pas encore d'entrée ce jour-là.
    if (!force || S.entries[id] || canal !== 'equipe') return [];
    return [[['entries', id], { id, userId: by, clubId: c.clubId || CLUB.id, kpiId: 'impayes', date: today(), value: montant, source: 'manual', at: Date.now(), by: ME.id, from, clientId: c.id, clientNum: c.num || '' }]];
  }
  const ops = [[['clients', c.id, 'balance'], 0], dunPatch(c, { status: 'recupere', recoveredAt: today(), amount: montant, canal, by: canal === 'equipe' ? by : null }, `Récupéré (${fmtE(montant)})`)];
  if (canal === 'equipe') ops.push([['entries', id], { id, userId: by, clubId: c.clubId || CLUB.id, kpiId: 'impayes', date: today(), value: montant, source: 'manual', at: Date.now(), by: ME.id, from, clientId: c.id, clientNum: c.num || '', ...(from === 'retention' ? { needsCheck: true } : {}) }]);
  return ops;
}
// Ancienne signature (le crédit suit désormais la règle unique de markPaid).
const markPaidOps = (c, amount, canal, by, from) => markPaid(c, amount, { canal, author: by, from });
ACTIONS.dunNew = () => openModal({ title: 'Ajouter un impayé', body: `<form id="dnf" class="form-grid"><label class="field full"><span>Client (prénom et nom)</span><input class="input" name="name" required></label><label class="field"><span>N° client Resamania</span><input class="input" name="num"></label><label class="field"><span>Montant dû (€)</span><input class="input" type="number" step="0.01" name="amount" required></label><label class="field full"><span>Téléphone</span><input class="input" name="phone"></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="dunCreate">Ajouter</button>' });
ACTIONS.dunCreate = () => {
  const f = formData($('#dnf')); if (!f.name.trim() || !toNum(f.amount)) { toast('Nom et montant obligatoires.'); return; }
  const existing = f.num && Object.values(S.clients).find(c => c.clubId === CLUB.id && c.num === f.num.trim());
  const id = existing ? existing.id : newId();
  db.set(['clients', id], { ...(existing || { id, clubId: CLUB.id }), name: f.name.trim(), num: f.num.trim() || (existing || {}).num || '', phone: f.phone || (existing || {}).phone || '', balance: toNum(f.amount), balanceAt: today(), dunning: { status: 'arelancer', history: [{ at: Date.now(), by: ME.id, label: 'Ajouté à la main' }] } });
  closeModal(); toast('1 impayé ajouté');
};
ACTIONS.dunExport = () => {
  const rows = dunRows(CLUB.id);
  const csv = ['Client;N° client;Téléphone;Montant;Depuis;Statut;Responsable;Prochaine relance;Note;Récupéré le;Canal', ...rows.map(c => { const d = dunOf(c); const st = dunStatus(c);
    return [c.name, c.num || '', c.phone || '', String(st === 'recupere' ? d.amount || 0 : c.balance).replace('.', ','), c.balanceAt ? dmy(c.balanceAt) : '', st ? DUN_STATUS[st].label : '', d.ownerId ? fullName(S.users[d.ownerId]) : '', d.next ? dmy(d.next) : '', d.note || '', d.recoveredAt ? dmy(d.recoveredAt) : '', d.canal && RECOV_CHANNELS[d.canal] ? RECOV_CHANNELS[d.canal].label : '']; })];
  downloadFile(`impayes-${norm(CLUB.name).replace(/ /g, '-')}-${today()}-CONFIDENTIEL.csv`, toCsv(csv[0].split(';'), csv.slice(1)), 'text/csv;charset=utf-8');
  db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export_csv', club: CLUB.id, type: 'impayes', lignes: rows.length });
};
