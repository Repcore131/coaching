// Une Realtime Database en mémoire qui parle l'API REST (GET/PUT/PATCH/DELETE,
// shallow, orderBy "$key" + limitToLast, orderBy "<champ>" + equalTo, ETag/if-match), et un faux service
// de push qui garde ce qu'il reçoit. Branchés sur un seul `fetch`.
import crypto from 'node:crypto';

export function fausseBase(initial) {
  let racine = JSON.parse(JSON.stringify(initial || {}));
  const segs = (p) => p.split('/').filter(Boolean);
  const lire = (p) => { let n = racine; for (const s of segs(p)) { if (n == null || typeof n !== 'object') return null; n = n[s]; } return n === undefined ? null : n; };
  const nettoyer = (n) => {
    if (n === null || typeof n !== 'object') return n;
    for (const k of Object.keys(n)) { n[k] = nettoyer(n[k]); if (n[k] === null || n[k] === undefined || (typeof n[k] === 'object' && !Object.keys(n[k]).length)) delete n[k]; }
    return n;
  };
  const ecrire = (p, v) => {
    const s = segs(p);
    if (!s.length) { racine = v === null ? {} : JSON.parse(JSON.stringify(v)); return; }
    let n = racine;
    for (const x of s.slice(0, -1)) { if (!n[x] || typeof n[x] !== 'object') n[x] = {}; n = n[x]; }
    if (v === null) delete n[s[s.length - 1]]; else n[s[s.length - 1]] = JSON.parse(JSON.stringify(v));
    racine = nettoyer(racine) || {};
  };
  const etag = (v) => crypto.createHash('sha1').update(JSON.stringify(v)).digest('hex');
  const recus = [];            // ce que le service de push a reçu
  let pushStatut = 201;
  const reponse = (statut, corps, entetes) => ({ ok: statut < 400, status: statut,
    headers: { get: (k) => (entetes || {})[k] || (entetes || {})[k.toLowerCase()] || null },
    text: async () => corps === undefined ? '' : JSON.stringify(corps), json: async () => corps });
  let requetes = 0;
  async function fetchImpl(url, init) {
    requetes++;
    const u = new URL(url);
    if (!u.pathname.endsWith('.json')) {        // un service de push
      recus.push({ endpoint: url, init });
      return { status: typeof pushStatut === 'function' ? pushStatut(url) : pushStatut };
    }
    const p = decodeURIComponent(u.pathname.replace(/\.json$/, ''));
    const m = (init && init.method) || 'GET';
    const h = (init && init.headers) || {};
    if (m === 'GET') {
      let v = lire(p);
      if (u.searchParams.get('shallow') === 'true' && v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = true; v = o; }
      if (u.searchParams.get('orderBy') === '"$key"' && u.searchParams.get('limitToLast') && v && typeof v === 'object') {
        const n = Number(u.searchParams.get('limitToLast')); const o = {};
        for (const k of Object.keys(v).sort().slice(-n)) o[k] = v[k]; v = o;
      }
      const ob = u.searchParams.get('orderBy');
      if (ob && ob !== '"$key"' && u.searchParams.has('equalTo')) {
        const champ = JSON.parse(ob), eq = JSON.parse(u.searchParams.get('equalTo'));
        const n = Number(u.searchParams.get('limitToFirst')) || Infinity; const o = {};
        for (const k of Object.keys(v || {}).sort()) if (Object.keys(o).length < n && v[k] && v[k][champ] === eq) o[k] = v[k];
        v = o;
      }
      return reponse(200, v, h['X-Firebase-ETag'] ? { ETag: etag(lire(p)) } : {});
    }
    const corps = init.body ? JSON.parse(init.body) : null;
    if (m === 'PUT') {
      if (h['if-match'] && h['if-match'] !== etag(lire(p))) return reponse(412, { error: 'etag' });
      ecrire(p, corps); return reponse(200, corps);
    }
    if (m === 'PATCH') { for (const [k, v] of Object.entries(corps)) ecrire(p + '/' + k, v); return reponse(200, corps); }
    if (m === 'DELETE') { ecrire(p, null); return reponse(200, null); }
    return reponse(405, null);
  }
  return { fetchImpl, lire, ecrire, recus, requetes: () => requetes, set pushStatut(v) { pushStatut = v; }, get arbre() { return racine; } };
}

// Un appareil abonné : sa paire ECDH et de quoi déchiffrer ce qu'il reçoit.
export function appareil(endpoint) {
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const hk = (sel, ikm, info, n) => crypto.createHmac('sha256', crypto.createHmac('sha256', sel).update(ikm).digest())
    .update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);
  return {
    abonnement: { endpoint, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }, cree: 1 },
    lire(corps) {
      const b = Buffer.from(corps), sel = b.subarray(0, 16), idlen = b[20], as = b.subarray(21, 21 + idlen), ch = b.subarray(21 + idlen);
      const ikm = hk(auth, ua.computeSecret(as), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32);
      const d = crypto.createDecipheriv('aes-128-gcm', hk(sel, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hk(sel, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
      d.setAuthTag(ch.subarray(ch.length - 16));
      const c = Buffer.concat([d.update(ch.subarray(0, ch.length - 16)), d.final()]);
      return JSON.parse(c.subarray(0, c.length - 1).toString('utf8'));
    },
  };
}
