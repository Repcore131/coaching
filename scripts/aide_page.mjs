#!/usr/bin/env node
// LA PAGE PUBLIQUE /aide (série 6, lot 16, 08/10/2026).
//
// Fabriquée depuis app/data/aide.json — la même liste que la feuille « ? Aide »
// de l'app : deux textes ne divergent pas. JSON-LD FAQPage pour les moteurs,
// et un formulaire qui écrit au support sans compte (POST /support du Worker).
//   node scripts/aide_page.mjs             (écrit aide/index.html)
//   node scripts/aide_page.mjs --verifier  (rouge si la page n'est pas à jour)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';

const E = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function pageAide(liste) {
  const l = Array.isArray(liste) ? liste : [];
  const ld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: l.map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.r } })) };
  const bloc = (titre, role) => {
    const q = l.filter((x) => (x.pour || []).includes(role));
    const themes = [...new Set(q.map((x) => x.theme))];
    return '<h2>' + titre + '</h2>' + themes.map((t) => '<h3>' + E(t) + '</h3>' + q.filter((x) => x.theme === t).map((x) => '<details><summary>' + E(x.q) + '</summary><p>' + E(x.r) + '</p></details>').join('\n')).join('\n');
  };
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<script>if(location.hostname==='repcore131.github.io')location.replace('https://repcore-sync.web.app'+location.pathname.replace(/^\\/coaching/,'')+location.search+location.hash);</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aide RepCore : questions fréquentes</title>
<meta name="description" content="Les réponses aux questions des athlètes et des coachs sur RepCore : séances, bilans, nutrition, programmes, abonnement.">
<link rel="canonical" href="https://repcore-sync.web.app/aide/">
<link rel="icon" type="image/png" href="/app/icons/icon-192x192.png">
<link rel="stylesheet" href="/charte.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<style>
  main{max-width:640px;margin:0 auto;padding:28px 16px 64px}
  details{border-bottom:1px solid var(--bord,#242424);padding:10px 0}
  summary{cursor:pointer;font-weight:700}
  h3{margin:22px 0 4px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--sub,#9a9a9a)}
  form{display:flex;flex-direction:column;gap:8px;margin-top:12px}
  form textarea,form input{width:100%;box-sizing:border-box;font:inherit;padding:10px;background:#111;color:inherit;border:1px solid #242424;border-radius:8px}
  .piege{position:absolute;left:-9999px}
  .msg{min-height:1.4em}
</style>
</head>
<body>
<main>
<h1>Aide RepCore</h1>
<p class="sub">Les réponses aux questions qu’on nous pose le plus. Dans l’application, le bouton « ? Aide » ouvre la même liste.</p>
${bloc('Athlètes', 'client')}
${bloc('Coachs', 'coach')}
<h2>Une autre question ?</h2>
<p class="sub">Écris-nous : la réponse viendra par le moyen que tu laisses. Ton entraînement ou ta diète : ton coach est le mieux placé.</p>
<form id="sup" novalidate>
  <textarea name="texte" rows="5" maxlength="2000" placeholder="Ce que tu cherches à faire, ce qui bloque." aria-label="Ton message"></textarea>
  <input name="contact" maxlength="120" autocomplete="email" placeholder="Ton e-mail ou ton téléphone" aria-label="Ton e-mail ou ton téléphone">
  <input name="site" class="piege" tabindex="-1" autocomplete="off" aria-hidden="true">
  <button type="submit" class="cta">Envoyer</button>
  <p class="msg" aria-live="polite"></p>
</form>
</main>
<script>
(function(){var f=document.getElementById('sup'),m=f.querySelector('.msg');
var MSG={texte:'Écris quelques mots.',contact:'Laisse un e-mail ou un téléphone valable.',plafond:'Beaucoup de messages aujourd’hui : réessaie demain.',robot:'Envoi refusé.'};
f.addEventListener('submit',function(e){e.preventDefault();m.textContent='Envoi…';
var d={texte:f.texte.value,contact:f.contact.value,site:f.site.value,diag:{page:'aide',appareil:String(navigator.userAgent||'').slice(0,120)}};
fetch('https://repcore-serveur.repcore.workers.dev/support',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify(d)})
.then(function(r){return r.json().catch(function(){return {};});}).then(function(j){
if(j&&j.ok){f.reset();m.textContent='Merci : ton message est parti.';}else{m.textContent=MSG[(j&&j.raison)]||'Envoi impossible : réessaie.';}})
.catch(function(){m.textContent='Envoi impossible : vérifie ta connexion.';});});})();
</script>
</body>
</html>
`;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const liste = JSON.parse(readFileSync(new URL('../app/data/aide.json', import.meta.url), 'utf8'));
  const html = pageAide(liste);
  const f = new URL('../aide/index.html', import.meta.url);
  if (process.argv.includes('--verifier')) {
    const ok = existsSync(f) && readFileSync(f, 'utf8') === html;
    console.log(ok ? 'aide/index.html à jour' : 'aide/index.html PAS à jour : node scripts/aide_page.mjs');
    process.exit(ok ? 0 : 1);
  }
  mkdirSync(new URL('../aide/', import.meta.url), { recursive: true });
  writeFileSync(f, html);
  console.log('aide/index.html écrit (' + liste.length + ' questions)');
}
