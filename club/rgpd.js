/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Données et RGPD (Club et réglages, managers) ═══════════════
//  1. Ce que Fit Pulse conserve : catégorie, export Resamania source, durée,
//     rôles qui y accèdent ; exportable en CSV pour le registre du club.
//  2. Effacer un adhérent : fiche, relances et contacts supprimés, dossiers de
//     résiliation anonymisés (« Adhérent effacé »), toute autre mention du nom,
//     de l'e-mail ou du téléphone remplacée. S.audit ne garde que l'identifiant.
//  3. Purge au chargement : fiches dont la fin de contrat dépasse la durée de
//     conservation (24 mois par défaut, Réglages communs), avec compte rendu.

const CONSERVATION_DEFAUT = 24;
const conservationMois = () => Number(reglage('conservationMois', CONSERVATION_DEFAUT)) || CONSERVATION_DEFAUT;
const ANONYME = 'Adhérent effacé';
const RGPD_REGISTRE = () => [
  { cat: 'Identité', donnees: 'nom, prénom, numéro d’adhérent', source: 'Résumé clients, Clients (listes)', acces: 'managers, commerciaux du club' },
  { cat: 'Contact', donnees: 'téléphone, e-mail', source: 'Résumé clients, Clients en incident', acces: 'managers, commerciaux du club' },
  { cat: 'Contrat', donnees: 'offre, prix mensuel, dates de début et de fin d’engagement', source: 'Vente d’abonnements, Abonnements', acces: 'managers, commerciaux du club' },
  { cat: 'Solde', donnees: 'montant dû, incidents, régularisations', source: 'Clients en incident, liste Incidents', acces: 'managers, commerciaux du club' },
  { cat: 'Naissance', donnees: 'jour et mois seulement (sans l’année)', source: 'Résumé clients', acces: 'managers, commerciaux du club' },
].map(x => ({ ...x, duree: `${conservationMois()} mois après la fin du contrat` }));

// ── Effacement ────────────────────────────────────────────────────────────
const ACCENTS = { a: 'aàâä', e: 'eéèêë', i: 'iîï', o: 'oôö', u: 'uùûü', c: 'cç', y: 'yÿ' };
const motifSouple = s => String(s).trim().split('').map(ch => { const b = norm(ch); return ACCENTS[b] ? `[${ACCENTS[b]}${ACCENTS[b].toUpperCase()}]` : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('').replace(/\s+/g, '\\s+');
function motifsAdherent(c) {
  const nom = String(c.name || '').trim(); const toks = nom.split(/\s+/).filter(Boolean);
  const v = new Set([nom, toks.slice().reverse().join(' '), [c.first, c.last].filter(Boolean).join(' '), [c.last, c.first].filter(Boolean).join(' '), c.email || '', String(c.phone || '').trim()]);
  return [...v].filter(x => x && x.length >= 3).map(x => new RegExp(motifSouple(x), 'gi'));
}
// Opérations d'effacement d'une fiche (une écriture par enregistrement, jamais deux chemins imbriqués).
function effacementOps(c, { by = ME && ME.id, motif = 'erase' } = {}) {
  const num = c.num ? String(c.num) : null; const t = tokensKey(c.name || ''); const lie = r => r && r.clubId === c.clubId && (r.clientId === c.id || (num && String(r.num || r.clientNum || '') === num) || (t && tokensKey(r.client || r.name || '') === t));
  const M = motifsAdherent(c); const nettoie = v => { let s = JSON.stringify(v); M.forEach(re => { s = s.replace(re, ANONYME); }); return JSON.parse(s); };
  const ops = []; const vu = new Set();
  const poser = (col, id, v) => { vu.add(col + '|' + id); ops.push([[col, id], v]); };
  poser('clients', c.id, null);
  Object.values(S.loyalty || {}).forEach(a => { if (a && a.clientId === c.id) poser('loyalty', a.id, null); });
  Object.values(S.touches || {}).forEach(a => { if (a && a.clientId === c.id) poser('touches', a.id, null); });
  Object.keys(S.relances || {}).forEach(k => { if (k.includes(c.id)) poser('relances', k, null); });
  Object.values(S.recov || {}).forEach(x => { if (x && num && x.clubId === c.clubId && String(x.clientNum) === num) poser('recov', x.id, null); });
  Object.values(S.resiliations || {}).forEach(r => { if (lie(r)) poser('resiliations', r.id, nettoie({ ...r, client: ANONYME, clientId: null, num: null, clientNum: null })); });
  Object.values(S.resRequests || {}).forEach(r => { if (r && (r.clientId === c.id || lie(r))) poser('resRequests', r.id, nettoie({ ...r, clientId: null, email: null, from: null })); });
  Object.values(S.entries || {}).forEach(e => { if (e && (e.clientId === c.id || (num && e.clubId === c.clubId && String(e.clientNum || '') === num))) { const x = { ...e }; delete x.clientId; delete x.clientNum; poser('entries', e.id, nettoie(x)); } });
  Object.values(S.companies || {}).forEach(co => { if (co && num && (co.nums || []).includes(num)) poser('companies', co.id, nettoie({ ...co, nums: co.nums.filter(n => n !== num) })); });
  // Toute autre mention (notes, chat, demandes, réglages) : remplacée, enregistrement par enregistrement.
  const SAUF = new Set(['audit', 'clients', 'kpis', 'meta', 'users']);
  for (const [col, coll] of Object.entries(S)) {
    if (SAUF.has(col) || !coll || typeof coll !== 'object') continue;
    for (const [id, rec] of Object.entries(coll)) {
      if (vu.has(col + '|' + id) || rec == null) continue; const s = typeof rec === 'string' ? rec : JSON.stringify(rec);
      if (M.some(re => { re.lastIndex = 0; return re.test(s); })) poser(col, id, nettoie(rec));
    }
  }
  ops.push([['audit', newId()], { at: Date.now(), by: by || null, action: motif, club: c.clubId, clientId: c.id, ...(num ? { hash: eraseHash(c.clubId, num) } : {}) }]);
  return ops;
}
async function effacerAdherent(id) {
  const c = S.clients[id]; if (!c || !isManager()) return false;
  if (!await confirmDlg(`Effacer définitivement ${esc(c.name || 'cet adhérent')} ? Sa fiche, ses relances et ses contacts sont supprimés, ses dossiers de résiliation deviennent « ${ANONYME} ». Les chiffres de vente restent, sans lien vers la personne.`, { ok: 'Effacer', danger: true })) return false;
  db.batch(effacementOps(c)); toast('Adhérent effacé'); return true;
}
ACTIONS.cliErase = async el => { if (await effacerAdherent(el.dataset.id)) location.hash = '#/relances'; };
ACTIONS.rgpdEffacer = async el => { if (await effacerAdherent(el.dataset.id)) { UI.rgpdQ = ''; render(); } };

// ── Purge au chargement ───────────────────────────────────────────────────
function purgeCandidats(t = today()) {
  const limite = addMonths(t.slice(0, 7), -conservationMois()) + t.slice(7);
  return Object.values(S.clients || {}).filter(c => { const fin = c.end || c.endDate; return c && fin && String(fin).slice(0, 10) < limite && !(Number(c.balance) > 0); });
}
let PURGE_FAITE = false;
function purgeAuto() {
  if (PURGE_FAITE || !ME || !isManager() || !S) return 0; PURGE_FAITE = true;
  const L = purgeCandidats(); if (!L.length) return 0;
  const ops = []; L.forEach(c => ops.push(...effacementOps(c, { motif: 'purge' })));
  // une écriture par chemin (deux fiches peuvent toucher le même enregistrement)
  const fin = new Map(); ops.forEach(([p, v]) => fin.set(p.join('/'), [p, v]));
  db.batch([...fin.values()]); db.set(['settings', 'dernierePurge'], { at: Date.now(), n: L.length, by: ME.id });
  toast(`${plur(L.length, 'fiche purgée', 'fiches purgées')} (fin de contrat de plus de ${conservationMois()} mois)`);
  return L.length;
}

// ── Onglet ────────────────────────────────────────────────────────────────
function rgpdRegistreCsv() {
  const L = [['Traitement', 'Finalité', 'Catégorie', 'Données', 'Personnes concernées', 'Source', 'Durée de conservation', 'Accès', 'Hébergement'],
    ...RGPD_REGISTRE().map(x => ['Suivi commercial et rétention des adhérents', 'Relances, impayés, résiliations, objectifs de l’équipe', x.cat, x.donnees, 'Adhérents du club', `Export Resamania : ${x.source}`, x.duree, x.acces, backend.mode === 'local' ? 'navigateur du poste (mode local)' : 'base Firebase de l’espace du club'])];
  return '﻿' + L.map(r => r.map(v => /[;"\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v).join(';')).join('\r\n');
}
ACTIONS.rgpdExport = () => downloadFile(`registre-traitements-${slugFichier(CLUB.name)}-${today()}.csv`, rgpdRegistreCsv(), 'text/csv;charset=utf-8');
const slugFichier = s => norm(s || 'club').replace(/ /g, '-').slice(0, 40) || 'club';
function clubRgpd() {
  const q = norm(UI.rgpdQ || ''); const P = deepGet(S, ['settings', 'dernierePurge']);
  const res = q.length >= 2 ? clubClients(CLUB.id).filter(c => norm(c.name || '').includes(q) || String(c.num || '').includes(q)).slice(0, 10) : [];
  return `${backend.mode === 'local' ? `<div class="alert" style="margin-bottom:12px" data-local="1">${ico('alert')}<div>Les données de ce navigateur ne sont pas partagées. Ne l’utilisez pas sur un poste public.</div></div>` : ''}
    <div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Ce que Fit Pulse conserve</h3><span class="spacer"></span><button class="btn sm" data-act="rgpdExport">${ico('download')} Exporter le registre</button></div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Catégorie</th><th>Données</th><th>Source (export Resamania)</th><th>Durée de conservation</th><th>Qui y accède</th></tr></thead><tbody>
      ${RGPD_REGISTRE().map(x => `<tr><td><b>${esc(x.cat)}</b></td><td class="small">${esc(x.donnees)}</td><td class="small">${esc(x.source)}</td><td class="small">${esc(x.duree)}</td><td class="small">${esc(x.acces)}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted small">Durée réglable dans Réglages communs (actuellement ${conservationMois()} mois). Les fiches au-delà sont purgées au chargement de Fit Pulse par un manager${P ? `, dernière purge le ${esc(dm(isoOf(new Date(P.at))))} : ${plur(P.n, 'fiche', 'fiches')}` : ''}.</p></div>
    <div class="card"><h3>Effacer un adhérent</h3><p class="muted small">Droit à l’effacement : la fiche, les relances et les contacts sont supprimés ; les dossiers de résiliation deviennent « ${ANONYME} » ; le journal garde la date, l’auteur et l’identifiant seuls.</p>
      <input class="input" style="max-width:340px" placeholder="Nom ou numéro de l’adhérent" data-input="rgpdQ" data-focus="rgpdQ" value="${esc(UI.rgpdQ || '')}">
      ${res.length ? `<div style="margin-top:8px">${res.map(c => `<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--line)"><span class="spacer"><b>${esc(c.name || 'Sans nom')}</b> <span class="muted small">${c.num ? 'n° ' + esc(c.num) : ''}</span></span><button class="btn sm danger" data-act="rgpdEffacer" data-id="${esc(c.id)}">Effacer</button></div>`).join('')}</div>` : q.length >= 2 ? '<p class="muted small">Aucun adhérent trouvé.</p>' : ''}</div>`;
}
ACTIONS.rgpdQ = el => { UI.rgpdQ = el.value; render(); };
