// ALLEGER UNE VIDEO, POUR DE VRAI, DANS UN NAVIGATEUR — ET COMPTER LES OCTETS.
//
// POURQUOI CE SCRIPT EXISTE. Les seize assertions de app/tests.js sur l'envoi
// video eprouvent la CASCADE en remplacant VideoDecoder, VideoEncoder et
// MediaRecorder par des faux : elles prouvent qu'un echec descend d'une voie et
// qu'aucun octet de video n'entre dans le document. Elles ne compressent RIEN,
// donc elles ne mesurent rien. Or le seul chiffre qui compte ici est un rapport
// d'octets, et l'audit en annonce un : « 720p a 2,5 Mbit/s, facteur 6 a 20 ».
//
// Ce banc fabrique une vraie video dans la page — 1080p, ~9 Mbit/s, un corps
// qui monte et descend sur un sol contraste, avec du grain, comme un telephone
// en salle — la passe a RepCoreVideo, et lit le resultat avec un <video>.
//
// CE QU'IL A TROUVE LE 23/09/2026, et qu'aucune assertion ne pouvait voir :
// l'annulation ne s'appliquait pas pendant le VIDAGE des codecs. Une annulation
// demandee a 400 ms sur un transcodage de 887 ms rendait quand meme un Blob, et
// l'appelant pouvait envoyer une video que la personne venait d'annuler.
//
// PREREQUIS, comme scripts/verif/suite.mjs (voir le README du dossier) :
//   1. un serveur statique sur le depot          python -m http.server 8799
//   2. un Chrome avec le port de debogage ouvert  chrome --remote-debugging-port=9223
// Usage :
//   node scripts/verif/video-allege.mjs "http://127.0.0.1:8799/app/index.html" 9223
const [,, url, port = '9223'] = process.argv;
if (!url) { console.error('usage : node scripts/verif/video-allege.mjs <url de app/index.html> [port CDP]'); process.exit(2); }

const t = await (await fetch(`http://127.0.0.1:${port}/json/new?` + encodeURIComponent(url),
  { method: 'PUT' })).json();
const ws = new WebSocket(t.webSocketDebuggerUrl);
let n = 0; const att = new Map();
const cmd = (m, p = {}) => new Promise((res, rej) => { const id = ++n; att.set(id, res);
  ws.send(JSON.stringify({ id, method: m, params: p }));
  setTimeout(() => { if (att.has(id)) { att.delete(id); rej(new Error('timeout ' + m)); } }, 180000); });
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } };
await new Promise(r => ws.onopen = r);
await cmd('Runtime.enable');
const ev = async x => {
  const r = await cmd('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true, timeout: 170000 });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' '
    + ((r.exceptionDetails.exception || {}).description || '').slice(0, 200));
  return r.result.value;
};
const pause = ms => new Promise(r => setTimeout(r, ms));
// LE MODULE EST CHARGE EN <script defer> : on l'attend au lieu de supposer.
let pret = false;
for (let i = 0; i < 80; i++) {
  pret = await ev(`typeof window.RepCoreVideo==='object'&&typeof RepCoreVideo.compresser==='function'`).catch(() => false);
  if (pret) break;
  await pause(500);
}
if (!pret) { console.error('RepCoreVideo n’est pas charge par cette page'); process.exit(1); }

// ── LE STUDIO, POSE DANS LA PAGE ───────────────────────────────────────────
// ⚠ PAS UN APLAT NI DU BRUIT PUR. Un fond uni tient en quelques kilo-octets et
//   ne prouverait rien ; du bruit aleatoire est INCOMPRESSIBLE et fait deborder
//   le debit cible — mesure : 6,2 Mbit/s pour 2,5 demandes. Ni l'un ni l'autre
//   ne ressemble a une serie filmee en salle. On dessine donc un mouvement lent
//   sur un sol contraste, avec un grain leger.
await ev(`window.__vb={
  filmer:async function(l,h,ms,debit){
    const c=document.createElement('canvas'); c.width=l; c.height=h;
    const x=c.getContext('2d');
    const flux=c.captureStream(30);
    const type=MediaRecorder.isTypeSupported('video/mp4;codecs=avc1.42001f')
      ?'video/mp4;codecs=avc1.42001f':'video/webm';
    const r=new MediaRecorder(flux,{mimeType:type,videoBitsPerSecond:debit});
    const bouts=[];
    r.ondataavailable=e=>{ if(e.data&&e.data.size) bouts.push(e.data); };
    let t=0;
    const dessiner=()=>{
      t++;
      const g=x.createLinearGradient(0,0,l,h);
      g.addColorStop(0,'#14181f'); g.addColorStop(1,'#2a3340');
      x.fillStyle=g; x.fillRect(0,0,l,h);
      const cy=h*0.55+Math.sin(t/12)*h*0.18;
      x.fillStyle='#c9d3e0';
      x.beginPath(); x.ellipse(l*0.5,cy-h*0.16,h*0.055,h*0.06,0,0,7); x.fill();
      x.fillRect(l*0.5-h*0.075,cy-h*0.1,h*0.15,h*0.22);
      x.fillRect(l*0.5-h*0.06,cy+h*0.12,h*0.05,h*0.2);
      x.fillRect(l*0.5+h*0.01,cy+h*0.12,h*0.05,h*0.2);
      x.fillStyle='#3d4655'; x.fillRect(0,h*0.86,l,h*0.14);
      for(let i=0;i<14;i++){ x.fillStyle=i%2?'#4a5364':'#39414f';
        x.fillRect(i*l/14,h*0.86,l/28,h*0.14); }
      const gr=x.createImageData(Math.min(l,160),Math.min(h,90));
      for(let i=0;i<gr.data.length;i+=4){ const v=(Math.random()*255)|0;
        gr.data[i]=gr.data[i+1]=gr.data[i+2]=v; gr.data[i+3]=26; }
      const tmp=document.createElement('canvas'); tmp.width=gr.width; tmp.height=gr.height;
      tmp.getContext('2d').putImageData(gr,0,0);
      x.drawImage(tmp,0,0,l,h);
    };
    const min=setInterval(dessiner,33);
    r.start(250);
    await new Promise(k=>setTimeout(k,ms));
    r.stop(); clearInterval(min);
    await new Promise(k=>{ r.onstop=k; });
    const b=new Blob(bouts,{type:type.split(';')[0]});
    return new File([b],'source.'+(type.indexOf('mp4')>=0?'mp4':'webm'),{type:b.type});
  },
  lire:function(blob){
    return new Promise(k=>{
      const v=document.createElement('video'); v.muted=true; v.preload='metadata';
      const u=URL.createObjectURL(blob);
      const fin=(o)=>{ URL.revokeObjectURL(u); k(o); };
      v.onloadedmetadata=()=>fin({l:v.videoWidth,h:v.videoHeight,d:Math.round(v.duration*100)/100});
      v.onerror=()=>fin({erreur:'illisible'});
      setTimeout(()=>fin({erreur:'delai'}),8000);
      v.src=u;
    });
  }}; true`);

// ⚠ LANCE PUIS SURVEILLE. Une promesse de plusieurs secondes rendue a
//   Runtime.evaluate revient en « [object Object] » ou en undefined, sans
//   erreur : on pose le resultat sur window, et on l'attend.
async function scene(nom, corps, secondes) {
  await ev(`window.__res_${nom}=null; (async()=>{ try{ ${corps} }
    catch(e){ window.__res_${nom}='ERREUR '+String(e&&e.message||e); } })(); true`);
  for (let i = 0; i < secondes; i++) {
    const v = await ev(`window.__res_${nom}`);
    if (v) { if (String(v).startsWith('ERREUR')) throw new Error(nom + ' : ' + v); return JSON.parse(v); }
    await pause(1000);
  }
  throw new Error(nom + ' n’a rien rendu en ' + secondes + ' s');
}

const K = o => Math.round(o / 1024) + ' Ko';
const Mb = (o, s) => (o * 8 / s / 1e6).toFixed(2) + ' Mbit/s';
const ko = [];

// ══ 1. LE CAS QUI PAIE : une video de telephone ════════════════════════════
const a = await scene('un', `
  window.__jauges=[];
  const src=await window.__vb.filmer(1920,1080,6000,9000000);
  const avant=await window.__vb.lire(src);
  const peut=await RepCoreVideo.peutCompresser(src);
  const t0=performance.now();
  const out=await RepCoreVideo.compresser(src,{hauteur:720,debit:2500000,
    onProgres:p=>{ window.__jauges.push(Math.round(p*100)); }});
  const apres=out.blob?await window.__vb.lire(out.blob):null;
  window.__res_un=JSON.stringify({peut:peut,src:{o:src.size,lu:avant},
    out:{o:out.blob?out.blob.size:null,type:out.blob?out.blob.type:'',voie:out.voie,
      h:out.hauteur,lu:apres,sansAudio:!!out.sansAudio},
    ms:Math.round(performance.now()-t0),jauges:window.__jauges.length,
    srcApres:src.size});`, 180);
console.log('1. UNE VIDEO COMME EN SORT D’UN TELEPHONE');
console.log('   sonde   : ' + JSON.stringify(a.peut));
console.log('   source  : ' + K(a.src.o) + '  ' + a.src.lu.l + 'x' + a.src.lu.h
  + '  ' + a.src.lu.d + ' s  ' + Mb(a.src.o, a.src.lu.d));
if (a.out.o === null) {
  ko.push('rien n’a ete allege sur une source de 1080p : ' + a.out.voie);
} else {
  console.log('   sortie  : ' + K(a.out.o) + '  ' + a.out.lu.l + 'x' + a.out.lu.h
    + '  ' + a.out.lu.d + ' s  ' + Mb(a.out.o, a.out.lu.d) + '   voie ' + a.out.voie);
  console.log('   gain    : ' + (a.src.o / a.out.o).toFixed(1) + '×  en ' + a.ms + ' ms ('
    + (a.src.lu.d * 1000 / a.ms).toFixed(1) + '× le temps reel), ' + a.jauges + ' pas de jauge');
  if (a.out.o >= a.src.o) ko.push('la sortie n’est pas plus legere');
  if (a.out.lu.erreur) ko.push('la video produite est ' + a.out.lu.erreur);
  if (a.out.lu.h > 720) ko.push('la sortie depasse 720 de haut : ' + a.out.lu.h);
  if (Math.abs((a.out.lu.d || 0) - (a.src.lu.d || 0)) > 1.2)
    ko.push('la duree a change : ' + a.src.lu.d + ' -> ' + a.out.lu.d);
  // LE DEBIT DOIT TENIR LA CIBLE, a la marge du controle de debit pres.
  const d = a.out.o * 8 / a.out.lu.d;
  if (d > 2500000 * 1.6) ko.push('debit de sortie ' + Mb(a.out.o, a.out.lu.d) + ' pour 2,50 demandes');
  if (a.jauges < 2) ko.push('la jauge n’a pas bouge pendant le travail');
}
if (a.srcApres !== a.src.o) ko.push('le fichier source a ete modifie');

// ══ 2. DEJA LEGERE : on n'agrandit pas, et on ne gonfle pas ════════════════
const b = await scene('deux', `
  const src=await window.__vb.filmer(640,360,3000,400000);
  const out=await RepCoreVideo.compresser(src,{hauteur:720,debit:2500000});
  const lu=out.blob?await window.__vb.lire(out.blob):null;
  window.__res_deux=JSON.stringify({src:src.size,out:out.blob?out.blob.size:null,
    voie:out.voie,raison:out.raison||'',lu:lu,avant:out.octetsAvant,apres:out.octetsApres});`, 120);
console.log('');
console.log('2. UNE VIDEO DEJA LEGERE (640x360)');
console.log('   ' + K(b.src) + ' -> ' + (b.out === null
  ? 'RIEN, l’original part tel quel (' + b.raison + ')'
  : K(b.out) + '  ' + b.lu.l + 'x' + b.lu.h) + '   voie ' + b.voie);
if (b.out === null) {
  // blob NUL EST UNE REPONSE, pas une panne : « rien a gagner ». Le contrat
  // veut alors que les octets annonces soient ceux de l'original.
  if (b.apres !== b.avant) ko.push('aucune compression mais des octets differents : ' + b.avant + ' -> ' + b.apres);
  if (!b.raison) ko.push('aucune compression et aucune raison donnee');
} else {
  if (b.lu.h > 400) ko.push('une video de 360 de haut ressort en ' + b.lu.h + ' : elle a ete agrandie');
  if (b.out >= b.src) ko.push('une video deja legere ressort plus lourde');
}

// ══ 3. ANNULATION : elle doit REJETER, pas rendre un Blob ══════════════════
const c = await scene('trois', `
  const src=await window.__vb.filmer(1280,720,4000,6000000);
  const ac=new AbortController();
  setTimeout(()=>ac.abort(),400);
  const t0=performance.now();
  let fin='rendue quand meme';
  try{ const out=await RepCoreVideo.compresser(src,{hauteur:720,debit:2500000,signal:ac.signal});
    fin='rendue quand meme ('+(out.blob?out.blob.size:0)+' o, voie '+out.voie+')'; }
  catch(e){ fin='rejetee : '+String(e&&e.message||e).slice(0,60); }
  const ms=Math.round(performance.now()-t0);
  const out2=await RepCoreVideo.compresser(src,{hauteur:720,debit:2500000});
  window.__res_trois=JSON.stringify({fin:fin,ms:ms,apres:out2.blob?out2.blob.size:0,voie:out2.voie});`, 120);
console.log('');
console.log('3. ANNULATION EN COURS DE ROUTE');
console.log('   ' + c.fin + '  apres ' + c.ms + ' ms ; puis une compression normale de '
  + K(c.apres) + ' (voie ' + c.voie + ')');
if (!/rejetee/.test(c.fin)) ko.push('une annulation ne rejette pas : ' + c.fin);
if (c.ms > 6000) ko.push('l’annulation a mis ' + c.ms + ' ms a prendre effet');
if (!(c.apres > 0)) ko.push('apres une annulation, le module ne sait plus compresser');

console.log('');
if (ko.length) { console.error('DEFAUTS :\n  ' + ko.join('\n  ')); process.exit(1); }
console.log('Une video de telephone est allegee pour de bon, la duree tient, rien n’est');
console.log('agrandi, rien ne gonfle, et une annulation s’arrete vraiment.');
process.exit(0);
