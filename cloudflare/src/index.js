// ══ LE SERVEUR LÉGER DE REPCORE (Cloudflare Worker, plan gratuit) ═════════
//
// Ce que le plan Spark de Firebase ne fait pas, sans rien payer :
//   · les notifications quand l'app est fermée (Web Push) ;
//   · les travaux à heure fixe (série en danger, bilan, Wrapped, défis, rareté
//     des badges, résumé des ambassadeurs) ;
//   · le jugement des parrainages et des codes ambassadeur ;
//   · le comptage des arrivées par un lien (/arrivee).
//
// SECRETS (posés par Kevin, jamais dans le dépôt) :
//   FIREBASE_DB_SECRET   le code secret de la base (console Firebase)
//   VAPID_PRIVATE_KEY    la clé privée VAPID (base64url, 43 caractères)
// VARIABLES (wrangler.toml) : FIREBASE_DB_URL, VAPID_PUBLIC_KEY.

import { creerBase } from './base.js';
import { creerMetier } from './metier.js';
import { minute } from './planif.js';
import { repondreAppel } from './appels.js';
import { cloudinaryDestroy, compteCloudinary } from './medias.js';
import { creerPaypal, recevoirWebhook, jetonPaypal } from './paypal.js';

// Les fonctions appelées par l'app (protocole onCall, jeton Firebase vérifié).
const APPELS = { cloudinaryDestroy };

// Toutes les requêtes sortantes passent ici : c'est le compteur du budget.
function outils(env) {
  let n = 0;
  const fetchCompte = (url, init) => { n++; return fetch(url, init); };
  // Un secret collé à la main peut traîner un retour à la ligne : on le retire.
  const net = (v) => String(v || '').trim();
  const db = creerBase({ url: net(env.FIREBASE_DB_URL), auth: net(env.FIREBASE_DB_SECRET), fetchImpl: fetchCompte });
  const M = creerMetier({ db, vapid: { publique: net(env.VAPID_PUBLIC_KEY), privee: net(env.VAPID_PRIVATE_KEY) }, fetchImpl: fetchCompte });
  // Les clés de tous les dossiers, pour la rareté des badges (lecture en shallow).
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.paypal = creerPaypal({ db, M, env, fetchImpl: fetchCompte });
  return { db, M, env, compteur: () => n };
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Cache-Control': 'no-store' };
// ⚠ UN 204 OU UN 304 N'A PAS DE CORPS, pas même '' : le constructeur Response
// lève alors « Invalid response status code 204 ». C'est ce qui cassait la
// pré-vérification CORS (OPTIONS) de /fn/cloudinaryDestroy : l'exception
// sortait sans en-têtes CORS, le navigateur y voyait « Impossible de joindre
// le serveur », et l'app coupait les suppressions (_cldIndispo).
const SANS_CORPS = new Set([101, 204, 205, 304]);
const reponse = (corps, statut, type) => {
  const st = statut || 200;
  const vide = SANS_CORPS.has(st);
  const entetes = Object.assign(vide ? {} : { 'Content-Type': type || 'application/json; charset=utf-8' }, CORS);
  return new Response(vide ? null : corps, { status: st, headers: entetes });
};

export default {
  async fetch(req, env, ctx) {
    // TOUT EST DANS LE try, pré-vérification comprise : aucune exception ne
    // doit sortir d'ici sans en-têtes CORS.
    try {
      if (req.method === 'OPTIONS') return reponse(null, 204);
      const url = new URL(req.url);
      // LES FONCTIONS DE L'APP : /fn/<nom>, comme les Cloud Functions.
      if (url.pathname.startsWith('/fn/') && req.method === 'POST') {
        const o = outils(env);
        return await repondreAppel(req, APPELS, { db: o.db, env, projet: 'repcore-sync' });
      }
      // PAYPAL : chaque événement d'abonnement ou de paiement, signature vérifiée chez PayPal.
      if (url.pathname === '/paypal' && req.method === 'POST') {
        const o = outils(env);
        return await recevoirWebhook(req, { db: o.db, M: o.M, env });
      }
      // L'app vient de déposer un événement : on le traite tout de suite,
      // sans attendre le réveil de la minute. Aucune donnée n'est lue ici.
      if (url.pathname === '/reveil') {
        const o = outils(env);
        ctx.waitUntil(minute(o).catch(() => {}));
        return reponse('', 202);
      }
      // L'arrivée par un lien (/i, la page d'accueil, les pages publiques).
      if (url.pathname === '/arrivee' || url.pathname === '/amb-clic') {
        const q = Object.fromEntries(url.searchParams);
        if (url.pathname === '/amb-clic' && q.c) q.amb = q.c;
        const o = outils(env);
        ctx.waitUntil(o.M.arrivee(q).catch(() => {}));
        return reponse('', 204);
      }
      // LES CLÉS SONT-ELLES JUSTES, et pas seulement posées ? Un jeton PayPal
      // demandé, un ping Cloudinary authentifié. Rien d'autre ne sort que oui/non
      // et le code HTTP, jamais une clé.
      if (url.pathname === '/sante' && url.searchParams.get('cles') === '1') {
        const r = {};
        try {
          const jeton = await jetonPaypal(env); r.paypal = 'ok';
          // Le Webhook ID posé est-il celui qui pointe ici ?
          const l = await (await fetch('https://api-m.paypal.com/v1/notifications/webhooks', { headers: { Authorization: 'Bearer ' + jeton } })).json();
          const w = ((l && l.webhooks) || []).find((x) => x.id === String(env.PAYPAL_WEBHOOK_ID || '').trim());
          r.webhook = !w ? 'Webhook ID inconnu de PayPal' : (/repcore-serveur\.repcore\.workers\.dev\/paypal$/.test(w.url) ? 'ok' : 'pointe ailleurs');
        } catch (e) { r.paypal = r.paypal || String(e.message || e).slice(0, 60); }
        try {
          const k = String(env.CLOUDINARY_API_KEY || '').trim(), sec = String(env.CLOUDINARY_API_SECRET || '').trim();
          if (!k || !sec) r.cloudinary = 'non configuré';
          else {
            const c = await fetch('https://api.cloudinary.com/v1_1/' + compteCloudinary(env) + '/ping', { headers: { Authorization: 'Basic ' + btoa(k + ':' + sec) } });
            r.cloudinary = c.ok ? 'ok' : 'HTTP ' + c.status;
          }
        } catch (e) { r.cloudinary = 'injoignable'; }
        return reponse(JSON.stringify(r));
      }
      if (url.pathname === '/sante') {
        return reponse(JSON.stringify({ ok: true, base: !!env.FIREBASE_DB_URL, secret: !!env.FIREBASE_DB_SECRET,
          vapid: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
          paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID),
          cloudinary: !!(env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) }));
      }
      return reponse(JSON.stringify({ repcore: 'serveur léger' }), 404);
    } catch (e) {
      return reponse(JSON.stringify({ erreur: 'interne' }), 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(minute(outils(env)));
  },
};
