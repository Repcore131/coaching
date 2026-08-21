function _htmlSuppSourcing(isCoach){
  // L'écusson n'est pas un ornement : c'est le seul endroit du produit où
  // l'antidopage apparaît, et un titre nu se saute à la lecture.
  const ecu='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 9.5"/></svg>';
  return `<div style="border-top:1px solid var(--border);margin-top:11px;padding-top:11px">
    <div style="display:flex;align-items:center;gap:6px;font-size:var(--fs-xs);font-weight:800;letter-spacing:2px;color:var(--sub);text-transform:uppercase;margin-bottom:6px">${ecu}<span>Qualité et sourcing</span></div>
    <div style="font-size:var(--fs-xs);color:var(--text-dim);line-height:1.6">${escapeHtml(isCoach?SUPP_SOURCING_COACH:SUPP_SOURCING)}</div>
  </div>`;
}
