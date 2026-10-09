/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — règles des dossiers de résiliation (RES_ENGINE) ═════════════
// Fonctions pures partagées par l'appli (pages-ops.js, res-suivi.js) et par les
// fonctions serveur (ingestion des e-mails, clôture de nuit, escalade, résumé du
// matin) : phase d'un dossier, rattachement à une fiche client, doublons,
// clôture automatique, paliers d'escalade. Aucune écriture, aucun réseau.

const RES_ENGINE = (() => {
  const H = 3600000, J = 864e5;
  const CALLS = ['Pas de réponse', 'Message laissé', 'RDV pris', 'Offre proposée', 'Refus'];
  const esc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Contact : un appel noté (issues d'appel) ou une réponse envoyée. « Prise en charge » n'en est pas un.
  const CONTACT = new RegExp('^(' + [...CALLS, 'Réponse envoyée'].map(esc).join('|') + ')');
  const actions = r => [...((r && r.actions) || []), ...Object.values((r && r.log) || {})].filter(Boolean).sort((a, b) => (a.at || 0) - (b.at || 0));
  const contacts = r => actions(r).filter(a => CONTACT.test(a.label || ''));
  const appels = r => actions(r).filter(a => a.out || CALLS.some(c => (a.label || '').startsWith(c)));
  const FERMES = ['sauvee', 'resiliee', 'rejetee'];
  const ISSUES_RETIREES = ['faux_positif', 'doublon'];
  // Statut affiché : une demande dont la date d'effet est passée sans sauvetage est partie.
  function statut(r, aujourdhui) { const s = r.status || (r.saved ? 'sauvee' : 'resiliee'); return s !== 'sauvee' && s !== 'averifier' && r.effective && r.effective < aujourdhui ? 'resiliee' : s; }
  // Phases : 'verifier' (score 2, à confirmer), 'attente' (l'adhérent attend une réponse), 'encours' (réponse
  // partie ou contact noté, pas de nouveau message depuis), 'close' (issue posée).
  function phase(r, aujourdhui) {
    if (r.hidden || ISSUES_RETIREES.includes(r.outcome)) return 'close';
    const st = statut(r, aujourdhui);
    if (r.outcome || FERMES.includes(st)) return 'close';
    if (st === 'averifier') return 'verifier';
    const m = r.mail; const dernier = Math.max(0, ...contacts(r).map(a => a.at || 0));
    if (m) { const attend = m.awaitingReply === true || (m.lastInAt && (!m.lastOutAt || m.lastInAt > m.lastOutAt)); return attend && !(dernier > (m.lastInAt || 0)) ? 'attente' : 'encours'; }
    return dernier ? 'encours' : 'attente';
  }
  const ouvert = (r, aujourdhui) => ['attente', 'encours'].includes(phase(r, aujourdhui));
  // Comptage : les faux positifs et les doublons ne comptent nulle part.
  const compte = r => !!r && !r.hidden && !ISSUES_RETIREES.includes(r.outcome);

  // ── Rattachement à une fiche client ───────────────────────────────────────
  const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const tokensKey = s => sansAccents(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).sort().join(' ');
  const email = s => sansAccents(s).trim();
  // Ordre : e-mail exact, numéro client, nom (jetons triés) unique ; sinon jusqu'à 3 fiches proches (au moins
  // un jeton commun de 3 lettres ou plus). confidence : 'forte' (e-mail, numéro), 'moyenne' (nom unique),
  // 'faible' (suggestions seulement), null (rien).
  function matchClient(clients, clubId, q) {
    const L = Object.values(clients || {}).filter(c => c && c.clubId === clubId);
    const un = f => { const x = L.filter(f); return x.length === 1 ? x[0] : null; };
    const e = email(q && q.email); const num = String((q && q.clientNum) || '').trim().toUpperCase();
    let c = e && un(x => email(x.email) === e); if (c) return { clientId: c.id, confidence: 'forte', candidates: [c.id] };
    c = num && un(x => String(x.num || '').trim().toUpperCase() === num); if (c) return { clientId: c.id, confidence: 'forte', candidates: [c.id] };
    const t = tokensKey(q && q.name); if (!t) return { clientId: null, confidence: null, candidates: [] };
    const memes = L.filter(x => tokensKey(x.name) === t);
    if (memes.length === 1) return { clientId: memes[0].id, confidence: 'moyenne', candidates: [memes[0].id] };
    if (memes.length > 1) return { clientId: null, confidence: 'faible', candidates: memes.slice(0, 3).map(x => x.id) };
    const jt = new Set(t.split(' ').filter(w => w.length >= 3));
    const proches = L.map(x => ({ x, n: tokensKey(x.name).split(' ').filter(w => jt.has(w)).length })).filter(o => o.n > 0)
      .sort((a, b) => b.n - a.n || String(a.x.name).localeCompare(String(b.x.name))).slice(0, 3).map(o => o.x.id);
    return { clientId: null, confidence: proches.length ? 'faible' : null, candidates: proches };
  }

  // ── Sources d'un dossier (badges et analyse) ──────────────────────────────
  const SOURCES = { mail: 'E-mail', appli: 'Appli', resamania: 'Resamania', accueil: 'Accueil' };
  function sources(r) {
    const s = new Set();
    if (r.mail || r.source === 'mail') s.add('mail');
    if (r.source === 'appli') s.add('appli');
    if (r.rsm || r.source === 'resamania') s.add('resamania');
    if (['accueil', 'manuel'].includes(r.source)) s.add('accueil');
    if (!s.size) s.add('accueil');
    return ['mail', 'appli', 'resamania', 'accueil'].filter(k => s.has(k));
  }
  const reception = r => r.receivedAt || r.at || 0;
  const sourceLabel = r => sources(r).map(k => SOURCES[k]).join(', ');

  // ── Doublons : même client, dossier ouvert créé il y a moins de 60 jours ───
  // Le plus ancien garde son id, son responsable et ses actions ; il reçoit les champs mail ou rsm de l'autre
  // et l'action « Dossier fusionné (source : ...) ». L'autre passe outcome 'doublon', hidden.
  function dedupePlan(dossiers, clubId, aujourdhui, maintenant) {
    const ops = []; const L = Object.values(dossiers || {}).filter(r => r && r.clubId === clubId && r.clientId && ouvert(r, aujourdhui));
    const par = {}; L.forEach(r => { (par[r.clientId] = par[r.clientId] || []).push(r); });
    for (const groupe of Object.values(par)) {
      if (groupe.length < 2) continue;
      groupe.sort((a, b) => reception(a) - reception(b) || String(a.id).localeCompare(String(b.id)));
      const garde = groupe[0];
      for (const autre of groupe.slice(1)) {
        if (reception(autre) - reception(garde) > 60 * J) continue;
        const champs = {};
        if (autre.mail && !garde.mail) champs.mail = autre.mail;
        if (autre.rsm && !garde.rsm) { champs.rsm = autre.rsm; if (!garde.effective && autre.effective) champs.effective = autre.effective; }
        ['email', 'phone', 'clientNum', 'effective', 'reason'].forEach(k => { if (!garde[k] && autre[k] && champs[k] === undefined) champs[k] = autre[k]; });
        if (autre.source && autre.source !== garde.source && !garde.source2) champs.source2 = autre.source;
        if (autre.importIds) champs.importIds = { ...(garde.importIds || {}), ...autre.importIds };
        ops.push({ id: garde.id, set: champs, action: { at: maintenant, by: 'system', label: `Dossier fusionné (source : ${sourceLabel(autre)})`, fusion: autre.id } });
        ops.push({ id: autre.id, set: { outcome: 'doublon', hidden: true, mergedInto: garde.id, closedAt: maintenant, closedBy: 'system', closedReason: 'doublon' } });
      }
    }
    return ops;
  }

  // ── Clôture automatique (après chaque import Resamania et chaque nuit à 2 h) ─
  const aRepondu = r => !!(r.mail && (r.mail.firstReplyAt || r.mail.outCount > 0)) || actions(r).some(a => /^Réponse envoyée/.test(a.label || ''));
  const aAction = (r, label) => actions(r).some(a => a.label === label);
  const moinsJours = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  function autoClosePlan(dossiers, clubId, aujourdhui, maintenant) {
    const ops = [];
    for (const r of Object.values(dossiers || {})) {
      if (!r || r.clubId !== clubId || r.hidden || ISSUES_RETIREES.includes(r.outcome) || r.status === 'averifier') continue;
      const etat = r.rsm && r.rsm.state;
      const ferme = { closedAt: maintenant, closedBy: 'resamania', closedReason: 'resamania' };
      if (etat === 'canceled' && r.outcome !== 'resiliee' && !aAction(r, 'Sauvetage confirmé par Resamania')) {
        ops.push({ id: r.id, prev: { status: r.status || null, outcome: r.outcome || null, saved: !!r.saved, closedAt: r.closedAt || null, closedBy: r.closedBy || null, closedReason: r.closedReason || null }, set: { status: 'sauvee', saved: true, outcome: 'sauvee', ...ferme }, action: { at: maintenant, by: 'system', label: 'Sauvetage confirmé par Resamania' }, proof: 'resamania' });
        continue;
      }
      // Les règles suivantes lisent le statut enregistré (une date d'effet passée n'est pas encore une clôture).
      if (!r.status || r.outcome || FERMES.includes(r.status)) continue;
      if (etat === 'accepted' && r.effective && r.effective < aujourdhui) {
        ops.push({ id: r.id, prev: { status: r.status || null, outcome: null, saved: !!r.saved, closedAt: null, closedBy: null, closedReason: null }, set: { status: 'resiliee', saved: false, outcome: 'resiliee', ...ferme }, action: { at: maintenant, by: 'system', label: 'Résiliation confirmée par Resamania' } });
        continue;
      }
      if (!appels(r).length && !aRepondu(r) && r.effective && r.effective < moinsJours(aujourdhui, 7)) {
        ops.push({ id: r.id, prev: { status: r.status || null, outcome: null, saved: !!r.saved, closedAt: null, closedBy: null, closedReason: null }, set: { status: 'resiliee', saved: false, outcome: 'resiliee', closedAt: maintenant, closedBy: 'system', closedReason: 'sans_contact' }, action: { at: maintenant, by: 'system', label: 'Clôturé sans contact' } });
      }
    }
    return ops;
  }

  // ── Escalade des demandes sans réponse ─────────────────────────────────────
  // Âge : depuis le dernier message de l'adhérent s'il a réécrit, sinon depuis la réception. Un palier déjà
  // franchi avant ce point de départ ne compte plus (une relance de l'adhérent relance le compteur).
  const depart = r => Math.max(reception(r), (r.mail && r.mail.lastInAt) || 0);
  const PALIERS = [{ k: 'h4At', h: 4 }, { k: 'h24At', h: 24 }, { k: 'h48At', h: 48 }];
  // Heure de Paris (0 à 23) d'un horodatage ; heures calmes de 22 h à 7 h.
  const heureParis = ms => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(new Date(ms)));
  const calme = ms => { const h = heureParis(ms); return h >= 22 || h < 7; };
  // Paliers dus maintenant pour un dossier en attente : le plus haut seulement (un seul message par passage).
  function paliersDus(r, maintenant) {
    const d = depart(r); if (!d) return [];
    const esc2 = r.escalation || {}; const age = maintenant - d;
    return PALIERS.filter(p => age >= p.h * H && !(esc2[p.k] && esc2[p.k] >= d));
  }

  // ── Obligation de confirmation écrite ───────────────────────────────────────
  // Résiliations issues d'un e-mail, validées depuis plus de 24 h : une réponse lue dans le fil après la validation ?
  const valideeA = r => r.validatedAt || r.closedAt || null;
  const confirmee = r => !!(r.mail && r.mail.lastOutAt && valideeA(r) && r.mail.lastOutAt > valideeA(r));
  function conformite(dossiers, clubId, maintenant) {
    const L = Object.values(dossiers || {}).filter(r => r && r.clubId === clubId && compte(r) && r.mail && (r.outcome === 'resiliee' || (!r.outcome && r.status === 'resiliee')) && valideeA(r) && maintenant - valideeA(r) > 24 * H);
    const ok = L.filter(confirmee).length; return { total: L.length, envoyees: ok, manquantes: L.length - ok, taux: L.length ? ok / L.length : null };
  }
  // Prénom et initiale du nom seulement (notifications).
  const nomCourt = s => { const p = String(s || '').trim().split(/\s+/).filter(Boolean); return p.length ? p[0] + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : '') : 'Un adhérent'; };

  return { CALLS, CONTACT, actions, contacts, appels, statut, phase, ouvert, compte, tokensKey, matchClient, SOURCES, sources, sourceLabel, reception, dedupePlan, autoClosePlan, aRepondu, depart, PALIERS, heureParis, calme, paliersDus, nomCourt, moinsJours, valideeA, confirmee, conformite };
})();
/* global module */
if (typeof module === 'object' && module && module.exports) module.exports = RES_ENGINE;
