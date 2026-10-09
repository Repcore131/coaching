/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — suivi produit (#/produit, createur seulement) ════════════
// Page interne, absente des menus : ou en est chaque fonction face au marche
// (Devant, Egalite, Derriere), prochaine action, date de derniere mise a jour.
// Donnees dans S.product, indexe par id (p01…p32), jamais de tableau. Les
// lignes de depart sont completees a chaque chargement (normalizeState) : les
// 32 existent des le premier lancement et une ligne n'est jamais perdue.

const PRODUCT_STATUS = {
  devant: { label: 'Devant', cls: 'ok' },
  egalite: { label: 'Égalité', cls: 'info' },
  derriere: { label: 'Derrière', cls: 'bad' },
};
const PRODUCT_FUNCS = ['Imports Resamania', 'Doublons d’import', 'Arrivée des exports', 'Demandes de résiliation en cours', 'Analyse des résiliations', 'Impayés', 'Rétention', 'Relances personnelles',
  'Objectifs par KPI', 'Paliers collectifs', 'Mission du jour', 'Clôture du jour', 'Vue manager', 'Classement', 'Sprints', 'Le Pouls du club', 'Chat', 'Carnet du mois', 'Zones', 'Planning de tâches',
  'Fiabilité des chiffres', 'Comparaison N et N-1', 'Valeur en euros', 'Retour sur abonnement', 'Prospects', 'Multi-clubs', 'Sécurité du compte', 'Application installable', 'Bilan hebdomadaire',
  'Langues', 'Confidentialité', 'Démo et prix public'];
const productDefault = i => ({ id: 'p' + pad(i + 1), order: i + 1, label: PRODUCT_FUNCS[i], status: 'egalite', next: '', updatedAt: null });

// Complete S.product : lignes manquantes ajoutees, champs manquants remis.
function productFill(st) {
  if (!st.product || typeof st.product !== 'object' || Array.isArray(st.product)) st.product = {};
  PRODUCT_FUNCS.forEach((_, i) => { const d = productDefault(i); st.product[d.id] = { ...d, ...(st.product[d.id] || {}) }; });
}
const productRows = () => Object.values(S.product || {}).sort((a, b) => (a.order || 0) - (b.order || 0));
function productCounts() {
  const n = { devant: 0, egalite: 0, derriere: 0 };
  productRows().forEach(r => { if (n[r.status] != null) n[r.status]++; });
  return n;
}

PAGES.produit = {
  title: 'Suivi produit',
  creator: true,
  render() {
    const rows = productRows(), n = productCounts();
    return `<div class="page-head"><div><h1>Suivi produit</h1><p>Page interne, réservée aux créateurs. Position de chaque fonction face aux outils du marché.</p></div></div>
      <div class="rc-grid prod-count">${Object.entries(PRODUCT_STATUS).map(([k, s]) => `<div class="rc-tile prod-${k}"><span>${esc(s.label)}</span><b data-count="${k}">${n[k]}</b><small>sur ${rows.length} fonctions</small></div>`).join('')}</div>
      <div class="card"><div class="table-wrap"><table class="t prod-t"><thead><tr><th>Fonction</th><th>Statut</th><th>Prochaine action</th><th>Mise à jour</th></tr></thead><tbody>
      ${rows.map(r => `<tr data-row="${esc(r.id)}">
        <td><input class="input sm" data-change="prodSet" data-id="${esc(r.id)}" data-field="label" data-focus="pl-${esc(r.id)}" maxlength="80" value="${esc(r.label)}" aria-label="Fonction"></td>
        <td><select class="input sm prod-st prod-${esc(r.status)}" data-change="prodSet" data-id="${esc(r.id)}" data-field="status" aria-label="Statut de ${esc(r.label)}">${Object.entries(PRODUCT_STATUS).map(([k, s]) => `<option value="${k}" ${r.status === k ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></td>
        <td><input class="input sm" data-change="prodSet" data-id="${esc(r.id)}" data-field="next" data-focus="pn-${esc(r.id)}" maxlength="200" value="${esc(r.next)}" placeholder="À définir" aria-label="Prochaine action pour ${esc(r.label)}"></td>
        <td class="nowrap muted">${r.updatedAt ? esc(dmy(isoOf(new Date(r.updatedAt)))) : 'Jamais'}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  },
};
// Une modification reecrit la ligne entiere (jamais un champ isole : la base garde des lignes completes).
ACTIONS.prodSet = el => {
  if (!isCreator()) return;
  const r = S.product && S.product[el.dataset.id]; const f = el.dataset.field; if (!r || !['label', 'status', 'next'].includes(f)) return;
  let v = String(el.value || '').trim();
  if (f === 'status' && !PRODUCT_STATUS[v]) return;
  if (f === 'label') { v = v.slice(0, 80); if (!v) { el.value = r.label; return; } }
  if (f === 'next') v = v.slice(0, 200);
  if (r[f] === v) return;
  db.set(['product', r.id], { ...r, [f]: v, updatedAt: Date.now(), updatedBy: ME.id });
};
