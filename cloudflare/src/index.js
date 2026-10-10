// ══ LE SERVEUR LÉGER DE REPCORE (Cloudflare Worker, plan gratuit) ═════════
//
// Ce que le plan Spark de Firebase ne fait pas, sans rien payer :
//   · les notifications quand l'app est fermée (Web Push) ;
//   · les travaux à heure fixe (série en danger, bilan, Wrapped, défis, rareté
//     des badges, résumé des ambassadeurs) ;
//   · le jugement des parrainages et des codes ambassadeur ;
//   · le comptage des arrivées par un lien (/arrivee) ;
//   · l'aperçu des pages publiques dans WhatsApp et Instagram (/@…, /coach/…).
//
// SECRETS (posés par Kevin, jamais dans le dépôt) :
//   FIREBASE_SERVICE_ACCOUNT  le JSON d'un compte de service Google (accès à la
//                        base par jeton OAuth, en en-tête ; voir google.js)
//   FIREBASE_DB_SECRET   l'ANCIEN code secret de la base : lu seulement tant
//                        que le compte de service n'est pas posé. À supprimer.
//   VAPID_PRIVATE_KEY    la clé privée VAPID (base64url, 43 caractères)
//   ADMIN_SECRET         ce que /sante?cles=1 exige (Authorization: Bearer …).
//   GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET, GARMIN_PUSH_SECRET, GARMIN_CLE
//                        la Health API de Garmin (garmin.js). Un seul absent : fermé.
//                        Absent : /sante?cles=1 est fermé.
// LIMITES (wrangler.toml, [[ratelimits]]) : LIMITE_ARRIVEES, par adresse IP,
// pour /arrivee et /amb-clic. Absente (tests, ancien déploiement) : rien n'est limité.
// VARIABLES (wrangler.toml) : FIREBASE_DB_URL, VAPID_PUBLIC_KEY.

import { creerBase } from './base.js';
import { lireCompteService, jetonCompteService } from './google.js';
import { creerMetier } from './metier.js';
import { minute } from './planif.js';
import { repondreAppel } from './appels.js';
import { cloudinaryDestroy, compteCloudinary } from './medias.js';
import { creerPaypal, recevoirWebhook, jetonPaypal } from './paypal.js';
import { creerAffluence } from './affluence.js';
import { creerFinEssai } from './finessai.js';
import { creerPremiere } from './premiere.js';
import { servirPagePublique } from './pages.js';
import { santeJeton, recevoirSante, compteDuJeton, rappelSanteUn } from './sante.js';
import { creerPaiementsCoach } from './paiements-coach.js';
import { creerGarmin, garminOuvert } from './garmin.js';

// Les fonctions appelées par l'app (protocole onCall, jeton Firebase vérifié).
// paiementCoach : relier son compte PayPal (coach), commander et capturer (athlète).
const paiementCoach = (req, ctx) => creerPaiementsCoach(ctx).appel(req);
// garmin : relier sa montre Garmin (OAuth), l'état, la révocation (garmin.js).
const garmin = (req, ctx) => creerGarmin(ctx).appel(req, ctx.requete);
const APPELS = { cloudinaryDestroy, santeJeton, paiementCoach, garmin };

// Toutes les requêtes sortantes passent ici : c'est le compteur du budget.
function outils(env) {
  let n = 0;
  const fetchCompte = (url, init) => { n++; return fetch(url, init); };
  // Un secret collé à la main peut traîner un retour à la ligne : on le retire.
  const net = (v) => String(v || '').trim();
  const compte = lireCompteService(env.FIREBASE_SERVICE_ACCOUNT);
  const db = creerBase({ url: net(env.FIREBASE_DB_URL), fetchImpl: fetchCompte,
    jeton: compte ? () => jetonCompteService(compte, { fetchImpl: fetchCompte }) : null,
    auth: compte ? null : net(env.FIREBASE_DB_SECRET) });
  const M = creerMetier({ db, vapid: { publique: net(env.VAPID_PUBLIC_KEY), privee: net(env.VAPID_PRIVATE_KEY) }, fetchImpl: fetchCompte });
  // Les clés de tous les dossiers, pour la rareté des badges (lecture en shallow).
  M.coachsEtUsers = () => db.ref('users').shallow();
  M.paypal = creerPaypal({ db, M, env, fetchImpl: fetchCompte });
  // Les connexions simultanées estimées, chaque minute, et l'alerte à 70.
  M.affluence = creerAffluence({ db, M });
  // La fin d'essai : J-3, J-1, J0 à 18 h 30, et l'étiquette Systeme.io à J-3.
  M.finEssai = creerFinEssai({ db, M, env, fetchImpl: fetchCompte });
  M.premiere = creerPremiere({ db, M });
  // Le rappel du matin (iPhone) : les comptes synchronisés, un par un.
  M.santeComptes = () => db.ref('sante_sync').shallow();
  M.santeRappelUn = (cle, t) => rappelSanteUn(cle, t, { db, envoyerPush: M.envoyerPush });
  return { db, M, env, fetchCompte, compteur: () => n };
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-RepCore-Jeton', 'Cache-Control': 'no-store' };
// ⚠ UN 204 OU UN 304 N'A PAS DE CORPS, pas même '' : le constructeur Response
// lève alors « Invalid response status code 204 ». C'est ce qui cassait la
// pré-vérification CORS (OPTIONS) de /fn/cloudinaryDestroy : l'exception
// sortait sans en-têtes CORS, le navigateur y voyait « Impossible de joindre
// le serveur », et l'app coupait les suppressions (_cldIndispo).
const SANS_CORPS = new Set([101, 204, 205, 304]);
// Comparaison en temps constant : la durée ne dit pas combien de caractères
// sont justes.
function egalSecret(a, b) {
  const x = String(a || ''), y = String(b || '');
  if (!x || !y) return false;
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x.charCodeAt(i % x.length) || 0) ^ (y.charCodeAt(i % y.length) || 0);
  return d === 0;
}
// L'adresse IP de l'appelant, telle que Cloudflare la donne.
const ipDe = (req) => (req.headers && req.headers.get('CF-Connecting-IP')) || 'inconnue';
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
        return await repondreAppel(req, APPELS, { db: o.db, M: o.M, env, projet: 'repcore-sync', fetchImpl: o.fetchCompte, requete: req });
      }
      // LA SANTÉ SYNCHRONISÉE (Health Connect, Raccourci iPhone) : voir sante.js.
      // Le corps n'est jamais journalisé.
      if (url.pathname === '/sante/qui' && req.method === 'POST') {
        const o = outils(env);
        const r = await compteDuJeton(req, { db: o.db });
        return reponse(JSON.stringify(r.corps), r.statut);
      }
      if ((url.pathname === '/sante/i' || url.pathname.startsWith('/sante/i/')) && req.method === 'POST') {
        const o = outils(env);
        const r = await recevoirSante(req, { db: o.db });
        return reponse(JSON.stringify(r.corps), r.statut);
      }
      // GARMIN (garmin.js) : la liaison OAuth, puis ce que Garmin pousse.
      // Fermé (404 ou retour « ferme ») tant que les secrets GARMIN_* manquent.
      if (url.pathname === '/garmin/lier' && req.method === 'GET') {
        const o = outils(env);
        return await creerGarmin({ db: o.db, env, fetchImpl: o.fetchCompte }).lier(req);
      }
      if (url.pathname === '/garmin/retour' && req.method === 'GET') {
        const o = outils(env);
        return await creerGarmin({ db: o.db, env, fetchImpl: o.fetchCompte }).retour(req);
      }
      if (url.pathname.startsWith('/garmin/push') && req.method === 'POST') {
        const o = outils(env);
        const r = await creerGarmin({ db: o.db, env, fetchImpl: o.fetchCompte }).recevoir(req);
        return reponse(JSON.stringify(r.corps), r.statut);
      }
      // PAYPAL : chaque événement d'abonnement ou de paiement, signature vérifiée chez PayPal.
      if (url.pathname === '/paypal' && req.method === 'POST') {
        const o = outils(env);
        return await recevoirWebhook(req, { db: o.db, M: o.M, env });
      }
      // L'app vient de déposer un événement : on le traite tout de suite,
      // sans attendre le réveil de la minute. Aucune donnée n'est lue ici.
      // SANS EFFET si la file a été parcourue il y a moins de 30 s, ou si une
      // autre exécution la tient (verrou : planif.js).
      if (url.pathname === '/reveil') {
        const o = outils(env);
        ctx.waitUntil(minute(Object.assign({ source: 'reveil' }, o)).catch(() => {}));
        return reponse('', 202);
      }
      // L'arrivée par un lien (/i, la page d'accueil, les pages publiques).
      // Limitée par adresse IP (LIMITE_ARRIVEES) : un script qui boucle ne
      // gonfle ni les clics d'un ambassadeur, ni les compteurs « Viralité ».
      if (url.pathname === '/arrivee' || url.pathname === '/amb-clic') {
        // Une panne du limiteur laisse passer : un clic compté de trop vaut
        // mieux qu'une page publique qui renvoie 500.
        let limite = null;
        try { if (env.LIMITE_ARRIVEES && typeof env.LIMITE_ARRIVEES.limit === 'function') limite = await env.LIMITE_ARRIVEES.limit({ key: ipDe(req) }); } catch (e) { limite = null; }
        if (limite && limite.success === false) return reponse('', 429, 'text/plain');
        const q = Object.fromEntries(url.searchParams);
        if (url.pathname === '/amb-clic' && q.c) q.amb = q.c;
        const o = outils(env);
        ctx.waitUntil(o.M.arrivee(q).catch(() => {}));
        return reponse('', 204);
      }
      // LE PROSPECT (lot C6) : le « Ça m'intéresse » de la vitrine d'un coach.
      // Sans compte, donc limité par adresse IP comme /arrivee, et borné par
      // coach et par jour dans prospects.js. Aucun paiement ici.
      if ((url.pathname === '/prospect' && req.method === 'POST') || url.pathname === '/vitrine-vue') {
        let limite = null;
        try { if (env.LIMITE_ARRIVEES && typeof env.LIMITE_ARRIVEES.limit === 'function') limite = await env.LIMITE_ARRIVEES.limit({ key: ipDe(req) }); } catch (e) { limite = null; }
        if (limite && limite.success === false) return reponse(JSON.stringify({ ok: false, raison: 'trop' }), 429);
        const o = outils(env);
        if (url.pathname === '/vitrine-vue') {
          ctx.waitUntil(o.M.vitrineVue(url.searchParams.get('s'), Date.now()).catch(() => {}));
          return reponse(null, 204);
        }
        let corps = null;
        try { corps = await req.json(); } catch (e) { corps = null; }
        if (!corps || typeof corps !== 'object') return reponse(JSON.stringify({ ok: false, raison: 'corps' }), 400);
        const r = await o.M.prospectRecevoir(corps, Date.now());
        return reponse(JSON.stringify(r), r.ok ? 200 : 400);
      }
      // LES CLÉS SONT-ELLES JUSTES, et pas seulement posées ? Un jeton PayPal
      // demandé, un ping Cloudinary authentifié. Rien d'autre ne sort que oui/non
      // et le code HTTP, jamais une clé.
      // RÉSERVÉ À L'ADMINISTRATEUR : chaque appel demande un jeton PayPal et
      // interroge Cloudinary — ouvert à tous, c'était une porte pour épuiser
      // les quotas. Authorization: Bearer <ADMIN_SECRET>.
      if (url.pathname === '/sante' && url.searchParams.get('cles') === '1') {
        const donne = String(req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
        if (!egalSecret(donne, String(env.ADMIN_SECRET || '').trim())) return reponse(JSON.stringify({ erreur: 'réservé' }), 401);
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
      // LES PAGES PUBLIQUES, AVEC LEUR APERÇU (/@<pseudo>, /coach/<slug>) :
      // firebase.json y redirige ; voir pages.js. Mises en cache 6 h.
      if ((req.method === 'GET' || req.method === 'HEAD') && (url.pathname.startsWith('/@') || url.pathname.startsWith('/coach/'))) {
        // La vitrine d'un coach lit sa marque (lot M1) avec le compte de service.
        const r = await servirPagePublique(req, { env, ctx, db: url.pathname.startsWith('/coach/') ? outils(env).db : null });
        if (r) return r;
      }
      if (url.pathname === '/sante') {
        // `acces` : « compte_service » est l'état voulu ; « secret_historique »
        // dit que l'ancien code secret sert encore et qu'il reste à le retirer.
        const cs = !!lireCompteService(env.FIREBASE_SERVICE_ACCOUNT);
        return reponse(JSON.stringify({ ok: true, base: !!env.FIREBASE_DB_URL, secret: cs || !!env.FIREBASE_DB_SECRET,
          acces: cs ? 'compte_service' : (env.FIREBASE_DB_SECRET ? 'secret_historique' : 'aucun'),
          vapid: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
          paypal: !!(env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET && env.PAYPAL_WEBHOOK_ID),
          cloudinary: !!(env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET), garmin: garminOuvert(env) }));
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
