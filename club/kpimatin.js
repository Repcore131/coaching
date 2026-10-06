'use strict';
// ══ FIT PULSE — KPI du matin ═════════════════════════════════════════════
// Le message « Résultat du jour » du groupe WhatsApp, prêt en un clic :
// 1. on dépose les exports Resamania de la veille (rien n'est écrit en base :
//    tout le monde peut s'en servir, commercial comme manager) ;
// 2. on complète ce que Resamania ne connaît pas (avis Google, relances) ;
// 3. « Créer mon SMS » remplit le modèle du club, « Envoyer » ouvre WhatsApp
//    avec le message prêt : il ne reste qu'à choisir le groupe.

const KM_DEFAULT = `Bonjour,
Resultat du jour

Objectifs {mois} :
Palier 1 : {palier1} ventes
Palier 2 : {palier2} ventes entrants
Palier 3 : {palier3}

Palier avis Google : {palier_avis}
Palier avis Google note : {note_google}

Abonnement : {abonnements}
Prospect mois : {prospects_mois}
Prospect du jour : {prospects_jour}
Prospect en ligne : {prospects_en_ligne}
Inscription en ligne : {inscriptions_en_ligne}
Contrat jour : {contrats_jour}
Contrat mois : {contrats_mois}
Ultimate/acces+ jour : {ultimate_jour}
Ultimate/access mois : {ultimate_mois}
Sortants du jour : {sortants_jour}
Sortants récupérés : {sortants_recuperes}
Vad : {vad}
Relances total : {relances}
Avis 5 étoiles jour : {avis_jour}
Bonne journée`;

// Champs du message : clé, libellé, document qui le remplit, saisie manuelle attendue.
const KM_FIELDS = [
  ['abonnements', 'Abonnés actifs', 'clients'],
  ['prospects_mois', 'Prospects du mois', 'prospects'],
  ['prospects_jour', 'Prospects du jour', 'prospects'],
  ['prospects_en_ligne', 'Prospects en ligne (jour)', 'prospects'],
  ['inscriptions_en_ligne', 'Inscriptions en ligne (jour)', 'ventes'],
  ['contrats_jour', 'Contrats du jour', 'ventes'],
  ['contrats_mois', 'Contrats du mois', 'ventes'],
  ['ultimate_jour', 'Ultimate / Access+ du jour', 'ventes'],
  ['ultimate_mois', 'Ultimate / Access+ du mois', 'ventes'],
  ['sortants_jour', 'Sortants du jour', 'resil'],
  ['sortants_recuperes', 'Sortants récupérés', 'resil'],
  ['vad', 'VAD (boutique, €)', 'lignes-factures'],
  ['relances', 'Relances total', 'app'],
  ['avis_jour', 'Avis 5 étoiles du jour', 'manuel'],
  ['palier1', 'Palier 1 (ventes)', 'paliers'],
  ['palier2', 'Palier 2 (ventes)', 'paliers'],
  ['palier3', 'Palier 3', 'paliers'],
  ['palier_avis', 'Palier avis Google', 'manuel'],
  ['note_google', 'Note Google visée', 'manuel'],
];
// Les documents demandés, dans l'ordre de la routine du matin.
const KM_DOCS = [
  ['ventes', 'Vente d’abonnements', 'Contrats jour et mois, Ultimate / Access+, inscriptions en ligne'],
  ['prospects', 'Prospects', 'Prospects du jour, du mois, en ligne'],
  ['resil', 'Résiliations', 'Sortants du jour, sortants récupérés'],
  ['clients', 'Clients club (Statut = Client)', 'Nombre d’abonnés actifs'],
  ['lignes-factures', 'Lignes de factures', 'VAD du jour (nutrition, accessoires)'],
];
const KM_ULTIMATE = /ultimate|acc?es+\s*\+|acc?es+\s*plus/i;
const KM_ONLINE = /web|en ligne|internet|site|online|digital/i;

function kmState() {
  if (!UI.km || UI.km.club !== CLUB.id) UI.km = { club: CLUB.id, day: addDays(today(), -1), res: [], vals: {}, text: '', step: 0 };
  return UI.km;
}
const kmCfg = () => (S.clubs[CLUB.id] || {}).kpiMatin || {};
const kmTemplate = () => kmCfg().template || KM_DEFAULT;
const kmLast = () => pref('kmLast', {}) || {};
// Résultats d'analyse des fichiers déposés, par type d'export.
const kmFile = id => kmState().res.filter(r => r.def && (r.def.id === id || (id === 'lignes-factures' && ['factures', 'lignes-avoirs'].includes(r.def.id))));

// Valeur de chaque champ et d'où elle vient (fichier déposé, Fit Pulse, dernière saisie, à saisir).
function kmCompute() {
  const K = kmState(); const day = K.day; const mk = day.slice(0, 7); const from = mk + '-01'; const club = CLUB.id;
  const out = {}; const set = (k, v, src) => { out[k] = { v, src }; };
  const inMonth = d => d >= from && d <= day;
  // Contrats, Ultimate / Access+, inscriptions en ligne
  const V = kmFile('ventes');
  if (V.length) {
    const E = V.flatMap(r => r.entries.filter(e => e.kpiId === 'contrats'));
    const src = 'fichier ' + V.map(r => r.name.split(' › ').pop()).join(', ');
    set('contrats_jour', E.filter(e => e.date === day).length, src); set('contrats_mois', E.filter(e => inMonth(e.date)).length, src);
    set('ultimate_jour', E.filter(e => e.date === day && KM_ULTIMATE.test(e.offer || '')).length, src); set('ultimate_mois', E.filter(e => inMonth(e.date) && KM_ULTIMATE.test(e.offer || '')).length, src);
    set('inscriptions_en_ligne', E.filter(e => e.date === day && e.online).length, src);
  } else {
    const live = Object.values(S.entries).filter(e => e && e.clubId === club && e.kpiId === 'contrats' && entryCounts(e));
    set('contrats_jour', sumRange(club, null, 'contrats', day, day), 'Fit Pulse'); set('contrats_mois', sumRange(club, null, 'contrats', from, day), 'Fit Pulse');
    set('ultimate_jour', live.filter(e => e.date === day && KM_ULTIMATE.test(e.offer || '')).length, 'Fit Pulse'); set('ultimate_mois', live.filter(e => inMonth(e.date) && KM_ULTIMATE.test(e.offer || '')).length, 'Fit Pulse');
    set('inscriptions_en_ligne', '', 'à saisir (déposez la vente d’abonnements)');
  }
  // Prospects
  const P = kmFile('prospects');
  if (P.length) {
    const L = P.flatMap(r => r.prospects); const src = 'fichier ' + P.map(r => r.name.split(' › ').pop()).join(', ');
    set('prospects_jour', L.filter(p => p.creeLe === day).length, src); set('prospects_mois', L.filter(p => inMonth(p.creeLe)).length, src);
    set('prospects_en_ligne', L.filter(p => p.creeLe === day && (KM_ONLINE.test(p.provenance || '') || (p.seller && p.seller.status === 'system'))).length, src);
  } else {
    const L = Object.values(S.prospects || {}).filter(p => p && p.clubId === club);
    set('prospects_jour', sumRange(club, null, 'prospects', day, day), 'Fit Pulse'); set('prospects_mois', sumRange(club, null, 'prospects', from, day), 'Fit Pulse');
    set('prospects_en_ligne', L.filter(p => p.creeLe === day && KM_ONLINE.test(p.provenance || '')).length, 'Fit Pulse');
  }
  // Sortants
  const R = kmFile('resil');
  if (R.length) {
    const L = R.flatMap(r => r.resil).filter(x => x.date === day); const src = 'fichier ' + R.map(r => r.name.split(' › ').pop()).join(', ');
    set('sortants_jour', L.filter(x => !x.saved).length, src); set('sortants_recuperes', L.filter(x => x.saved).length, src);
  } else {
    set('sortants_jour', Object.values(S.resiliations || {}).filter(x => x && x.clubId === club && !x.hidden && x.date === day && x.status !== 'sauvee').length, 'Fit Pulse');
    set('sortants_recuperes', sumRange(club, null, 'sauvetage', day, day), 'Fit Pulse');
  }
  // Abonnés actifs
  const C = kmFile('clients');
  if (C.length) { const n = C.reduce((s, r) => s + Object.values(r.clients).filter(c => !c.status || /client|actif/i.test(c.status)).length, 0); set('abonnements', n, 'fichier ' + C.map(r => r.name.split(' › ').pop()).join(', ') + (C.some(r => r.rowsCount === 2000) ? ' (tronqué à 2 000 lignes : vérifiez)' : '')); }
  else if (kmLast().abonnements) set('abonnements', kmLast().abonnements, 'dernière valeur saisie');
  else set('abonnements', Object.values(S.clients || {}).filter(c => c && c.clubId === club && /^client/i.test(c.status || '')).length || '', 'Fit Pulse (fiches clients)');
  // VAD
  const F = kmFile('lignes-factures');
  if (F.length) { const v = F.flatMap(r => r.entries).filter(e => e.date === day && ['nutrition', 'accessoires'].includes(e.kpiId)).reduce((s, e) => s + Number(e.value), 0); set('vad', Math.round(v * 100) / 100, 'fichier ' + F.map(r => r.name.split(' › ').pop()).join(', ')); }
  else set('vad', Math.round((sumRange(club, null, 'nutrition', day, day) + sumRange(club, null, 'accessoires', day, day)) * 100) / 100, 'Fit Pulse');
  // Relances faites dans l'application ce jour-là
  const d0 = dateOf(day).getTime(), d1 = d0 + 864e5;
  set('relances', Object.values(S.touches || {}).filter(t => t && t.clubId === club && t.at >= d0 && t.at < d1).length, 'historique des relances Fit Pulse');
  set('avis_jour', S.kpis.avis ? sumRange(club, null, 'avis', day, day) || '' : '', S.kpis.avis ? 'Fit Pulse (à vérifier)' : 'à saisir');
  // Paliers du mois (KPI contrats), puis objectifs avis Google retenus
  const pal = paliersFor(club, mk) || {}; const tiers = pal.contrats || Object.values(pal)[0] || [];
  ['palier1', 'palier2', 'palier3'].forEach((k, i) => { const t = tiers[i]; if (t && t.target) set(k, t.target, 'paliers du mois'); else set(k, kmLast()[k] || '', kmLast()[k] ? 'dernière valeur saisie' : 'à saisir'); });
  ['palier_avis', 'note_google'].forEach(k => set(k, kmLast()[k] || '', kmLast()[k] ? 'dernière valeur saisie' : 'à saisir'));
  return out;
}
const kmVal = (k, C) => (k in kmState().vals ? kmState().vals[k] : C[k] ? C[k].v : '');
const kmFmt = (k, v) => { if (v === '' || v == null) return ''; if (k === 'vad') { const n = parseMontant(String(v)); return Number.isNaN(n) ? String(v) : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€'; } return String(v); };
function kmBuild() {
  const C = kmCompute(); const day = kmState().day;
  const vars = { mois: monthLabel(day.slice(0, 7)).split(' ')[0], date: dmy(day) };
  KM_FIELDS.forEach(([k]) => { vars[k] = kmFmt(k, kmVal(k, C)); });
  return kmTemplate().replace(/\{([a-z_0-9]+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

PAGES.kpimatin = {
  title: 'KPI du matin',
  render() {
    const K = kmState(); const C = kmCompute(); const mgr = isManager(); const cfg = kmCfg();
    const docRow = ([id, label, feeds]) => {
      const f = kmFile(id); const d = defById(id);
      return `<div class="km-doc ${f.length ? 'ok' : ''}"><span class="badge ${f.length ? 'ok' : ''}" style="min-width:26px;justify-content:center">${f.length ? ico('check', 'ico ico-xs') : '·'}</span>
        <div class="spacer"><b>${esc(label)}</b><div class="muted small">${esc(feeds)}</div>${f.length ? `<div class="small">${esc(f.map(r => r.name.split(' › ').pop()).join(', '))}</div>` : d && d.path ? `<div class="muted small">Resamania : ${esc(d.path)}</div>` : ''}</div>
        <span class="muted small">${f.length ? 'déposé' : 'sinon : données Fit Pulse'}</span></div>`;
    };
    const field = ([k, label]) => { const c = C[k] || { v: '', src: '' }; const v = kmVal(k, C); const todo = v === '' || v == null;
      return `<label class="field ${todo ? 'km-todo' : ''}"><span>${esc(label)}</span><input class="input" data-input="kmSet" data-k="${k}" value="${esc(String(v ?? ''))}" inputmode="${k === 'vad' || k === 'note_google' ? 'decimal' : 'numeric'}" placeholder="à saisir"><small class="muted">${esc(k in K.vals ? 'modifié à la main' : c.src)}</small></label>`; };
    const unread = K.res.filter(r => !r.def || r.def.silent);
    return `<div class="page-head"><div><h1>KPI du matin</h1><p>Le message « Résultat du jour » du groupe WhatsApp, rempli à partir de vos exports Resamania.</p></div>
      <label class="field" style="margin:0"><span>Résultats du</span><input class="input" type="date" value="${K.day}" max="${today()}" data-change="kmDay"></label></div>
      <div class="card" style="margin-bottom:14px"><div class="card-head">${ico('upload')}<h3>1. Les documents de la veille</h3></div>
        <div class="drop" id="km-drop">${ico('upload')}<div class="title t-16" style="margin-top:6px">Déposez les exports Resamania</div><div class="muted small">Plusieurs à la fois : CSV, ZIP ou Excel. Rien n’est enregistré dans la base, ils servent seulement au message.</div></div>
        <input type="file" id="km-file" multiple accept="${FILE_ACCEPT}" hidden>
        ${K.reading ? '<p class="muted small">Lecture des fichiers…</p>' : ''}
        <div class="km-docs">${KM_DOCS.map(docRow).join('')}</div>
        ${unread.length ? `<p class="small muted" style="margin-bottom:0">${ico('info', 'ico ico-xs')} Non utilisé ici : ${esc(unread.map(r => r.name).join(', '))}</p>` : ''}
        ${K.res.length ? '<button class="btn sm ghost" style="margin-top:8px" data-act="kmClear">Retirer les fichiers</button>' : ''}</div>
      <div class="card" style="margin-bottom:14px"><div class="card-head">${ico('edit')}<h3>2. À vérifier et compléter</h3></div>
        <p class="muted small" style="margin-top:-6px">Les cases jaunes sont à remplir à la main (avis Google, objectifs). Les relances viennent de l’historique Fit Pulse : ajoutez vos SMS envoyés hors de l’application.</p>
        <div class="form-grid km-grid">${KM_FIELDS.map(field).join('')}</div></div>
      <div class="card" style="margin-bottom:14px"><div class="card-head">${ico('send')}<h3>3. Mon SMS</h3></div>
        ${K.step === 1 ? `<div class="km-progress" role="progressbar" aria-label="Création du message"><i style="width:${K.pct || 0}%"></i></div><p class="muted small">Création du message…</p>`
          : K.step === 2 ? `<textarea class="input km-text" id="km-text" rows="18" data-input="kmText">${esc(K.text)}</textarea>
            <div class="row wrap" style="gap:8px;margin-top:10px"><button class="btn primary" data-act="kmSend">${ico('send')} Envoyer sur WhatsApp</button>${navigator.share ? `<button class="btn" data-act="kmShare">${ico('share')} Partager…</button>` : ''}<button class="btn" data-act="kmCopy">${ico('copy')} Copier</button><button class="btn ghost" data-act="kmMake">Recréer</button></div>
            <p class="muted small" style="margin-bottom:0">WhatsApp s’ouvre avec le message prêt : choisissez le groupe${cfg.group ? ` « ${esc(cfg.group)} »` : ''} puis touchez Envoyer.</p>`
          : `<button class="btn primary lg" data-act="kmMake">${ico('send')} Créer mon SMS</button>`}</div>
      ${mgr ? `<details class="card"><summary><b>Modèle du message</b> <span class="muted small">(manager)</span></summary>
        <p class="muted small">Le texte envoyé chaque matin. Les mots entre accolades sont remplacés : ${['mois', 'date', ...KM_FIELDS.map(f => f[0])].map(k => `<code>{${k}}</code>`).join(' ')}</p>
        <form id="kmf" class="grid"><label class="field"><span>Nom du groupe WhatsApp (rappel affiché au moment d’envoyer)</span><input class="input" name="group" maxlength="80" value="${esc(cfg.group || '')}" placeholder="FITNESS PARK Niort KPI"></label>
        <label class="field"><span>Modèle</span><textarea class="input km-text" name="template" rows="16">${esc(kmTemplate())}</textarea></label></form>
        <div class="row" style="gap:8px"><button class="btn primary" data-act="kmCfgSave">Enregistrer le modèle</button><button class="btn ghost" data-act="kmCfgReset">Rétablir le modèle d’origine</button></div></details>` : ''}`;
  },
  mount() {
    const drop = $('#km-drop'); if (!drop) return; const input = $('#km-file');
    drop.addEventListener('click', () => input.click());
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); kmRead([...e.dataTransfer.files]); });
    input.addEventListener('change', () => { const f = [...input.files]; input.value = ''; kmRead(f); });
  },
};
async function kmRead(files) {
  if (!files.length) return; const K = kmState(); K.reading = true; render();
  const month = K.day.slice(0, 7);
  for (const f of files) {
    let tables; try { tables = await readAnyFile(f); } catch (e) { tables = [{ name: f.name, skipped: 'Lecture impossible : ' + e.message }]; }
    for (const t of tables) {
      let r; try { r = analyzeTable(t, { clubId: CLUB.id, month }); } catch (e) { r = { name: t.name, def: null, entries: [], prospects: [], resil: [], clients: {} }; }
      // même type d'export déposé deux fois : le dernier remplace le précédent
      K.res = K.res.filter(x => !(x.def && r.def && x.def.id === r.def.id && x.name === r.name)); K.res.push(r);
    }
  }
  K.reading = false; K.step = 0; render();
  const ok = K.res.filter(r => r.def && !r.def.silent).length; toast(ok ? `${plur(ok, 'document reconnu', 'documents reconnus')}` : 'Aucun export Resamania reconnu dans ces fichiers.');
}
ACTIONS.kmDay = el => { const K = kmState(); K.day = el.value || addDays(today(), -1); K.vals = {}; K.step = 0; render(); };
ACTIONS.kmSet = el => { const K = kmState(); K.vals[el.dataset.k] = el.value; if (K.step === 2) K.step = 0; const lab = el.closest('.field'); if (lab) { lab.classList.toggle('km-todo', !el.value); const s = $('small', lab); if (s) s.textContent = 'modifié à la main'; } };
ACTIONS.kmText = el => { kmState().text = el.value; };
ACTIONS.kmClear = () => { const K = kmState(); K.res = []; K.step = 0; render(); };
ACTIONS.kmMake = () => {
  const K = kmState(); K.step = 1; K.pct = 0; render();
  // les objectifs saisis à la main sont retenus pour demain
  const C = kmCompute(); const keep = {}; ['abonnements', 'palier1', 'palier2', 'palier3', 'palier_avis', 'note_google'].forEach(k => { const v = kmVal(k, C); if (v !== '' && v != null) keep[k] = String(v); });
  setPref('kmLast', { ...kmLast(), ...keep });
  const t0 = Date.now(); const dur = 900;
  const tick = () => { if (!UI.km || UI.km.step !== 1) return; K.pct = Math.min(100, Math.round((Date.now() - t0) / dur * 100)); const bar = $('.km-progress i'); if (bar) bar.style.width = K.pct + '%';
    if (K.pct < 100) setTimeout(tick, 40); else { K.text = kmBuild(); K.step = 2; render(); } };
  setTimeout(tick, 40);
};
const kmText = () => { const ta = $('#km-text'); return ta ? ta.value : kmState().text; };
// wa.me ouvre WhatsApp (application ou WhatsApp Web) avec le message : on choisit le groupe et on envoie.
ACTIONS.kmSend = () => { const t = kmText(); window.open('https://wa.me/?text=' + encodeURIComponent(t), '_blank', 'noopener'); };
ACTIONS.kmShare = async () => { try { await navigator.share({ text: kmText() }); } catch (e) { /* partage annulé */ } };
ACTIONS.kmCopy = async () => { const t = kmText(); try { await navigator.clipboard.writeText(t); toast('Message copié'); } catch (e) { const ta = $('#km-text'); if (ta) { ta.select(); document.execCommand('copy'); toast('Message copié'); } } };
ACTIONS.kmCfgSave = () => { if (!isManager()) return; const f = formData($('#kmf')); db.set(['clubs', CLUB.id, 'kpiMatin'], { template: (f.template || '').trim() === KM_DEFAULT ? null : (f.template || '').slice(0, 4000), group: (f.group || '').trim().slice(0, 80) || null }); kmState().step = 0; toast('Modèle enregistré pour tout le club'); };
ACTIONS.kmCfgReset = async () => { if (!isManager()) return; if (await confirmDlg('Rétablir le modèle d’origine du message ?', { ok: 'Rétablir' })) { db.set(['clubs', CLUB.id, 'kpiMatin', 'template'], null); kmState().step = 0; render(); } };
