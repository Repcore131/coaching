/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — Réglages > Apparence (marque blanche) ═══════════════════════
// Deux niveaux : le réseau (S.org.theme, créateur) et le club (S.clubs[id].theme, créateur
// ou manager du club). Nom affiché (40 caractères), accent (sélecteur et code hexadécimal,
// aperçu en clair et en sombre), logo SVG ou PNG de 200 Ko au plus, affiché à 28 px de haut.
// Un SVG qui contient du script ou un attribut d'événement est refusé.

const THEME_LOGO_MAX = 200 * 1024;
const SVG_DANGER = /<script|<foreignObject|\son[a-z]+\s*=|javascript:|<iframe|<embed|<object|xlink:href\s*=\s*["']?(?!#)|href\s*=\s*["']?(?!#)[a-z]+:/i;
// Contrôle d'un SVG : texte, balise <svg>, aucune construction active. Renvoie un message d'erreur ou ''.
function svgRefus(txt) {
  if (!/<svg[\s>]/i.test(txt)) return 'Ce fichier n’est pas un SVG.';
  if (SVG_DANGER.test(txt)) return 'SVG refusé : il contient du script ou un attribut d’événement (on…). Exportez le logo sans script ni interaction.';
  return '';
}
const portee = () => (UI.apparencePortee === 'org' && isCreator() ? 'org' : 'club');
const themeChemin = () => portee() === 'org' ? ['org', 'theme'] : ['clubs', CLUB.id, 'theme'];
const themeEdite = () => deepGet(S, themeChemin()) || {};
const peutApparence = () => isCreator() || isManager();
function apercuTheme(accent, sombre) {
  const v = accentVars(accent, sombre) || accentVars('#2B4BDB', sombre);
  const fond = sombre ? '--bg:#0F1115;--surface:#171A20;--line:#262A33;--text:#ECEDEF;--muted:#9AA0AB' : '--bg:#F6F6F4;--surface:#FFFFFF;--line:#E4E5E8;--text:#15171C;--muted:#5E6470';
  const style = `${fond};${Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';')}`;
  return `<div class="apercu-theme" data-sombre="${sombre ? 1 : 0}" style="${style}"><span class="muted small">${sombre ? 'Thème sombre' : 'Thème clair'}</span>
    <button type="button" class="btn primary sm" tabindex="-1">Bouton principal</button><a class="apercu-lien" tabindex="-1">Lien du club</a>
    <span class="apercu-barres" aria-hidden="true"><i style="height:40%"></i><i style="height:70%"></i><i style="height:55%"></i><i style="height:90%"></i></span></div>`;
}
function apparenceCard() {
  if (!peutApparence()) return '';
  const T = themeEdite(); const org = portee() === 'org';
  const accent = COULEUR_OK(T.accent) ? T.accent.toUpperCase() : null; const shown = accent || accentDe(CLUB) || '#2B4BDB';
  const proche = procheStatut(accent);
  const nom = org ? (deepGet(S, ['org', 'name']) || tenant().name || '') : (T.displayName || (S.clubs[CLUB.id] || {}).name || '');
  const logo = LOGO_OK(T.logo) ? T.logo : null;
  return `<div class="card" id="apparence"><div class="card-head"><h3>Apparence</h3><span class="spacer"></span>
      ${isCreator() ? `<div class="seg" role="tablist"><button class="${org ? '' : 'on'}" data-act="ui" data-key="apparencePortee" data-val="club">Ce club</button><button class="${org ? 'on' : ''}" data-act="ui" data-key="apparencePortee" data-val="org">Le réseau</button></div>` : ''}</div>
    <p class="muted small" style="margin-top:-4px">${org ? 'Valeurs du réseau : reprises par chaque club qui n’a pas les siennes.' : 'Valeurs de ce club ; à défaut, celles du réseau, puis le thème Fit Pulse.'} L’accent colore le bouton principal, l’onglet actif, l’anneau de focus et la série du club dans les graphiques. Les statuts gardent leurs couleurs.</p>
    <div class="form-grid">
      <label class="field"><span>Nom affiché</span><input class="input" maxlength="40" data-change="apparenceSet" data-k="displayName" value="${esc(nom)}" placeholder="${esc((S.clubs[CLUB.id] || {}).name || 'Nom du club')}"><small class="muted">40 caractères au plus.</small></label>
      <div class="field"><span>Couleur d’accent</span><div class="row" style="gap:8px"><input class="input couleur-pick" type="color" data-input="apparenceApercu" data-change="apparenceSet" data-k="accent" value="${esc(shown)}" aria-label="Choisir la couleur"><input class="input sm num" style="width:110px" maxlength="7" data-input="apparenceApercu" data-change="apparenceSet" data-k="accent" value="${esc(accent || '')}" placeholder="${esc(shown)}" aria-label="Code hexadécimal"></div>
        <small class="warn apparence-alerte" ${proche ? '' : 'hidden'}>Couleur proche d’un statut : choisissez une autre teinte ou acceptez un accent assombri</small></div>
      <div class="field"><span>Logo</span><div class="row" style="gap:10px">${logo ? `<img class="logo-28" src="${esc(logo)}" alt="Logo">` : '<span class="muted small">aucun</span>'}<label class="btn sm">${ico('upload')} SVG ou PNG<input type="file" accept=".svg,image/svg+xml,.png,image/png" hidden data-change="apparenceLogo"></label>${logo ? '<button class="btn ghost sm" data-act="apparenceLogoRetirer">Retirer</button>' : ''}</div><small class="muted">200 Ko au plus, affiché à 28 px de haut.</small></div>
    </div>
    <div class="apercus">${apercuTheme(shown, false)}${apercuTheme(shown, true)}</div>
    <button class="btn sm" style="margin-top:12px" data-act="apparenceReset">Revenir au thème Fit Pulse</button></div>`;
}
// Aperçu en direct pendant le choix, sans enregistrer.
ACTIONS.apparenceApercu = el => {
  const v = String(el.value || '').trim(); if (!COULEUR_OK(v)) return;
  $$('#apparence .apercu-theme').forEach(p => { const x = accentVars(v, p.dataset.sombre === '1'); for (const k in x) p.style.setProperty(k, x[k]); });
  const a = $('#apparence .apparence-alerte'); if (a) a.hidden = !procheStatut(v);
  $$('#apparence [data-k="accent"]').forEach(i => { if (i !== el) i.value = i.type === 'color' ? v : v.toUpperCase(); });
};
ACTIONS.apparenceSet = el => {
  if (!peutApparence()) return; const k = el.dataset.k; let v = String(el.value || '').trim();
  if (k === 'accent') { if (v && !COULEUR_OK(v)) { toast('Couleur : un code de 6 chiffres hexadécimaux, par exemple #2B4BDB.'); return; } v = v ? v.toUpperCase() : null; }
  if (k === 'displayName') { v = v.slice(0, 40) || null; if (portee() === 'org') { db.set(['org', 'name'], v); toast('Nom du réseau enregistré'); return; } }
  db.set([...themeChemin(), k], v); toast(k === 'accent' ? `Accent enregistré : ${v || 'thème Fit Pulse'}` : 'Nom affiché enregistré');
};
// Lecture d'un fichier de logo : SVG contrôlé puis encodé, PNG de 200 Ko au plus (sinon réduit).
async function lireLogoTheme(f) {
  if (/svg/.test(f.type) || /\.svg$/i.test(f.name)) {
    if (f.size > THEME_LOGO_MAX) throw new Error(`fichier de ${Math.ceil(f.size / 1024)} Ko, 200 Ko au plus`);
    const txt = await f.text(); const r = svgRefus(txt); if (r) throw new Error(r);
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(txt)));
  }
  if (!/png/.test(f.type) && !/\.png$/i.test(f.name)) throw new Error('format accepté : SVG ou PNG');
  if (f.size <= THEME_LOGO_MAX) return await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ko(new Error('lecture impossible')); r.readAsDataURL(f); });
  return await reduireLogo(f);
}
ACTIONS.apparenceLogo = async el => {
  const f = el.files && el.files[0]; el.value = ''; if (!f || !peutApparence()) return;
  try { const d = await lireLogoTheme(f); db.set([...themeChemin(), 'logo'], d); toast(`Logo enregistré : ${Math.ceil(d.length / 1024)} Ko`); }
  catch (e) { toast(/^SVG refusé|^Ce fichier/.test(e.message) ? e.message : 'Logo refusé : ' + e.message, 6000); }
};
ACTIONS.apparenceLogoRetirer = () => { if (peutApparence()) db.set([...themeChemin(), 'logo'], null); };
ACTIONS.apparenceReset = async () => {
  if (!peutApparence() || !(await confirmDlg(portee() === 'org' ? 'Retirer l’accent, le logo et le nom du réseau ?' : 'Retirer l’accent, le logo et le nom affiché de ce club ?', { ok: 'Revenir au thème Fit Pulse' }))) return;
  db.set(themeChemin(), null); toast('Thème Fit Pulse rétabli : 0 personnalisation');
};
