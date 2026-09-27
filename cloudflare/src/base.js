// ══ LA BASE, PAR L'API REST ═══════════════════════════════════════════════
//
// Le serveur léger (Cloudflare Worker) n'a pas le SDK d'administration de
// Firebase : il parle à la Realtime Database par son API REST, avec le code
// secret de la base (ou un jeton d'accès) en paramètre `auth`.
//
// CETTE COUCHE IMITE LE SOUS-ENSEMBLE DU SDK dont le code métier se sert —
// ref(chemin).get() / set() / update() / remove() / transaction() / push(),
// orderByKey().limitToLast(n), orderByChild(c).equalTo(v), snapshot.val(),
// .key, .forEach() — pour que ce code (écrit d'abord pour les Cloud Functions,
// et testé) passe tel quel.
//
// ⚠ LES REQUÊTES orderByChild/equalTo SE FONT ICI, pas sur le serveur : l'API
//   REST refuse un tri sans index déclaré. On lit le nœud et on filtre. Elles
//   ne servent que sur de petits nœuds (les messages d'un Canal).
//
// ⚠ LES TRANSACTIONS reposent sur l'ETag : on lit avec `X-Firebase-ETag`,
//   on écrit avec `if-match` ; un 412 veut dire « quelqu'un est passé entre
//   les deux », et on recommence (cinq fois au plus).

export function creerBase({ url, auth, fetchImpl }) {
  const F = fetchImpl || fetch;
  const racine = String(url).replace(/\/$/, '');
  const q = (params) => {
    const p = new URLSearchParams();
    if (auth) p.set('auth', auth);
    for (const [k, v] of Object.entries(params || {})) if (v !== undefined) p.set(k, v);
    const s = p.toString();
    return s ? '?' + s : '';
  };
  // La racine s'écrit « /.json » : sans la barre, l'adresse devient
  // « …firebaseio.com.json », qui n'existe pas (écritures multi-chemins).
  const chemin = (c) => '/' + String(c || '').replace(/^\/+|\/+$/g, '');
  const adresse = (c, params) => racine + chemin(c) + '.json' + q(params);
  let compteur = 0;   // requêtes émises (le plan gratuit en plafonne 50 par exécution)

  async function appel(methode, c, corps, params, entetes) {
    compteur++;
    const r = await F(adresse(c, params), {
      method: methode,
      headers: Object.assign({ 'Content-Type': 'application/json' }, entetes || {}),
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    return r;
  }
  async function lireJson(r, c) {
    if (!r.ok) throw new Error('base ' + r.status + ' sur ' + c + ' : ' + (await r.text()).slice(0, 200));
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }

  function instantane(cle, v) {
    return {
      key: cle,
      val: () => (v === undefined ? null : v),
      exists: () => v !== null && v !== undefined,
      forEach(fn) {
        if (!v || typeof v !== 'object') return false;
        for (const k of Object.keys(v)) { if (fn(instantane(k, v[k])) === true) return true; }
        return false;
      },
    };
  }

  // Id de push() : horodaté et aléatoire, triable comme ceux de Firebase.
  const ALPHA = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
  function idPush() {
    let t = Date.now(), s = '';
    for (let i = 0; i < 8; i++) { s = ALPHA.charAt(t % 64) + s; t = Math.floor(t / 64); }
    const a = new Uint8Array(12); crypto.getRandomValues(a);
    for (const b of a) s += ALPHA.charAt(b % 64);
    return s;
  }

  function ref(c, requete) {
    const cle = c ? String(c).split('/').filter(Boolean).pop() : null;
    const R = {
      key: cle,
      toString: () => racine + chemin(c),
      child: (sous) => ref((c ? c + '/' : '') + sous),
      async get() {
        const rq = requete || {};
        if (rq.limitToLast && rq.orderBy === '$key') {
          const v = await lireJson(await appel('GET', c, undefined, { orderBy: '"$key"', limitToLast: String(rq.limitToLast) }), c);
          return instantane(cle, v);
        }
        let v = await lireJson(await appel('GET', c), c);
        if (rq.orderBy && rq.orderBy !== '$key' && rq.equalTo !== undefined && v && typeof v === 'object') {
          const f = {};
          for (const k of Object.keys(v)) if (v[k] && v[k][rq.orderBy] === rq.equalTo) f[k] = v[k];
          v = Object.keys(f).length ? f : null;
        }
        return instantane(cle, v);
      },
      async shallow() {
        const v = await lireJson(await appel('GET', c, undefined, { shallow: 'true' }), c);
        return v && typeof v === 'object' ? Object.keys(v) : [];
      },
      async set(v) {
        if (v === null || v === undefined) return R.remove();
        await lireJson(await appel('PUT', c, v), c);
      },
      async update(v) {
        // Un chemin vide vaut « à la racine » : multi-chemins, comme le SDK.
        // Les null retirent la clé (sémantique PATCH de Firebase).
        await lireJson(await appel('PATCH', c, v), c);
      },
      async remove() { await lireJson(await appel('DELETE', c), c); },
      push() { const id = idPush(); return ref((c ? c + '/' : '') + id); },
      async transaction(fn) {
        for (let essai = 0; essai < 5; essai++) {
          const r = await appel('GET', c, undefined, undefined, { 'X-Firebase-ETag': 'true' });
          const etag = r.headers.get('ETag');
          const actuel = await lireJson(r, c);
          const nouveau = fn(actuel === null ? null : actuel);
          if (nouveau === undefined) return { committed: false, snapshot: instantane(cle, actuel) };
          const w = await appel('PUT', c, nouveau, undefined, etag ? { 'if-match': etag } : undefined);
          if (w.status === 412) continue;
          await lireJson(w, c);
          return { committed: true, snapshot: instantane(cle, nouveau) };
        }
        throw new Error('transaction abandonnée sur ' + c);
      },
      orderByKey: () => ref(c, Object.assign({}, requete, { orderBy: '$key' })),
      orderByChild: (enfant) => ref(c, Object.assign({}, requete, { orderBy: enfant })),
      equalTo: (v) => ref(c, Object.assign({}, requete, { equalTo: v })),
      limitToLast: (n) => ref(c, Object.assign({}, requete, { limitToLast: n })),
    };
    return R;
  }
  return { ref: (c) => ref(c || ''), requetes: () => compteur };
}
