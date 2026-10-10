/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — prospects : étapes, colonnes, formulaires Meta ═══════════
// Modèle d'un prospect (S.prospects[id], sous /orgs/{org}/data/prospects en
// multi-salles) : nom, prénom, téléphone (phone, normalisé), source (site, meta,
// passage, parrainage, autre), étape (nouveau, contacté, visite, essai, signé,
// perdu), ownerId, prochaineAction { date, texte }. Les fiches importées de
// Resamania sans étape la reçoivent d'après leur suivi (prospEtape).
// Import des formulaires Meta (CSV) : doublons fusionnés par téléphone normalisé,
// identifiant stable : réimporter le même fichier ne crée aucun doublon.

const PR_ETAPES = [['nouveau', 'Nouveau'], ['contacte', 'Contacté'], ['visite', 'Visite'], ['essai', 'Essai'], ['signe', 'Signé'], ['perdu', 'Perdu']];
const PR_SOURCES = { site: 'Site', meta: 'Meta', passage: 'Passage', parrainage: 'Parrainage', autre: 'Autre' };
function prospSource(p) {
  if (PR_SOURCES[p.source]) return p.source; const t = norm(p.provenance || '');
  return /meta|facebook|instagram|\bfb\b|\big\b/.test(t) ? 'meta' : /site|web|internet|en ligne/.test(t) ? 'site' : /passage|accueil|club/.test(t) ? 'passage' : /parrain/.test(t) ? 'parrainage' : 'autre';
}
function prospEtape(p) {
  if (PR_ETAPES.some(([k]) => k === p.etape)) return p.etape;
  if (prospectConv(p)) return 'signe';
  const st = norm(p.statut || ''); const rl = typeof prospRel === 'function' ? prospRel(p) : null;
  if (rl && (['perdu', 'annule'].includes(rl.status))) return 'perdu';
  if (/essai/.test(st)) return 'essai'; if (/visite|rdv/.test(st) || (rl && rl.status === 'gagne')) return 'visite';
  if (/contact|injoignable/.test(st) || (rl && rl.touches && rl.touches.length)) return 'contacte';
  return 'nouveau';
}
const prospOwner = p => p.ownerId || (typeof prospRel === 'function' ? prospRel(p).ownerId : null) || p.commercialId || null;

// ── Vue en colonnes ───────────────────────────────────────────────────────
function prospColonnes() {
  const mine = (UI.prScope || (isManager() ? 'all' : 'mine')) === 'mine'; const q = norm(UI.prQ || ''); const src = UI.prSrc || 'all';
  const L = prospectsOf(CLUB.id).filter(p => (!mine || prospOwner(p) === ME.id) && (src === 'all' || prospSource(p) === src) && (!q || norm(`${pName(p)} ${p.phone || ''}`).includes(q)));
  const par = {}; PR_ETAPES.forEach(([k]) => { par[k] = []; }); L.forEach(p => par[prospEtape(p)].push(p));
  const carte = p => { const o = S.users[prospOwner(p)]; const pa = p.prochaineAction; const late = pa && pa.date && pa.date < today();
    return `<div class="pk-card" draggable="true" data-pid="${esc(p.id)}"><b>${esc(pName(p) || 'Prospect')}</b><div class="small">${p.phone ? esc(phoneFmt(phoneE164(p.phone) || p.phone)) : '<span class="muted">pas de téléphone</span>'}</div>
      <div class="row wrap" style="gap:4px;margin-top:4px"><span class="tag">${PR_SOURCES[prospSource(p)]}</span>${o ? `<span class="muted small">${esc(o.first)}</span>` : '<span class="muted small">non attribué</span>'}</div>
      ${pa && pa.date ? `<div class="small ${late ? 'bad' : ''}">${late ? 'En retard : ' : 'Prochaine action : '}${esc(dm(pa.date))}${pa.texte ? ' · ' + esc(pa.texte) : ''}</div>` : ''}
      <div class="row" style="gap:4px;margin-top:6px"><select class="input sm" data-change="pkEtape" data-pid="${esc(p.id)}" aria-label="Étape de ${esc(pName(p))}">${PR_ETAPES.map(([k, l]) => `<option value="${k}" ${prospEtape(p) === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn sm" data-act="pkAction" data-pid="${esc(p.id)}">Action</button></div></div>`; };
  return `<div class="row wrap" style="gap:8px;margin:12px 0"><button class="btn" data-act="prNew">${ico('plus')} Nouveau prospect</button><label class="btn">${ico('upload')} Importer des formulaires Meta (CSV)<input type="file" accept=".csv,text/csv" hidden data-change="metaImport"></label>
      <span class="spacer"></span><select class="input sm" style="width:auto" data-change="prSrc" aria-label="Source"><option value="all">Toutes les sources</option>${Object.entries(PR_SOURCES).map(([k, l]) => `<option value="${k}" ${src === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${seg('prScope', [['mine', 'Mes prospects'], ['all', 'Tout le club']], mine ? 'mine' : 'all')}</div>
    <div class="pk-board">${PR_ETAPES.map(([k, l]) => `<div class="pk-col" data-etape="${k}"><div class="pk-h"><b>${l}</b><span class="badge">${par[k].length}</span></div>${par[k].slice(0, 60).map(carte).join('')}${par[k].length > 60 ? `<p class="muted small">${par[k].length - 60} de plus</p>` : ''}</div>`).join('')}</div>`;
}
ACTIONS.prSrc = el => { UI.prSrc = el.value; render(); };
function pkSetEtape(pid, etape) {
  const p = S.prospects[pid]; if (!p || !PR_ETAPES.some(([k]) => k === etape)) return;
  db.batch([[['prospects', pid, 'etape'], etape], [['prospects', pid, 'etapeAt'], Date.now()], ...(!p.ownerId ? [[['prospects', pid, 'ownerId'], prospOwner(p) || ME.id]] : [])]);
}
ACTIONS.pkEtape = el => pkSetEtape(el.dataset.pid, el.value);
ACTIONS.pkAction = el => {
  const p = S.prospects[el.dataset.pid]; if (!p) return; const pa = p.prochaineAction || {};
  openModal({ title: `Prochaine action · ${pName(p)}`, body: `<form id="pkf" class="form-grid"><label class="field"><span>Le</span><input class="input" type="date" name="date" value="${esc(pa.date || addDays(today(), 1))}"></label><label class="field"><span>Quoi</span><input class="input" name="texte" maxlength="120" value="${esc(pa.texte || '')}" placeholder="Rappeler, confirmer la visite…"></label>
    <label class="field full"><span>Responsable</span><select class="input" name="owner">${clubMembers(CLUB.id).filter(u => !u.virtual).map(u => `<option value="${u.id}" ${prospOwner(p) === u.id ? 'selected' : ''}>${esc(fullName(u))}</option>`).join('')}</select></label></form>`,
  foot: `<button class="btn" data-close>Annuler</button><button class="btn primary" data-act="pkActionOk" data-pid="${esc(p.id)}">Enregistrer</button>` });
};
ACTIONS.pkActionOk = el => { const f = formData($('#pkf')); db.batch([[['prospects', el.dataset.pid, 'prochaineAction'], f.date ? { date: f.date, texte: (f.texte || '').trim().slice(0, 120) } : null], [['prospects', el.dataset.pid, 'ownerId'], f.owner || null]]); closeModal(); };
// Glisser une carte d'une colonne à l'autre (le menu « Étape » fait la même chose au clavier).
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.pk-card'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.pid); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.pk-col')) e.preventDefault(); });
document.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('.pk-col'); if (!col) return; e.preventDefault(); const pid = e.dataTransfer.getData('text/plain'); if (pid) pkSetEtape(pid, col.dataset.etape); });

// ── Import des formulaires Meta (CSV) ─────────────────────────────────────
// Colonnes reconnues : nom, prénom (ou nom complet), e-mail, téléphone, date de création.
function metaColonnes(headers) {
  const H = headers.map(norm); const f = (...ks) => H.findIndex(h => ks.some(k => h === k || h.replace(/ /g, '_') === k));
  return { nom: f('last name', 'last_name', 'nom', 'nom de famille'), prenom: f('first name', 'first_name', 'prenom'), complet: f('full name', 'full_name', 'nom complet', 'name'), email: f('email', 'e mail', 'adresse e mail', 'mail'), tel: f('phone number', 'phone_number', 'phone', 'telephone', 'numero de telephone', 'mobile'), date: f('created time', 'created_time', 'date', 'date de creation') };
}
// Plan d'import (fonction pure) : nouvelles fiches et fusions, identifiants stables.
function metaPlan(table, clubId, now = Date.now()) {
  const C = metaColonnes(table.headers || []); const ops = []; const res = { lues: 0, nouvelles: 0, fusionnees: 0, connues: 0, ignorees: 0 };
  const parTel = {}, parMail = {};
  Object.values(S.prospects || {}).filter(p => p && p.clubId === clubId).forEach(p => { const t = phoneE164(p.phone); if (t) parTel[t] = p; if (p.email) parMail[String(p.email).toLowerCase()] = p; });
  const vu = {};
  for (const r of table.rows || []) {
    res.lues++;
    const tel = C.tel >= 0 ? phoneE164(String(r[C.tel] || '').replace(/^p:/i, '')) : null; const mail = C.email >= 0 ? String(r[C.email] || '').trim().toLowerCase() : '';
    let prenom = C.prenom >= 0 ? String(r[C.prenom] || '').trim() : '', nom = C.nom >= 0 ? String(r[C.nom] || '').trim() : '';
    if (!prenom && !nom && C.complet >= 0) { const parts = String(r[C.complet] || '').trim().split(/\s+/); prenom = parts.shift() || ''; nom = parts.join(' '); }
    if (!tel && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { res.ignorees++; continue; }
    const cle = tel ? 't:' + tel : 'm:' + mail; const id = 'pmeta' + hkey(clubId + '|' + cle);
    const ex = vu[cle] || (tel && parTel[tel]) || (!tel && parMail[mail]) || S.prospects[id];
    const date = C.date >= 0 ? (parseDate(String(r[C.date] || '').slice(0, 10)) || today()) : today();
    if (ex) {
      // Fusion : on complète ce qui manque, jamais on n'écrase l'étape, le responsable ou le suivi.
      const patch = {}; if (!ex.prenom && prenom) patch.prenom = prenom; if (!ex.nom && nom) patch.nom = nom; if (!ex.email && mail) patch.email = mail; if (!ex.phone && tel) patch.phone = tel; if (!ex.source) patch.source = 'meta';
      Object.entries(patch).forEach(([k, v]) => ops.push([['prospects', ex.id, k], v])); vu[cle] = { ...ex, ...patch }; if (Object.keys(patch).length) res.fusionnees++; else res.connues++;
    } else {
      const p = { id, clubId, prenom, nom, phone: tel, email: mail || null, source: 'meta', provenance: 'Formulaire Meta', etape: 'nouveau', creeLe: date, at: now, importMeta: true };
      ops.push([['prospects', id], p]); vu[cle] = p; res.nouvelles++;
    }
  }
  return { ops, res };
}
ACTIONS.metaImport = async el => {
  const file = el.files[0]; el.value = ''; if (!file) return;
  let T; try { T = (await readAnyFile(file)).find(t => t.headers && t.rows); } catch (e) { toast('Lecture impossible : ' + e.message); return; }
  if (!T) { toast('Fichier vide ou illisible.'); return; }
  const C = metaColonnes(T.headers); if (C.tel < 0 && C.email < 0) { toast('Colonnes téléphone ou e-mail introuvables.'); return; }
  const { ops, res } = metaPlan(T, CLUB.id);
  ops.push([['audit', newId()], { at: Date.now(), by: ME.id, action: 'import_meta', club: CLUB.id, lignes: res.lues, nouvelles: res.nouvelles }]);
  db.batch(ops); toast(`Formulaires Meta : ${plur(res.nouvelles, 'nouveau prospect', 'nouveaux prospects')}, ${plur(res.fusionnees, 'fiche complétée', 'fiches complétées')}, ${plur(res.connues, 'déjà connu', 'déjà connus')}${res.ignorees ? `, ${res.ignorees} sans téléphone ni e-mail` : ''}`);
};
