// Geometrie de la banniere d'installation, a plusieurs largeurs reelles.
//
// LA SUITE INTEGREE MESURE A LA LARGEUR DE SA FENETRE, ET UNE SEULE. Or le
// point exact du prompt est « sur ecran etroit (360px) comme sur tablette » :
// c'est la ou le texte passe sur deux lignes et ou la barre d'onglets se
// reorganise. Ce script emule chaque largeur pour de vrai — Chrome
// recalcule la mise en page, les media queries s'appliquent, les hauteurs
// changent — puis verifie les deux memes choses a chaque fois :
//   1. la banniere ne descend pas sur la barre d'onglets ;
//   2. l'ecran actif rend la place des deux bandes.
//
// Usage : node scripts/verif/banniere-geometrie.mjs "http://127.0.0.1:8799/app/index.html"
const [, , url, port = '9223'] = process.argv;

const t = await (await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent(url),
  { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p = {}) => new Promise((res, rej) => {
  const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('timeout ' + m)); } }, 60000);
});
ws.onmessage = e => {
  const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); }
};
await new Promise(r => ws.onopen = r);
await cmd('Network.enable');
await cmd('Network.setCacheDisabled', { cacheDisabled: true });
await new Promise(r => setTimeout(r, 5000));

const ev = async x => {
  const r = await cmd('Runtime.evaluate',
    { expression: x, returnByValue: true, awaitPromise: true, timeout: 50000 });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
    ((r.exceptionDetails.exception || {}).description || ''));
  return r.result.value;
};

// Ardoise vide : un refus enregistre par une session precedente eteindrait
// la banniere et le script mesurerait un element invisible.
await ev(`(async()=>{ try{
  const rs=await navigator.serviceWorker.getRegistrations();
  for(const r of rs) await r.unregister();
  for(const c of await caches.keys()) await caches.delete(c);
}catch(e){} localStorage.clear(); sessionStorage.clear(); return 1; })()`);
await cmd('Page.enable');
await cmd('Page.reload', { ignoreCache: true });
await new Promise(r => setTimeout(r, 6000));

// LES LARGEURS QUI COMPTENT. 360 : le telephone Android le plus repandu, et
// la largeur sous laquelle le texte de la banniere passe sur deux lignes.
// 320 : le plus petit ecran encore en service (iPhone SE 1re generation).
// 420 et 768 : les deux seuils de media query de la barre d'onglets.
// 1024 : tablette en paysage.
const LARGEURS = [
  { l: 320, h: 568, nom: 'iPhone SE' },
  { l: 360, h: 800, nom: 'Android courant' },
  { l: 390, h: 844, nom: 'iPhone 14' },
  { l: 420, h: 900, nom: 'seuil .tab-btn' },
  { l: 768, h: 1024, nom: 'tablette portrait' },
  { l: 1024, h: 768, nom: 'tablette paysage' },
];

const MESURE = `(()=>{
  const b=document.getElementById('rc-ban-install');
  const bar=document.getElementById('client-tabbar');
  const act=document.querySelector('.screen.active');
  if(!b||!bar) return {err:'element absent'};
  const rb=b.getBoundingClientRect(), rt=bar.getBoundingClientRect();
  const pad=act?(parseFloat(getComputedStyle(act).paddingBottom)||0):-1;
  return {
    ban:{h:Math.round(rb.height),bas:Math.round(rb.bottom),
         gauche:Math.round(rb.left),droite:Math.round(rb.right),lignes:0},
    barre:{h:Math.round(rt.height),haut:Math.round(rt.top)},
    pad:Math.round(pad),
    vue:{l:innerWidth,h:innerHeight},
    // Le texte tient-il ? On compare sa hauteur rendue a celle d'une ligne.
    txt:(()=>{ const s=document.getElementById('rc-ban-txt');
      if(!s) return -1;
      const r=s.getBoundingClientRect();
      const lh=parseFloat(getComputedStyle(s).lineHeight)||16;
      return Math.round(r.height/lh*10)/10; })(),
    // Le bouton et la croix debordent-ils de la bande ?
    deborde:(()=>{ const o=document.getElementById('rc-ban-oui');
      const x=document.getElementById('rc-ban-non');
      if(!o||!x) return 'boutons absents';
      const ro=o.getBoundingClientRect(), rx=x.getBoundingClientRect();
      if(rx.right>rb.right+1) return 'la croix sort de la bande';
      if(ro.left<rb.left-1) return 'le bouton sort de la bande';
      if(rx.width<40||rx.height<40) return 'croix de '+Math.round(rx.width)+'x'+Math.round(rx.height)+' : sous 40px';
      return '';
    })()
  };
})()`;

let dur = 0;
console.log('largeur              banniere  barre   padding  texte   verdict');
for (const { l, h, nom } of LARGEURS) {
  await cmd('Emulation.setDeviceMetricsOverride',
    { width: l, height: h, deviceScaleFactor: 1, mobile: l < 768 });
  // On force les deux bandes a l'ecran : c'est le cas serre, l'accueil
  // athlete apres une seance enregistree.
  await ev(`(()=>{
    localStorage.removeItem('rc_install_refus');
    localStorage.removeItem('rc_install_vue');
    sessionStorage.removeItem('rc_inst_ecran');
    sessionStorage.removeItem('rc_ban_vue');
    document.getElementById('client-tabbar').classList.add('show');
    document.body.classList.add('with-tabbar');
    _majHauteurTabbar();
    rcBanniereInstallCacher();
    return rcBanniereInstallMontrer()?'ok':rcBanniereInstallRaison();
  })()`);
  await new Promise(r => setTimeout(r, 250));
  const m = await ev(MESURE);
  const pbs = [];
  if (m.err) pbs.push(m.err);
  else {
    // ON VERIFIE QUE L'EMULATION A PRIS, AVANT DE CROIRE LA MESURE. Un
    // setDeviceMetricsOverride qui n'aboutit pas rend un tableau parfaitement
    // lisible ou chaque ligne ment sur sa largeur — et le script conclut
    // « aucun recouvrement a aucune largeur » sans avoir teste une seule des
    // largeurs annoncees. Mesure : innerWidth valait 380 pour 360 demandes.
    if (m.vue.l !== l) pbs.push(`emulation non appliquee : innerWidth=${m.vue.l} pour ${l} demandes`);
    if (m.ban.bas > m.barre.haut + 1) pbs.push(`recouvre la barre de ${m.ban.bas - m.barre.haut}px`);
    if (m.ban.h < 50) pbs.push(`bande de ${m.ban.h}px, moins que les ~56 attendus`);
    if (m.pad >= 0 && m.pad < m.ban.h + m.barre.h - 2)
      pbs.push(`l'ecran ne rend que ${m.pad}px pour ${m.ban.h + m.barre.h}px de bandes`);
    if (m.ban.gauche < 0 || m.ban.droite > m.vue.l + 1) pbs.push('la bande deborde de la fenetre');
    if (m.deborde) pbs.push(m.deborde);
  }
  if (pbs.length) dur++;
  console.log(
    `${String(l).padStart(4)}px ${nom.padEnd(18)} ${String(m.ban ? m.ban.h : '?').padStart(3)}px  ` +
    `${String(m.barre ? m.barre.h : '?').padStart(3)}px  ${String(m.pad).padStart(4)}px  ` +
    `${String(m.txt).padStart(4)} ln  ${pbs.length ? '✗ ' + pbs.join(' ; ') : '✓'}`);
}
console.log(dur === 0 ? '\nAucun recouvrement, a aucune largeur.' : `\n${dur} largeur(s) en defaut.`);
await cmd('Emulation.clearDeviceMetricsOverride');
ws.close();
process.exit(dur === 0 ? 0 : 1);
