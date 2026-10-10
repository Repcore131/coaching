/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
'use strict';
// ══ FIT PULSE : photo de profil, mascotte, défi de la semaine ════════════
// Photo : recadrage carré centré, 256 px, JPEG (qualité 0,8 puis moins si
// besoin) : 60 Ko au plus, stockée dans S.users[uid].photo. avatar() l'affiche
// partout (fil, classement, chat), sinon les initiales.
// Mascotte du tableau de bord : 4 choix, ou ma photo (prefs.mascotte).
// Défi de la semaine : 3 propositions calculées (KPI le plus en retard,
// record perso sur un KPI, nombre de relances) ou une cible libre ; tenu, il
// donne le trophée personnel « Défi tenu » et, si je l'accepte, un événement
// dans le fil. prefs.goal = { week, kpiId, target } ; historique prefs.goalHist[semaine].
const PHOTO_COTE = 256, PHOTO_MAX_OCTETS = 60 * 1024;
const DEFI_RELANCES = '_relances';
const MASCOTTES = { pouls: ['pouls', 'Pouls'], cible: ['target', 'Cible'], eclair: ['bolt', 'Éclair'], couronne: ['crown', 'Couronne'] };

// ── Photo ─────────────────────────────────────────────────────────────────
const octetsDataUrl = u => Math.floor((String(u).split(',')[1] || '').length * 3 / 4);
function photoCarree(file) {
  return new Promise((ok, ko) => {
    if (!file || !/^image\//.test(file.type || '')) { ko(new Error('pas une image')); return; }
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); ko(new Error('image illisible')); };
    img.onload = () => {
      const cote = Math.min(img.width, img.height); const sx = (img.width - cote) / 2, sy = (img.height - cote) / 2;
      const c = document.createElement('canvas'); c.width = c.height = PHOTO_COTE; c.getContext('2d').drawImage(img, sx, sy, cote, cote, 0, 0, PHOTO_COTE, PHOTO_COTE); URL.revokeObjectURL(url);
      let q = 0.8, d = c.toDataURL('image/jpeg', q); while (octetsDataUrl(d) > PHOTO_MAX_OCTETS && q > 0.3) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
      if (octetsDataUrl(d) > PHOTO_MAX_OCTETS) { ko(new Error('trop lourde')); return; } ok(d);
    };
    img.src = url;
  });
}
ACTIONS.photoChoisir = () => { const i = $('#photo-in'); if (i) i.click(); };
ACTIONS.photoFichier = async el => {
  const f = el.files && el.files[0]; el.value = ''; if (!f) return;
  if (!/^image\//.test(f.type || '')) { toast('Ce fichier n’est pas une image : 0 photo enregistrée'); return; }
  try { const d = await photoCarree(f); db.set(['users', ME.id, 'photo'], d); toast(`Photo enregistrée : ${Math.ceil(octetsDataUrl(d) / 1024)} Ko`); }
  catch (e) { toast('Image illisible : 0 photo enregistrée'); }
};
ACTIONS.photoRetirer = () => { db.set(['users', ME.id, 'photo'], null); if (prefsOf().mascotte === 'photo') setPrefPath(['mascotte'], 'pouls'); toast('Photo retirée : initiales affichées'); };
function photoCard() {
  return `<div class="card" id="ma-photo"><h3>Ma photo</h3><div class="row wrap" style="gap:14px;align-items:center">${avatar(ME, 'lg')}<div class="row wrap" style="gap:6px"><button class="btn primary" data-act="photoChoisir">${ico('upload')} ${ME.photo ? 'Changer la photo' : 'Ajouter une photo'}</button>${ME.photo ? '<button class="btn" data-act="photoRetirer">Retirer la photo</button>' : ''}</div></div>
    <input type="file" id="photo-in" accept="image/*" hidden data-change="photoFichier"><p class="muted small" style="margin:8px 0 0">Recadrée au carré, 256 px, 60 Ko au plus. Visible par l’équipe dans le fil, le classement et le chat.</p></div>`;
}
// ── Mascotte du tableau de bord ───────────────────────────────────────────
function mascotte(taille = 40) {
  const m = prefsOf().mascotte || 'pouls';
  if (m === 'photo' && ME.photo) return `<span class="mascotte photo" style="width:${taille}px;height:${taille}px"><img src="${esc(ME.photo)}" alt=""></span>`;
  return `<span class="mascotte" style="width:${taille}px;height:${taille}px" aria-hidden="true">${ico((MASCOTTES[m] || MASCOTTES.pouls)[0])}</span>`;
}
function mascotteChoix() {
  const cur = prefsOf().mascotte || 'pouls';
  return `<div class="field" style="margin-top:10px"><span>Mascotte du tableau de bord</span><div class="row wrap" style="gap:6px">${Object.entries(MASCOTTES).map(([k, [ic, l]]) => `<button class="btn sm ${cur === k ? 'primary' : ''}" data-act="mascotteSet" data-v="${k}" aria-pressed="${cur === k}">${ico(ic, 'ico ico-xs')} ${l}</button>`).join('')}<button class="btn sm ${cur === 'photo' ? 'primary' : ''}" data-act="mascotteSet" data-v="photo" ${ME.photo ? '' : 'disabled'} aria-pressed="${cur === 'photo'}">Utiliser ma photo</button></div></div>`;
}
ACTIONS.mascotteSet = el => setPrefPath(['mascotte'], el.dataset.v);

// ── Défi de la semaine ────────────────────────────────────────────────────
// Valeur d'un défi entre deux dates (relances notées, ou KPI).
function defiValeur(uid, clubId, kpiId, from, to) {
  if (kpiId === DEFI_RELANCES) { let n = 0; for (let d = from; d <= to; d = addDays(d, 1)) n += actionsDuJour(uid, d); return n; }
  return sumRange(clubId, uid, kpiId, from, to);
}
const defiUnite = (kpiId, v) => (kpiId === DEFI_RELANCES ? plur(v, 'relance', 'relances') : fmtU(v, S.kpis[kpiId]));
const defiNom = kpiId => (kpiId === DEFI_RELANCES ? 'relances notées' : (S.kpis[kpiId] || {}).label || kpiId);
// 3 propositions : KPI le plus en retard, record perso sur un KPI, relances.
function propositionsDefi(uid = ME.id, clubId = CLUB.id) {
  const lundi = weekStart(today()); const out = [];
  const R = kpisEnRetard(uid, clubId, lundi)[0];
  if (R) { const k = R.k; const sem = Math.max(k.unit === 'eur' ? EUR_MIN : 1, Math.ceil(R.q * Math.max(1, workdays(uid, clubId, lundi, addDays(lundi, 6))))); out.push({ type: 'retard', kpiId: k.id, target: sem, label: `${defiUnite(k.id, sem)} en ${k.label}`, pourquoi: 'votre indicateur le plus en retard' }); }
  let meilleur = null; for (const k of kpiList().filter(x => x.unit === 'qty' && !KPI_HORS_OBJECTIFS.includes(x.id))) { const best = Math.max(0, ...[1, 2, 3, 4, 5, 6, 7, 8].map(i => sumRange(clubId, uid, k.id, addDays(lundi, -7 * i), addDays(lundi, -7 * i + 6)))); if (best > 0 && (!meilleur || best > meilleur.best)) meilleur = { k, best }; }
  if (meilleur && !out.some(o => o.kpiId === meilleur.k.id)) out.push({ type: 'record', kpiId: meilleur.k.id, target: meilleur.best + 1, label: `${defiUnite(meilleur.k.id, meilleur.best + 1)} en ${meilleur.k.label}`, pourquoi: `record perso sur 8 semaines : ${meilleur.best}` });
  const rel = defiValeur(uid, clubId, DEFI_RELANCES, addDays(lundi, -7), addDays(lundi, -1)); const cible = Math.max(5, rel + 2);
  out.push({ type: 'relances', kpiId: DEFI_RELANCES, target: cible, label: `${plur(cible, 'relance notée', 'relances notées')}`, pourquoi: `${plur(rel, 'relance', 'relances')} la semaine dernière` });
  // Moins de 3 : la semaine dernière plus un, sur les indicateurs encore libres.
  for (const k of kpiList().filter(x => x.unit === 'qty' && !KPI_HORS_OBJECTIFS.includes(x.id))) {
    if (out.length >= 3) break; if (out.some(o => o.kpiId === k.id)) continue;
    const der = sumRange(clubId, uid, k.id, addDays(lundi, -7), addDays(lundi, -1)); const n = Math.max(1, der + 1);
    out.splice(out.length - 1, 0, { type: 'progres', kpiId: k.id, target: n, label: `${defiUnite(k.id, n)} en ${k.label}`, pourquoi: `${defiUnite(k.id, der)} la semaine dernière` });
  }
  // Toujours 3 : à défaut d'autre indicateur, une version ambitieuse de la première proposition.
  while (out.length < 3) { const b = out[0]; const n = b.target * 2; out.splice(out.length - 1, 0, { type: 'ambitieux', kpiId: b.kpiId, target: n, label: b.kpiId === DEFI_RELANCES ? plur(n, 'relance notée', 'relances notées') : `${defiUnite(b.kpiId, n)} en ${defiNom(b.kpiId)}`, pourquoi: 'version ambitieuse' }); }
  return out.slice(0, 3);
}
function defiDeLaSemaine(uid = ME.id, d = today()) { const g = uid === (ME && ME.id) ? prefsOf().goal : deepGet(S, ['prefs', uid, 'goal']); return g && g.week === semaineIso(d) && (g.kpiId === DEFI_RELANCES || S.kpis[g.kpiId]) ? g : null; }
function defiAvancement(uid, clubId, g, d = today()) { const lundi = dateDeSemaine(g.week); return defiValeur(uid, clubId, g.kpiId, lundi, d < addDays(lundi, 6) ? d : addDays(lundi, 6)); }
// Lundi d'une semaine ISO « AAAA-Wnn ».
function dateDeSemaine(w) { const [a, n] = w.split('-W').map(Number); const j4 = new Date(a, 0, 4); const lundi1 = new Date(a, 0, 4 - ((j4.getDay() + 6) % 7)); return isoOf(new Date(lundi1.getFullYear(), lundi1.getMonth(), lundi1.getDate() + (n - 1) * 7)); }
defiPersoCard = function () { // eslint-disable-line no-func-assign
  const g = defiDeLaSemaine();
  if (!g) {
    const P = propositionsDefi();
    return carte('col6', `Semaine du ${dm(weekStart(today()))}`, 'Ton défi de la semaine', `<div class="defi-props">${P.map((p, i) => `<button class="defi-prop" data-act="defiChoisir" data-k="${esc(p.kpiId)}" data-n="${p.target}" data-i="${i}"><b>${esc(p.label)}</b><small>${esc(p.pourquoi)}</small></button>`).join('')}</div>
      <div class="row wrap" style="gap:6px;margin-top:10px"><select class="input" id="dp-k" aria-label="Indicateur"><option value="${DEFI_RELANCES}">Relances notées</option>${kpiList().filter(k => !KPI_HORS_OBJECTIFS.includes(k.id)).map(k => `<option value="${k.id}">${esc(k.label)}</option>`).join('')}</select><input class="input" id="dp-n" type="number" min="1" max="10000" value="5" style="width:96px" aria-label="Cible"><button class="btn" data-act="defiChoisir" data-libre="1">Ma cible</button></div>
      <label class="row small" style="margin-top:8px"><input type="checkbox" id="dp-annonce" checked> Annoncer dans le fil quand je le tiens</label>`);
  }
  const fait = defiAvancement(ME.id, CLUB.id, g); const tenu = fait >= g.target;
  return carte('col6', `Semaine du ${dm(weekStart(today()))}`, 'Ton défi de la semaine', `<p style="margin:0 0 8px"><b>${esc(defiUnite(g.kpiId, fait))}</b> sur ${esc(defiUnite(g.kpiId, g.target))} · ${esc(defiNom(g.kpiId))}</p>${progressBar(Math.min(1, g.target ? fait / g.target : 0))}${tenu ? '<p class="small" style="margin:8px 0 0"><b>Défi tenu</b> : trophée personnel obtenu.</p>' : ''}`, tenu ? '' : '<button class="btn ghost sm" data-act="defiPersoRaz">Changer</button>');
};
ACTIONS.defiChoisir = el => {
  const kpiId = el.dataset.libre ? ($('#dp-k') || {}).value : el.dataset.k; const n = Math.round(Number(el.dataset.libre ? ($('#dp-n') || {}).value : el.dataset.n));
  if (!(kpiId === DEFI_RELANCES || S.kpis[kpiId]) || !(n > 0)) return;
  const w = semaineIso(); const annonce = !!($('#dp-annonce') || { checked: true }).checked;
  db.batch([[['prefs', ME.id, 'goal'], { week: w, kpiId, target: n }], [['prefs', ME.id, 'goalHist', w], { kpiId, target: n, annonce, at: Date.now() }]]);
  toast(`Défi de la semaine : ${defiUnite(kpiId, n)}`);
};
ACTIONS.defiPersoRaz = () => db.batch([[['prefs', ME.id, 'goal'], null], [['prefs', ME.id, 'goalHist', semaineIso()], null]]);
// Défis tenus (toutes les semaines enregistrées) : trophée personnel et, si accepté, événement du fil.
function defisTenus() {
  return memo('defisTenus', () => {
    const out = [];
    for (const [uid, p] of Object.entries(S.prefs || {})) {
      const u = S.users[uid]; if (!u || !p || !p.goalHist) continue; const cid = (u.clubs || [])[0];
      for (const [w, g] of Object.entries(p.goalHist)) {
        if (!g || !(g.kpiId === DEFI_RELANCES || S.kpis[g.kpiId])) continue; const lundi = dateDeSemaine(w); if (lundi > today()) continue;
        const fin = addDays(lundi, 6); const v = defiValeur(uid, cid, g.kpiId, lundi, fin < today() ? fin : today()); if (v < g.target) continue;
        out.push({ uid, cid, w, lundi, g, at: fin < today() ? dateOf(addDays(fin, 1)).getTime() + 8 * 3600e3 : Date.now() });
      }
    }
    return out;
  });
}
const tropheesDefi = () => defisTenus().map(x => ({ userId: x.uid, kind: 'perso', perso: true, icon: 'target', label: `Défi tenu, semaine du ${dm(x.lundi)}`, mk: x.lundi.slice(0, 7), week: x.lundi, at: x.at, clubId: x.cid }));
const defiEvenements = clubIds => defisTenus().filter(x => x.g.annonce && clubIds.includes(x.cid)).map(x => ({ id: `dt_${x.uid}_${x.w}`, type: 'trophy', at: x.at, userId: x.uid, clubId: x.cid, label: `${S.users[x.uid].first} a tenu son défi de la semaine : ${defiUnite(x.g.kpiId, x.g.target)}${x.g.kpiId === DEFI_RELANCES ? '' : ' en ' + defiNom(x.g.kpiId)}`, icon: 'target', link: '#/profile' }));
