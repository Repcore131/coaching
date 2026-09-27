// Prépare (prep) puis vérifie (verif) l'essai du Worker dans workerd.
//   node cloudflare/test/scenario-local.mjs prep <dossier> <port>
//   node cloudflare/test/scenario-local.mjs verif <dossier>
// prep écrit : scenario.json (la base), .dev.vars (clés d'ESSAI générées ici,
// jamais les vraies), appareil.json (de quoi déchiffrer ce que reçoit l'appareil).
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const [mode, dossier, port] = process.argv.slice(2);
const hk = (sel, ikm, info, n) => crypto.createHmac('sha256', crypto.createHmac('sha256', sel).update(ikm).digest())
  .update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, n);

if (mode === 'prep') {
  fs.mkdirSync(dossier, { recursive: true });
  const vp = crypto.createECDH('prime256v1'); vp.generateKeys();
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
  const auth = crypto.randomBytes(16);
  const t = Date.now();
  const A1 = 'lea@t,fr', C1 = 'kevin@t,fr';
  const base = {
    users: { [A1]: { coachEmailKey: C1, fname: 'Léa', bilans: [{ date: t - 864e5, reponseCoach: 'Belle régularité ⚡' }] } },
    push: { [A1]: { a1b2c3: { endpoint: 'http://127.0.0.1:' + port + '/service-push/lea', cree: t,
      keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } } },
    evenements: { e1: { type: 'reponse_bilan', par: C1, dest: A1, i: '0', at: t } },
  };
  fs.writeFileSync(path.join(dossier, 'scenario.json'), JSON.stringify(base));
  fs.writeFileSync(path.join(dossier, '.dev.vars'), 'FIREBASE_DB_SECRET=essai\nVAPID_PRIVATE_KEY=' + vp.getPrivateKey().toString('base64url') + '\n');
  fs.writeFileSync(path.join(dossier, 'appareil.json'), JSON.stringify({ prive: ua.getPrivateKey().toString('base64url'),
    auth: auth.toString('base64url'), vapidPublique: vp.getPublicKey().toString('base64url') }));
  console.log(vp.getPublicKey().toString('base64url'));
} else {
  const s = JSON.parse(fs.readFileSync(path.join(dossier, 'sortie.json'), 'utf8'));
  const ap = JSON.parse(fs.readFileSync(path.join(dossier, 'appareil.json'), 'utf8'));
  const ua = crypto.createECDH('prime256v1'); ua.setPrivateKey(Buffer.from(ap.prive, 'base64url'));
  const auth = Buffer.from(ap.auth, 'base64url');
  console.log('événements restants :', s.base.evenements ? Object.keys(s.base.evenements).length : 0);
  console.log('push reçus :', s.push.length);
  for (const p of s.push) {
    const b = Buffer.from(p.corps, 'base64'), sel = b.subarray(0, 16), idlen = b[20], as = b.subarray(21, 21 + idlen), ch = b.subarray(21 + idlen);
    const ikm = hk(auth, ua.computeSecret(as), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as]), 32);
    const d = crypto.createDecipheriv('aes-128-gcm', hk(sel, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16), hk(sel, ikm, Buffer.from('Content-Encoding: nonce\0'), 12));
    d.setAuthTag(ch.subarray(ch.length - 16));
    const c = Buffer.concat([d.update(ch.subarray(0, ch.length - 16)), d.final()]);
    console.log('déchiffré :', c.subarray(0, c.length - 1).toString('utf8'));
    console.log('en-tête VAPID :', /^vapid t=.+, k=/.test(p.headers.authorization) ? 'présent' : 'ABSENT');
  }
  console.log('journal du jour :', JSON.stringify(s.base.push_log || null));
}
