function _renderSuppTable(list, isCoach, editFn){
  _suppAssurerIds(list);
  // L encart sourcing survit a la liste vide : l athlete qui n a rien
  // enregistre est precisement celui qui n a rien achete.
  if(!list.length) return emptyState('pill','Aucun complément renseigné.',null,null,'padding:28px 0')
    +_htmlSuppSourcing(isCoach);
  const TRAME='repeating-linear-gradient(-55deg,transparent,transparent 14px,rgba(255,255,255,.012) 14px,rgba(255,255,255,.012) 15px)';
  // Virgule francaise, et pas de decimale inutile : « 2 » et non « 2,0 ».
  const nb=v=>(Math.round(v*100)/100).toString().replace('.',',');
  // Les moments d un complement suivent la JOURNEE, jamais l ordre de saisie :
  // « avant entrainement » doit preceder « soir » a la lecture.
  const momentsDe=s=>TIMINGS_LIST.filter(t=>(s.timings||[]).includes(t.id))
    .sort((a,b)=>_rangMoment(a.id)-_rangMoment(b.id));

  // Tout ce qu'une carte doit savoir, lu une seule fois. La couleur est celle
  // du PREMIER moment : elle situe le complement dans la journee sans qu'on
  // ait a lire quoi que ce soit.
  const lu=s=>{
    const mts=momentsDe(s);
    const q=_planNb(s.dosage_quantity);
    const prises=Math.max(1,mts.length);
    return {mts:mts, id:(mts[0]||{}).id,
      c:(SUPP_TIMING_META[(mts[0]||{}).id]||{color:'#6a6a6a'}).color,
      q:q, prises:prises, total:(q!=null&&mts.length)?q*prises:null,
      unite:s.dosage_unit||'', fiche:_suppFiche(s.name), eteint:s.active===false};
  };

  // ── LA TUILE D'ICONE ──────────────────────────────────────────────────
  // Le liseré de gauche disait déjà le moment, mais il fallait le savoir. Une
  // icône, elle, se reconnaît : le soleil du matin et la lune du coucher se
  // lisent sans légende, et la couleur n'a plus à porter seule l'information.
  const pave=(x,t)=>`<span aria-hidden="true" style="flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;width:${t}px;height:${t}px;border-radius:var(--r-3);background:${x.c}12;border:1px solid ${x.c}59;box-shadow:0 0 9px ${x.c}24,inset 0 0 9px ${x.c}12">${_suppTimingIcon(x.id,Math.round(t*0.52),x.c)}</span>`;

  // Le dépli « à savoir ». Il ne tient pas sur la ligne de tous les jours :
  // c'est une information d'achat, pas une information de prise.
  const depli=(s,x,pose)=>x.fiche?`<details onclick="event.stopPropagation()" style="flex-shrink:0;${pose||''}">
      <summary style="font-size:var(--fs-sm);color:var(--sub);cursor:pointer;list-style:none;padding:0 2px">▾</summary>
      <div style="font-size:var(--fs-xs);color:#ccc;line-height:1.6;margin-top:5px;white-space:normal">${escapeHtml(x.fiche.note)}</div>
      ${_htmlFormesFiche(x.fiche,s.forme)}
      ${s.forme?`<div style="font-size:var(--fs-xs);color:var(--sub);margin-top:4px;font-weight:700">Forme : ${escapeHtml(_libelleForme(x.fiche,s.forme))}</div>`:''}
      ${phraseDureeJugement(x.fiche)?`<div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:4px;line-height:1.5;white-space:normal">${escapeHtml(phraseDureeJugement(x.fiche))}</div>`:''}
      ${s.notes?`<div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:4px;font-style:italic;white-space:normal">${escapeHtml(s.notes)}</div>`:''}
      ${_suppEcartMoment(s)?`<div style="font-size:var(--fs-xs);color:var(--text-dim);margin-top:4px;line-height:1.5;white-space:normal">${escapeHtml(_suppEcartMoment(s))}</div>`:''}
    </details>`:'';

  // La quantité TOTALE de la journée, et l'unité au pluriel qui va avec.
  // « · 3× » dit que ce total se prend en trois fois — sans lui, six scoops
  // de whey se liraient comme une seule prise.
  const chiffre=(x,taille)=>`<div style="font-family:var(--pile-titre);font-size:${taille};line-height:1;color:${x.eteint?'var(--text-dim)':x.c};--halo-c:${x.c};text-shadow:var(--halo-2)66">${x.total!=null?nb(x.total):'—'}</div>
    <div style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.8px;text-transform:uppercase;margin-top:3px">${escapeHtml(/\(s\)/i.test(x.unite)?x.unite:planUnitePluriel(x.total,x.unite))}${x.prises>1?' · '+x.prises+'×':''}</div>`;

  const reference=x=>x.fiche?`<div style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.2px;margin-top:3px">réf. ${escapeHtml(x.fiche.dose)} ${escapeHtml(x.fiche.unite||'')}</div>`:'';

  // L'IDENTITÉ, ET NON LE RANG. `list.indexOf(s)` donnait la position dans la
  // liste REÇUE — filtrée sur les actifs côté athlète — pendant que
  // openSuppEdit relisait le store complet. Un inactif placé avant un actif
  // suffisait à ouvrir, puis écraser, la mauvaise entrée.
  const ouverture=s=>`onclick="${editFn}(${s.id})" role="button" tabindex="0" aria-label="${escapeHtml(s.name||'Complément')}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"`;

  // ── LA TUILE : un seul moment, rien d'autre à montrer ─────────────────
  // La pastille de preuve se pose en HAUT À DROITE et non à la suite du nom :
  // un nom qui passe à la ligne la promènerait au milieu de la carte.
  const tuile=s=>{
    const x=lu(s);
    return `<div ${ouverture(s)} style="position:relative;overflow:hidden;display:flex;gap:8px;
      padding:9px;cursor:pointer;border-radius:var(--r-3);
      background:linear-gradient(150deg,#161616,#101010 60%,#0d0d0d);
      border:1px solid #202020;box-shadow:var(--e2);opacity:${x.eteint?'.5':'1'}">
      <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:${TRAME}"></div>
      ${x.fiche?`<span style="position:absolute;top:8px;right:8px;z-index:1">${_suppPastille(x.fiche.preuve)}</span>`:''}
      ${depli(s,x,'position:absolute;bottom:5px;right:7px;z-index:1;max-width:78%')}
      ${pave(x,34)}
      <div style="position:relative;flex:1;min-width:0;${x.fiche?'padding-right:18px':''}">
        <div style="font-size:var(--fs-sm);font-weight:800;color:${x.eteint?'var(--text-dim)':'var(--text)'};letter-spacing:.2px;line-height:1.25;overflow-wrap:break-word">${escapeHtml(s.name||'')}</div>
        <div style="margin-top:7px">${chiffre(x,'var(--fs-xl)')}</div>
        ${reference(x)}
      </div>
    </div>`;
  };

  // ── LA BANDE : plusieurs moments, ou seul de son créneau ──────────────
  // Une pastille par moment, avec sa dose : « ☀ 6 g » puis « ☾ 6 g » dit d'un
  // coup d'œil que les douze grammes de créatine se prennent en deux fois.
  const bande=s=>{
    const x=lu(s);
    const chips=x.mts.map(t=>{
      const mc=(SUPP_TIMING_META[t.id]||{color:x.c}).color;
      return `<span title="${escapeHtml(t.label)}" style="display:inline-flex;align-items:center;gap:3px;padding:3px 7px;border-radius:var(--r-4);background:${mc}1f;border:1px solid ${mc}44;color:${mc};font-size:10.5px;font-weight:800;letter-spacing:.4px">${_suppTimingIcon(t.id,11,mc)}${x.q!=null?'<span>'+nb(x.q)+'</span>':''}</span>`;
    }).join('');
    return `<div ${ouverture(s)} style="grid-column:1/-1;position:relative;overflow:hidden;display:flex;align-items:center;gap:11px;
      padding:10px 12px;cursor:pointer;border-radius:var(--r-3);
      background:linear-gradient(150deg,#161616,#101010 60%,#0d0d0d);
      border:1px solid #202020;border-left:4px solid ${x.c};
      box-shadow:var(--e2);opacity:${x.eteint?'.5':'1'}">
      <div aria-hidden="true" style="position:absolute;inset:0;pointer-events:none;background:${TRAME}"></div>
      ${pave(x,42)}
      <div style="position:relative;flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap">
          <span style="font-size:var(--fs-sm);font-weight:800;color:${x.eteint?'var(--text-dim)':'var(--text)'};letter-spacing:.2px;line-height:1.25;overflow-wrap:break-word">${escapeHtml(s.name||'')}</span>
          ${x.fiche?_suppPastille(x.fiche.preuve):''}
          ${depli(s,x)}
        </div>
        <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:5px">
          ${x.mts.length>1?chips:''}
          ${x.fiche?`<span style="font-size:var(--fs-2xs);color:var(--text-faint);letter-spacing:.2px">réf. ${escapeHtml(x.fiche.dose)} ${escapeHtml(x.fiche.unite||'')}</span>`:''}
        </div>
      </div>
      <div style="position:relative;flex-shrink:0;text-align:right">${chiffre(x,'var(--fs-2xl)')}</div>
    </div>`;
  };

  // Une bannière par créneau, posée sur le PREMIER moment de chaque produit.
  // Elle rythme la journée sans ramener la répétition : la whey figure sous
  // « Matin » une seule fois, et ses prises de l'après-midi et du soir se
  // lisent sur ses pastilles.
  const banniere=(id,lib)=>{
    const mc=(SUPP_TIMING_META[id]||{color:'#6a6a6a'}).color;
    return `<div style="display:flex;align-items:center;gap:8px;margin:15px 0 8px">
      <span style="display:inline-flex;filter:drop-shadow(0 0 6px ${mc}cc)">${_suppTimingIcon(id,13,mc)}</span>
      <span style="font-family:var(--pile-titre);font-size:var(--fs-md);letter-spacing:2.5px;color:${mc};--halo-c:${mc};text-shadow:var(--halo-2)55">${escapeHtml(String(lib||'').toUpperCase())}</span>
      <span style="flex:1;height:1px;background:linear-gradient(90deg,${mc}55,transparent)"></span>
    </div>`;
  };

  // Ordre de lecture : par premier moment de la journée, puis alphabétique.
  const rang=s=>{const m=momentsDe(s)[0]; return m?_rangMoment(m.id):999;};
  const ordonne=list.slice().sort((a,b)=>rang(a)-rang(b)
    ||String(a.name||'').localeCompare(String(b.name||''),'fr'));
  const sections=[];
  ordonne.forEach(s=>{
    const m=momentsDe(s)[0], id=m?m.id:'_none';
    const der=sections[sections.length-1];
    if(!der||der.id!==id) sections.push({id:id,lib:m?m.label:'Moment non défini',items:[s]});
    else der.items.push(s);
  });

  // LES TUILES D'ABORD, LES BANDES ENSUITE, chacune dans son ordre. Une bande
  // au milieu de la grille laisserait un trou à sa droite ; `dense` le
  // boucherait en remontant une tuile, donc en cassant l'ordre de tabulation.
  // Regrouper coûte un écart à l'alphabet dans un créneau, et rien d'autre.
  const grille=(items,seul)=>{
    const bandes=items.filter(s=>seul||momentsDe(s).length>1);
    const tuiles=items.filter(s=>bandes.indexOf(s)<0);
    return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
      ${tuiles.map(tuile).join('')}${bandes.map(bande).join('')}</div>`;
  };

  return _htmlSuppInteractions(list)
    +sections.map(sec=>banniere(sec.id,sec.lib)
      +grille(sec.items,sec.items.length===1)).join('')
    +_htmlSuppLegende(isCoach)+_htmlSuppSourcing(isCoach);
}
