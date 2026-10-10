// ══ L'ASSISTANT DE LA PAGE D'ACCUEIL — LE PANNEAU (11/10/2026) ═════════════
//
// Chargé À LA DEMANDE : index.html n'injecte ce fichier qu'au premier clic sur
// la bulle (#rc-assistant-b), affichée seulement si le serveur dit l'assistant
// ouvert (GET /chat/etat). Les réponses viennent de POST /chat (cloudflare/src/
// chat.js), qui ne répond qu'à partir des pages de RepCore.
//
// ACCESSIBLE AU CLAVIER : la bulle est un <button> (aria-expanded,
// aria-controls) ; le panneau est un dialogue non modal ; à l'ouverture le
// focus va au champ, Échap ferme et rend le focus à la bulle ; les réponses
// arrivent dans une zone role="log" (aria-live="polite"). Le champ a un
// libellé. Tout texte venu du serveur est posé en textContent.
//
// L'HISTORIQUE (six messages au plus) reste dans sessionStorage : il part avec
// l'onglet, et n'est envoyé qu'au serveur, pour le contexte de la question.
(function () {
  'use strict';
  var URL_CHAT = 'https://repcore-serveur.repcore.workers.dev/chat';
  var CLE = 'rc_assistant_h';
  var bulle = document.getElementById('rc-assistant-b');
  if (!bulle || document.getElementById('rc-assistant')) return;

  var css = document.createElement('style');
  css.textContent = [
    '#rc-assistant{position:fixed;right:16px;bottom:88px;z-index:60;width:min(360px,calc(100vw - 32px));max-height:min(560px,calc(100vh - 120px));display:flex;flex-direction:column;background:#111;border:1px solid #2a2a2a;border-radius:16px;box-shadow:0 18px 50px rgba(0,0,0,.6);color:#efefef;font:14px/1.5 var(--pile-sans,system-ui,sans-serif)}',
    '#rc-assistant[hidden]{display:none}',
    '#rc-assistant .ra-tete{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 12px 10px 16px;border-bottom:1px solid #1e1e1e}',
    '#rc-assistant .ra-tete h2{font:700 15px/1.2 var(--pile-sans,system-ui,sans-serif);margin:0;letter-spacing:0;text-transform:none}',
    '#rc-assistant .ra-x{width:44px;height:44px;border:0;background:none;color:#aaa;font-size:22px;cursor:pointer;border-radius:10px}',
    '#rc-assistant .ra-log{flex:1;overflow:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;min-height:120px}',
    '#rc-assistant .ra-m{max-width:88%;padding:9px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}',
    '#rc-assistant .ra-u{align-self:flex-end;background:#E02020;color:#fff}',
    '#rc-assistant .ra-a{align-self:flex-start;background:#1b1b1b;border:1px solid #262626}',
    '#rc-assistant .ra-act{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}',
    '#rc-assistant .ra-act a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid #3a3a3a;border-radius:999px;color:#fff;text-decoration:none;font-size:13px}',
    '#rc-assistant .ra-act a:first-child{border-color:#E02020}',
    '#rc-assistant form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #1e1e1e}',
    '#rc-assistant input{flex:1;min-width:0;min-height:44px;padding:0 12px;border-radius:10px;border:1px solid #2a2a2a;background:#0b0b0b;color:#fff;font-size:16px}',
    '#rc-assistant button[type=submit]{min-height:44px;padding:0 14px;border:0;border-radius:10px;background:#E02020;color:#fff;font-weight:700;cursor:pointer}',
    '#rc-assistant button:disabled{opacity:.5;cursor:default}',
    '#rc-assistant .ra-note{font-size:11.5px;color:#8a8a8a;padding:0 16px 12px;margin:0}',
    '#rc-assistant .ra-note a{color:#bdbdbd}',
    '#rc-assistant .ra-vh{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
    '#rc-assistant :focus-visible,#rc-assistant-b:focus-visible{outline:2px solid #fff;outline-offset:2px}',
    '@media(min-width:641px){#rc-assistant{bottom:92px;right:24px}}',
  ].join('\n');
  document.head.appendChild(css);

  var z = document.createElement('div');
  z.id = 'rc-assistant';
  z.setAttribute('role', 'dialog');
  z.setAttribute('aria-modal', 'false');
  z.setAttribute('aria-labelledby', 'ra-titre');
  z.hidden = true;
  z.innerHTML = '<div class="ra-tete"><h2 id="ra-titre">Une question sur RepCore&nbsp;?</h2>'
    + '<button type="button" class="ra-x" aria-label="Fermer l’assistant">×</button></div>'
    + '<div class="ra-log" role="log" aria-live="polite" aria-relevant="additions"></div>'
    + '<form><label class="ra-vh" for="ra-q">Ta question</label>'
    + '<input id="ra-q" name="q" maxlength="500" autocomplete="off" placeholder="Prix, essai, coaching…" required>'
    + '<button type="submit">Envoyer</button></form>'
    + '<p class="ra-note">Réponses automatiques, tirées des pages de RepCore. Pas de conseil médical. Tes questions sont gardées sans ton adresse IP (<a href="privacy.html#assistant">confidentialité</a>).</p>';
  document.body.appendChild(z);

  var log = z.querySelector('.ra-log'), form = z.querySelector('form'), champ = z.querySelector('#ra-q'),
    envoyer = z.querySelector('button[type=submit]'), fermer = z.querySelector('.ra-x');

  function lireH() { try { var h = JSON.parse(sessionStorage.getItem(CLE) || '[]'); return Array.isArray(h) ? h.slice(-6) : []; } catch (e) { return []; } }
  function ecrireH(h) { try { sessionStorage.setItem(CLE, JSON.stringify(h.slice(-6))); } catch (e) {} }
  function message(qui, texte, actions) {
    var d = document.createElement('div');
    d.className = 'ra-m ' + (qui === 'u' ? 'ra-u' : 'ra-a');
    d.textContent = texte;
    if (actions && actions.length) {
      var a = document.createElement('div');
      a.className = 'ra-act';
      actions.forEach(function (x) {
        if (!x || !/^(https:\/\/|mailto:)/.test(String(x.href || ''))) return;
        var l = document.createElement('a');
        l.href = x.href; l.textContent = String(x.lib || '');
        if (/^https:/.test(x.href)) { l.target = '_blank'; l.rel = 'noopener'; }
        a.appendChild(l);
      });
      d.appendChild(a);
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  }
  // L'historique de l'onglet, remis à l'écran.
  var h0 = lireH();
  if (!h0.length) message('a', 'Bonjour ! Pose ta question sur l’application, les prix, l’essai gratuit ou le coaching de Kevin.');
  h0.forEach(function (m) { message(m.r, m.t); });

  function ouvrir() {
    z.hidden = false;
    bulle.setAttribute('aria-expanded', 'true');
    setTimeout(function () { champ.focus(); }, 0);
  }
  function fermerPanneau() {
    z.hidden = true;
    bulle.setAttribute('aria-expanded', 'false');
    bulle.focus();
  }
  window.rcAssistantBasculer = function () { if (z.hidden) ouvrir(); else fermerPanneau(); };
  fermer.addEventListener('click', fermerPanneau);
  z.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); fermerPanneau(); } });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = String(champ.value || '').trim();
    if (!q || envoyer.disabled) return;
    var h = lireH();
    message('u', q);
    champ.value = '';
    envoyer.disabled = true;
    var attente = document.createElement('div');
    attente.className = 'ra-m ra-a'; attente.textContent = '…'; attente.setAttribute('aria-hidden', 'true');
    log.appendChild(attente);
    fetch(URL_CHAT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ q: q, h: h }) })
      .then(function (r) { return r.json().catch(function () { return null; }); })
      .then(function (d) {
        attente.remove();
        var texte = d && d.texte ? String(d.texte) : 'Je ne peux pas répondre pour l’instant. Les réponses aux questions fréquentes sont dans la FAQ.';
        message('a', texte, d && d.actions);
        if (d && d.cat === 'ok') { h.push({ r: 'u', t: q }, { r: 'a', t: texte }); ecrireH(h); }
      })
      .catch(function () {
        attente.remove();
        message('a', 'Le réseau ne répond pas. Les réponses aux questions fréquentes sont dans la FAQ.', [{ lib: 'Voir la FAQ', href: 'https://repcore-sync.web.app/#faq' }]);
      })
      .then(function () { envoyer.disabled = false; champ.focus(); });
  });
  ouvrir();
})();
