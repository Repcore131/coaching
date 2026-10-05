// ══ FIT PULSE — notifications push (Web Push standard, sans dépendance) ═════
//
// Appelé par fitpulse-serveur.mjs à chaque passage (toutes les 5 minutes).
//  - Clés VAPID créées au premier passage : la clé privée reste dans
//    /fitpulse_secret (aucune règle de lecture : seul le compte de service y
//    accède), la clé publique est publiée dans /pulse/serveur pour l'appli.
//  - Abonnements des téléphones : /pulse_push/<idMembre>/<empreinte>.
//  - Règles d'envoi : nouvelle résiliation, défi lancé, dossiers du jour à
//    10 h, résiliation à J-7, bilan du lundi. Préférences et heures calmes de
//    chacun respectées, une seule fois par événement (journal dédoublonné).
// Jamais de nom de client dans une notification.
import crypto from 'node:crypto';

const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

export function newVapid() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  return { publicKey: b64u(Buffer.concat([Buffer.from([4]), unb64u(pub.x), unb64u(pub.y)])), privateJwk: privateKey.export({ format: 'jwk' }) };
}
function vapidHeader(endpoint, vapid, sub) {
  const aud = new URL(endpoint).origin; const now = Math.floor(Date.now() / 1000);
  const data = `${b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))}.${b64u(JSON.stringify({ aud, exp: now + 12 * 3600, sub }))}`;
  const key = crypto.createPrivateKey({ key: vapid.privateJwk, format: 'jwk' });
  const sig = crypto.sign('sha256', Buffer.from(data), { key, dsaEncoding: 'ieee-p1363' });
  return `vapid t=${data}.${b64u(sig)}, k=${vapid.publicKey}`;
}
const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
// Chiffrement aes128gcm (RFC 8291 / 8188), un seul enregistrement.
export function encrypt(sub, payload) {
  const ua = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const as = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(ua);
  const ikm = hmac(hmac(auth, shared), Buffer.concat([Buffer.from('WebPush: info\0'), ua, as, Buffer.from([1])]));
  const salt = crypto.randomBytes(16); const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: aes128gcm\0'), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from('Content-Encoding: nonce\0'), Buffer.from([1])])).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([c.update(Buffer.concat([Buffer.from(payload), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const head = Buffer.alloc(21); salt.copy(head, 0); head.writeUInt32BE(4096, 16); head[20] = as.length;
  return Buffer.concat([head, as, body]);
}
export async function sendPush(sub, msg, vapid, { ttl = 4 * 3600, contact = 'mailto:guellec.coachingpro@gmail.com' } = {}) {
  const r = await fetch(sub.endpoint, { method: 'POST', headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: String(ttl), Urgency: 'normal', Authorization: vapidHeader(sub.endpoint, vapid, contact) }, body: encrypt(sub, JSON.stringify(msg)) });
  return r.status;
}

// ── Heure de Paris, préférences ───────────────────────────────────────────
function paris(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(d).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hm: `${p.hour}:${p.minute}`, h: Number(p.hour), dow: p.weekday };
}
const prefsOf = (S, uid) => ((S.prefs || {})[uid] || {});
function ruleOn(S, uid, rule) { const p = prefsOf(S, uid); if (rule === 'digest') return p.digest !== false; const n = p.notif || {}; return (n.rules || {})[rule] !== false; }
function quiet(S, uid, P) { const q = { from: '20:30', to: '08:00', sunday: true, ...((prefsOf(S, uid).notif || {}).quiet || {}) }; if (q.sunday && P.dow.startsWith('dim')) return true; return q.from > q.to ? (P.hm >= q.from || P.hm < q.to) : (P.hm >= q.from && P.hm < q.to); }
const maxOf = (S, uid) => Number((prefsOf(S, uid).notif || {}).max) || 6;
const active = u => u && u.status !== 'archived' && u.status !== 'pending';
const inClub = (u, c) => (u.clubs || []).includes(c) || u.role === 'createur';
const resOpen = r => ['nouvelle', 'traitement'].includes(r.status || (r.saved ? 'sauvee' : 'resiliee'));
const daysTo = (d, today) => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);

// Liste des notifications à envoyer : { key, uid, rule, title, body, url, ttl }.
export function plan(S, state, now = new Date()) {
  const P = paris(now); const last = Number(state.lastRun) || (now.getTime() - 10 * 60000); const out = [];
  const users = Object.values(S.users || {}).filter(active);
  const add = (uid, rule, key, title, body, url, ttl = 4 * 3600) => out.push({ uid, rule, key: `${key}|${uid}`, title, body, url, ttl });
  for (const r of Object.values(S.resiliations || {})) {
    if (!r || !r.at || r.at <= last || now - r.at > 864e5 || !resOpen(r)) continue;
    users.filter(u => inClub(u, r.clubId) && u.id !== r.userId && u.id !== r.by).forEach(u => add(u.id, 'res_new', `resnew_${r.id}`, 'Résiliation', 'Nouvelle résiliation reçue. Ouvrez Résiliations pour la prendre.', '#/resiliations'));
  }
  for (const ch of Object.values(S.challenges || {})) {
    if (!ch || !ch.start || ch.start <= last || ch.end < now.getTime()) continue;
    const h = Math.max(1, Math.round((ch.end - ch.start) / 3600000));
    users.filter(u => inClub(u, ch.clubId) && u.id !== ch.by).forEach(u => add(u.id, 'defi', `defi_${ch.id}`, 'Défi flash', `Défi flash lancé : ${String(ch.title || '').slice(0, 60)}, ${h} h. Ouvrez Défis.`, '#/challenges', 3600));
  }
  if (P.h >= 10 && P.h < 12) {
    for (const u of users) {
      const res = Object.values(S.resiliations || {}).filter(r => r && resOpen(r) && r.ownerId === u.id).length;
      const dun = Object.values(S.clients || {}).filter(c => c && Number(c.balance) > 0 && (c.dunning || {}).ownerId === u.id).length;
      const n = res + dun; if (n) add(u.id, 'relances_jour', `jour_${P.day}`, 'Appels du jour', `${n} ${n > 1 ? 'dossiers' : 'dossier'} à traiter aujourd’hui.`, '#/relances');
    }
  }
  if (P.h >= 9 && P.h < 19) {
    for (const r of Object.values(S.resiliations || {})) {
      if (!r || !resOpen(r) || !r.ownerId || !r.effective) continue; const n = daysTo(r.effective, P.day);
      if (n >= 0 && n <= 7) add(r.ownerId, 'res_j7', `res7_${r.id}`, 'Résiliation à J-7', n ? `Une résiliation à votre nom prend effet dans ${n} jour${n > 1 ? 's' : ''}.` : 'Une résiliation à votre nom prend effet aujourd’hui.', '#/resiliations');
    }
  }
  if (P.dow.startsWith('lun') && P.h >= 9 && P.h < 12) users.forEach(u => add(u.id, 'digest', `digest_${P.day}`, 'Bilan de la semaine', 'Votre bilan de la semaine est prêt sur l’accueil.', '#/home', 12 * 3600));
  return { P, items: out.filter(x => ruleOn(S, x.uid, x.rule) && !quiet(S, x.uid, P)) };
}

// Passage complet : clés, plan, envois, journal, purge des abonnements morts.
export async function passagePush(api, tk, S) {
  const state = (await (await api(tk, 'fitpulse_secret.json')).json()) || {};
  let vapid = state.vapid;
  if (!vapid) { vapid = newVapid(); await api(tk, 'fitpulse_secret/vapid.json', { method: 'PUT', body: JSON.stringify(vapid) }); }
  if (!S.serveur || S.serveur.vapidPublic !== vapid.publicKey) await api(tk, 'pulse/serveur/vapidPublic.json', { method: 'PUT', body: JSON.stringify(vapid.publicKey) });
  const subs = (await (await api(tk, 'pulse_push.json')).json()) || {};
  const log = state.log || {}; const { P, items } = plan(S, state);
  let sent = 0; const dead = []; const perDay = {};
  Object.entries(log).forEach(([k, v]) => { const uid = k.split('|')[1]; if (v && v.day === P.day) perDay[uid] = (perDay[uid] || 0) + 1; });
  for (const it of items) {
    const lk = it.key.replace(/[.#$/[\]]/g, ','); if (log[lk]) continue;
    if ((perDay[it.uid] || 0) >= maxOf(S, it.uid)) continue;
    const devices = Object.entries(subs[it.uid] || {});
    log[lk] = { day: P.day, at: Date.now(), n: devices.length };
    if (!devices.length) continue;
    perDay[it.uid] = (perDay[it.uid] || 0) + 1;
    for (const [h, sub] of devices) {
      try { const st = await sendPush(sub, { title: it.title, body: it.body, url: it.url, tag: it.key.split('|')[0] }, vapid, { ttl: it.ttl }); if (st === 404 || st === 410) dead.push(`${it.uid}/${h}`); else if (st < 300) sent++; else console.log(`push ${st}`); }
      catch (e) { console.log('push échec :', e.message); }
    }
  }
  // journal : 8 jours au plus
  const cut = Date.now() - 8 * 864e5; Object.keys(log).forEach(k => { if (!log[k] || log[k].at < cut) delete log[k]; });
  await api(tk, 'fitpulse_secret/log.json', { method: 'PUT', body: JSON.stringify(log) });
  await api(tk, 'fitpulse_secret/lastRun.json', { method: 'PUT', body: JSON.stringify(Date.now()) });
  for (const d of dead) await api(tk, `pulse_push/${d}.json`, { method: 'DELETE' });
  return { sent, planned: items.length, dead: dead.length, devices: Object.values(subs).reduce((s, x) => s + Object.keys(x || {}).length, 0) };
}
