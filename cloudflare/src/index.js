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

// Toutes les requêtes sortantes passent ici : c'est le compteur du budget.
function outils(env) {
  let n = 0;
  const fetchCompte = (url, init) => { n++; return fetch(url, init); };
  const db = creerBase({ url: env.FIREBASE_DB_URL, auth: env.FIREBASE_DB_SECRET, fetchImpl: fetchCompte });
  const M = creerMetier({ db, vapid: { publique: env.VAPID_PUBLIC_KEY, privee: env.VAPID_PRIVATE_KEY }, fetchImpl: fetchCompte });
  // Les clés de tous les dossiers, pour la rareté des badges (lecture en shallow).
  M.coachsEtUsers = () => db.ref('users').shallow();
  return { db, M, compteur: () => n };
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
const reponse = (corps, statut, type) => new Response(corps, { status: statut || 200,
  headers: Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8' }, CORS) });

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return reponse('', 204);
    try {
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
      if (url.pathname === '/sante') {
        return reponse(JSON.stringify({ ok: true, base: !!env.FIREBASE_DB_URL, secret: !!env.FIREBASE_DB_SECRET,
          vapid: !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) }));
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
