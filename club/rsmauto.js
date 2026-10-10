/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — arrivées automatiques des exports Resamania ══════════════
// Les exports arrivent seuls (boîte dédiée ou dossier Drive, relevés chaque
// heure de 6 h à 22 h par outils/fitpulse-autoimport.mjs). Le serveur charge
// CE fichier et les vrais lecteurs de l'appli (readAnyFile, analyzeTable,
// rsmCommitPlan) : même détection par colonnes, même clé stable par ligne,
// donc même résultat qu'un dépôt à la main, sans doublon.
// Journal : S.rsm.autoLog[clubId][id] ; onglet « Arrivées automatiques ».

const RSM_TRONQUE = 'Fichier probablement tronqué';
const RSM_ATTENTE_JOURS = 8;
const RSM_SUIVIS = ['entries', 'recov', 'resiliations', 'prospects', 'clients'];

// Un fichier → écritures + ligne de journal. file = { name, size, arrayBuffer() }.
async function rsmIngestFile(file, { clubId, by = 'auto', now = Date.now(), source = 'auto' }) {
  const log = { id: 'a' + hkey(clubId + '|' + file.name + '|' + now), name: String(file.name || 'fichier').slice(0, 160), at: now, source, type: 'non utilisé', defs: [], rows: 0, nouvelles: 0, ignorees: 0, erreurs: [], avertissements: [], tronque: false, inconnus: 0 };
  let tables;
  try { tables = await readAnyFile(file); } catch (e) { log.erreurs.push('Lecture impossible : ' + String(e.message || e).slice(0, 160)); return { ops: [[['rsm', 'autoLog', clubId, log.id], log]], log }; }
  const month = addMonths(curMonth(), -1);
  const B = tables.map(t => { try { return analyzeTable(t, { clubId, month }); } catch (e) { log.erreurs.push(`${t.name} : ${String(e.message || e).slice(0, 120)}`); return { name: t.name, def: null, rowsCount: 0, entries: [], recov: [], clients: {}, clientsByName: [], resil: [], controls: [], prospects: [], companies: {}, flags: {}, counts: {}, warnings: [], skipped: {} }; } });
  for (const t of tables) if (t.skipped) log.avertissements.push(`${t.name} : ${t.skipped}`);
  const known = B.filter(r => r.def && !r.def.silent);
  log.defs = [...new Set(known.map(r => r.def.id))];
  log.type = known.length ? [...new Set(known.map(r => r.def.label))].join(', ') : 'non utilisé';
  for (const r of known) {
    log.rows += r.rowsCount;
    log.ignorees += Object.values(r.skipped || {}).reduce((a, b) => a + b, 0);
    // Ventes d'un vendeur encore inconnu : rien n'est attribué au hasard, à rapprocher dans Imports.
    const unk = r.entries.filter(e => e.seller && e.seller.status === 'unknown').length; log.inconnus += unk; log.ignorees += unk;
    if (r.def.family === 'liste' && r.rowsCount === 2000) { log.tronque = true; log.avertissements.push(`${RSM_TRONQUE} : ${r.name} compte exactement 2 000 lignes, plafond des listes Resamania. Refaites l’export sur une période plus courte.`); }
    (r.warnings || []).filter(w => !/2 000 lignes/.test(w)).forEach(w => log.avertissements.push(`${r.name} : ${w}`));
  }
  if (!known.length) return { ops: [[['rsm', 'autoLog', clubId, log.id], log]], log };
  const { ops, summary } = rsmCommitPlan(B, { club: clubId, choices: {}, by, now });
  const vus = new Set();
  for (const [p] of ops) if (p.length === 2 && RSM_SUIVIS.includes(p[0]) && !vus.has(p[0] + '/' + p[1])) { vus.add(p[0] + '/' + p[1]); if (!(S[p[0]] || {})[p[1]]) log.nouvelles++; }
  log.resume = { saisies: summary.entries, dejaConnues: summary.updated, regularisations: summary.recov, clients: summary.clients, resiliations: summary.resil };
  ops.forEach(([p]) => { if (p[0] === 'imports' && p.length === 2) ops.push([['imports', p[1], 'auto'], true]); });
  ops.push([['rsm', 'autoLog', clubId, log.id], log]);
  return { ops, log };
}

// Exports de la routine du lundi absents depuis plus de 8 jours (toutes origines confondues).
function rsmMissing(clubId, now = Date.now()) {
  const routine = deepGet(S, ['rsm', 'routine', clubId]) || {};
  return ROUTINE_WEEK.map(([id]) => ({ id, label: (defById(id) || {}).label || id, last: routine[id] || null })).filter(x => !x.last || now - x.last > RSM_ATTENTE_JOURS * 864e5);
}
function rsmAutoTab() {
  const L = Object.values(deepGet(S, ['rsm', 'autoLog', CLUB.id]) || {}).sort((a, b) => (b.at || 0) - (a.at || 0));
  const miss = rsmMissing(CLUB.id); const meta = deepGet(S, ['rsm', 'autoMeta', CLUB.id]) || {};
  const src = CLUB.rsmAuto || {};
  const hm = ts => { const d = new Date(ts); return `${dmy(isoOf(d))} à ${d.getHours()} h ${pad(d.getMinutes())}`; };
  return `${miss.length ? `<div class="alert" style="margin-bottom:14px">${ico('alert')}<div><b>${plur(miss.length, 'export attendu manque', 'exports attendus manquent')} depuis plus de ${RSM_ATTENTE_JOURS} jours</b>${miss.map(m => `${esc(m.label)} (${m.last ? 'dernier le ' + dm(isoOf(new Date(m.last))) : 'jamais reçu'})`).join(', ')}.</div></div>` : ''}
    <div class="card" style="margin-bottom:14px"><div class="card-head">${ico('upload')}<h3>Arrivées automatiques</h3><span class="spacer"></span><span class="muted small">${meta.lastRunAt ? 'Dernière relève le ' + hm(meta.lastRunAt) : 'Pas encore de relève'}</span>${isManager() ? '<button class="btn sm ghost" data-act="rsmAutoCfg">Réglages</button>' : ''}</div>
      <p class="muted small">Chaque heure de 6 h à 22 h, les pièces jointes CSV, XLSX ou ZIP reçues ${src.address ? `sur <b>${esc(src.address)}</b>` : 'sur la boîte dédiée'}${src.label ? ` (libellé « ${esc(src.label)} »)` : ''}${src.driveFolder ? ' et les fichiers du dossier Drive partagé' : ''} sont lues avec les mêmes règles qu’un dépôt à la main. Un fichier déjà reçu n’est jamais compté deux fois.</p>
      ${L.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Arrivée</th><th>Fichier</th><th>Type détecté</th><th class="num">Lignes lues</th><th class="num">Nouvelles</th><th class="num">Ignorées</th><th>Erreurs et avertissements</th></tr></thead><tbody>
        ${L.slice(0, 200).map(x => `<tr${x.tronque ? ' class="warn-row"' : ''}><td class="nowrap">${esc(hm(x.at))}</td><td>${esc(x.name)}${x.doublon ? ' <span class="badge">déjà reçu</span>' : ''}</td><td>${x.type === 'non utilisé' ? '<span class="badge">non utilisé</span>' : esc(x.type)}</td><td class="num">${fmtN(x.rows)}</td><td class="num">${fmtN(x.nouvelles)}</td><td class="num">${fmtN(x.ignorees)}</td><td class="small">${[...(x.erreurs || []).map(e => `<span class="bad">${esc(e)}</span>`), ...(x.avertissements || []).map(w => esc(w))].join('<br>') || '<span class="muted">aucun</span>'}${x.inconnus ? `<br><span class="muted">${plur(x.inconnus, 'vente', 'ventes')} d’un vendeur inconnu : <a href="#/imports" data-act="ui" data-key="impTab" data-val="rsm">à rapprocher</a></span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted small">Aucune arrivée pour l’instant.</p>'}</div>`;
}
ACTIONS.rsmAutoCfg = () => {
  const m = CLUB.rsmAuto || {};
  openModal({ title: 'Arrivées automatiques', body: `<form id="rsac" class="grid">
    <label class="field"><span>Adresse dédiée (ex. imports+${esc(CLUB.id)}@votredomaine.fr)</span><input class="input" type="email" name="address" value="${esc(m.address || '')}"></label>
    <label class="field"><span>Ou libellé Gmail</span><input class="input" name="label" value="${esc(m.label || '')}" placeholder="Resamania"></label>
    <label class="field"><span>Dossier Google Drive partagé (identifiant, facultatif)</span><input class="input" name="driveFolder" value="${esc(m.driveFolder || '')}"></label></form>`,
  foot: '<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="rsmAutoCfgOk">Enregistrer</button>' });
};
ACTIONS.rsmAutoCfgOk = () => {
  const f = formData($('#rsac'));
  db.set(['clubs', CLUB.id, 'rsmAuto'], { address: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.address.trim()) ? f.address.trim().toLowerCase() : null, label: f.label.trim().slice(0, 60) || null, driveFolder: f.driveFolder.trim().replace(/[^\w-]/g, '').slice(0, 80) || null });
  closeModal(); toast('1 jeu de réglages enregistré');
};
