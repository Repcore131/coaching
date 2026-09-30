// ══ LA MARQUE D'UN COACH PRO (lot M1) : CONTRASTE ET VALIDATION ═══════════
//
// Les MÊMES fonctions que l'app (rc-core, lot M1) : une couleur n'habille
// l'app ou la vitrine que si elle reste lisible sur le fond sombre (#080808,
// contraste WCAG ≥ 3:1). Sinon, la plus proche qui passe (même teinte).
// cloudflare/test/pages.test.mjs vérifie que les deux copies répondent pareil.

// PURE. #RGB ou #RRGGBB (casse libre) → '#RRGGBB' en capitales, ou null.
export function hexMarque(v){
  const s=String(v==null?'':v).trim();
  let m=/^#?([0-9a-fA-F]{6})$/.exec(s);
  if(m) return '#'+m[1].toUpperCase();
  m=/^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(s);
  return m?('#'+m[1]+m[1]+m[2]+m[2]+m[3]+m[3]).toUpperCase():null;
}
function _mqRgb(h){ const n=parseInt(h.slice(1),16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function _mqHex(r,g,b){ return '#'+[r,g,b].map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('').toUpperCase(); }
// La luminance relative de WCAG 2.x.
export function luminanceRelative(hex){
  const h=hexMarque(hex); if(!h) return null;
  const c=_mqRgb(h).map(v=>{ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
// PURE. Le rapport de contraste WCAG entre deux couleurs (1 à 21).
export function contrasteCouleurs(a,b){
  const x=luminanceRelative(a), y=luminanceRelative(b);
  if(x==null||y==null) return null;
  return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);
}
function _mqHsl(h){
  const [r,g,b]=_mqRgb(h).map(v=>v/255);
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b), l=(mx+mn)/2;
  if(mx===mn) return [0,0,l];
  const d=mx-mn, s=l>0.5?d/(2-mx-mn):d/(mx+mn);
  let t=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;
  return [t/6,s,l];
}
function _mqDeHsl(hh,s,l){
  if(s===0) return _mqHex(l*255,l*255,l*255);
  const q=l<0.5?l*(1+s):l+s-l*s, p=2*l-q;
  const f=t=>{ if(t<0) t+=1; if(t>1) t-=1; return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p; };
  return _mqHex(f(hh+1/3)*255,f(hh)*255,f(hh-1/3)*255);
}
/**
 * PURE. Une couleur est-elle lisible sur le fond (sombre par défaut, #080808,
 * le --bg de l'app) avec un contraste d'au moins `min` (3:1 par défaut) ?
 * Rend {ok, couleur, ratio, proposee}. Refusée, `proposee` est la plus
 * proche qui passe : MÊME teinte, même saturation, la luminosité la plus
 * proche de l'originale qui atteint le seuil (éclaircie sur un fond sombre,
 * assombrie sur un fond clair).
 */
export function couleurAccessible(hex,fond,min){
  const c=hexMarque(hex), f=hexMarque(fond||'#080808')||'#080808', seuil=Number(min)||3;
  if(!c) return {ok:false,couleur:null,ratio:null,proposee:null,raison:'format'};
  const ratio=contrasteCouleurs(c,f);
  if(ratio>=seuil) return {ok:true,couleur:c,ratio,proposee:null};
  const [h,s,l]=_mqHsl(c);
  const sombre=luminanceRelative(f)<0.5;
  // Recherche par dichotomie du premier cran qui passe, entre la couleur et le blanc (ou le noir).
  let bas=sombre?l:0, haut=sombre?1:l;
  for(let i=0;i<30;i++){
    const m=(bas+haut)/2;
    const ok=contrasteCouleurs(_mqDeHsl(h,s,m),f)>=seuil;
    if(sombre){ if(ok) haut=m; else bas=m; } else { if(ok) bas=m; else haut=m; }
  }
  let p=_mqDeHsl(h,s,sombre?haut:bas);
  // L'arrondi à l'octet peut retomber d'un cheveu sous le seuil : un cran de plus.
  for(let k=0;k<20&&contrasteCouleurs(p,f)<seuil;k++){ const x=_mqHsl(p); p=_mqDeHsl(x[0],x[1],Math.max(0,Math.min(1,x[2]+(sombre?0.004:-0.004)))); }
  return {ok:false,couleur:c,ratio,proposee:p};
}

export const CREATEUR = 'guellec,coachingpro@gmail,com';
const LOGO_RE = /^https:\/\/res\.cloudinary\.com\/[^\s"'<>]{1,460}$/;
/**
 * PURE. La marque à appliquer, ou null : un coach Pro (ou le créateur), un
 * nom de 1 à 40 caractères, une couleur valide (rendue accessible), un logo
 * hébergé chez Cloudinary (sinon absent : les initiales le remplacent).
 */
export function marqueValide(m, plan, cleCoach) {
  if (!m || typeof m !== 'object') return null;
  if (plan !== undefined && plan !== 'pro' && cleCoach !== CREATEUR) return null;
  const nom = String(m.nom || '').replace(/\s+/g, ' ').trim();
  if (!nom || nom.length > 40) return null;
  const c = couleurAccessible(m.couleur);
  if (!c.couleur) return null;
  const logo = LOGO_RE.test(String(m.logoUrl || '')) ? String(m.logoUrl) : null;
  return { nom, couleur: c.ok ? c.couleur : c.proposee, logoUrl: logo };
}
/** PURE. « Kévin Guellec Coaching » → « KG ». */
export function initialesMarque(nom) {
  const mots = String(nom || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const s = mots.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return s || 'RC';
}
