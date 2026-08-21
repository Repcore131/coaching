function _htmlSuppLegende(isCoach){
  // EN COLONNES, PAS EMPILÉE. Les trois niveaux se comparent : les lire l'un
  // sous l'autre oblige à faire l'aller-retour, côte à côte ils se répondent.
  // `auto-fit` les remet en pile quand la largeur ne suit plus.
  return `<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:11px">
    <div style="font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:9px">Niveau de preuve</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(164px,1fr));gap:9px 14px">
      ${SUPP_LEGENDE_PREUVE.map(([k,t])=>`<div style="display:flex;align-items:flex-start;gap:8px">
        ${_suppPastille(k)}<span style="font-size:var(--fs-xs);color:#ccc;line-height:1.5">${escapeHtml(t)}</span></div>`).join('')}
    </div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6;margin-top:10px">${escapeHtml(isCoach?SUPP_LEGENDE_PIED_COACH:SUPP_LEGENDE_PIED)}</div>
  </div>`;
}
