/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
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
// Minuit à Paris pour une date AAAA-MM-JJ (heure d'été ou d'hiver selon la date).
function parisMidnight(day) {
  const noon = new Date(day + 'T12:00:00Z');
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(noon).map(x => [x.type, x.value]));
  const offMin = (Number(p.hour) - 12) * 60 + Number(p.minute);
  return Date.parse(day + 'T00:00:00Z') - offMin * 60000;
}
const prefsOf = (S, uid) => ((S.prefs || {})[uid] || {});
function ruleOn(S, uid, rule) { const p = prefsOf(S, uid); if (rule === 'digest') return p.digest !== false; const n = p.notif || {}; return (n.rules || {})[rule] !== false; }
function quiet(S, uid, P) { const q = { from: '20:30', to: '08:00', sunday: true, ...((prefsOf(S, uid).notif || {}).quiet || {}) }; if (q.sunday && P.dow.startsWith('dim')) return true; return q.from > q.to ? (P.hm >= q.from || P.hm < q.to) : (P.hm >= q.from && P.hm < q.to); }
const maxOf = (S, uid) => Number((prefsOf(S, uid).notif || {}).max) || 6;
const active = u => u && u.status !== 'archived' && u.status !== 'pending';
const inClub = (u, c) => (u.clubs || []).includes(c) || u.role === 'createur';
const resOpen = r => ['nouvelle', 'traitement'].includes(r.status || (r.saved ? 'sauvee' : 'resiliee'));
const daysTo = (d, today) => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);

// ── Outils de calcul côté serveur (mêmes règles que l'appli) ──────────────
const FERIES = ['2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15', '2026-11-01', '2026-11-11', '2026-12-25', '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-08', '2027-05-17', '2027-07-14', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25'];
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const imp = (S, id) => !id || !S.imports || !S.imports[id] || S.imports[id].active !== false;
function counts(S, e) {
  if (!e || e.suppressed) return false;
  if (e.removedBy && S.imports && S.imports[e.removedBy] && S.imports[e.removedBy].active !== false) return false;
  const ids = e.importIds ? Object.keys(e.importIds) : []; if (ids.length) return ids.some(id => imp(S, id));
  return imp(S, e.importId);
}
const sum = (S, f) => Object.values(S.entries || {}).reduce((t, e) => (e && counts(S, e) && f(e) ? t + (Number(e.value) || 0) : t), 0);
const median = a => { const b = a.slice().sort((x, y) => x - y); return b.length ? b[Math.floor(b.length / 2)] : 0; };
const isMgr = u => u.role === 'manager' || u.role === 'createur';
function paliers(S, club, mk) { const P = (S.paliers || {})[club] || {}; if (P[mk]) return P[mk]; const m = Object.keys(P).filter(x => x < mk).sort().pop(); return m ? P[m] : { contrats: [{ target: 100 }, { target: 115 }, { target: 130 }] }; }
const dunDue = (c, day) => Number(c.balance) > 0 && (!(c.dunning || {}).next || c.dunning.next <= day) && !['perdu'].includes((c.dunning || {}).status);
const plurFr = (n, a, b) => `${n} ${n > 1 ? b : a}`;
const WEEK = ['ventes', 'clients-incident', 'sans-mandat', 'incidents', 'paiements', 'abonnements', 'clients'];
const MONTH = ['ventes', 'factures', 'evolution', 'tti', 'web', 'perf', 'incidents', 'resil', 'prospects', 'paiements'];

// Liste des notifications à envoyer : { key, uid, rule, title, body, url, ttl, urgent }.
export function plan(S, state, now = new Date()) {
  const P = paris(now); const last = Number(state.lastRun) || (now.getTime() - 10 * 60000); const out = [];
  const t = P.day, mk = t.slice(0, 7), dom = Number(t.slice(8)), ferie = FERIES.includes(t) || P.dow.startsWith('dim');
  const users = Object.values(S.users || {}).filter(active); const clubs = Object.keys(S.clubs || {});
  const at = (hm, min = 60) => { const [h, m] = hm.split(':').map(Number); const cur = P.h * 60 + Number(P.hm.slice(3)); return cur >= h * 60 + m && cur < h * 60 + m + min; };
  const add = (uid, rule, key, title, body, url, o = {}) => out.push({ uid, rule, key: `${key}|${uid}`, title, body, url, ttl: o.ttl || 4 * 3600, urgent: !!o.urgent });
  const team = club => users.filter(u => inClub(u, club)); const mgrs = club => team(club).filter(isMgr);
  const st = state.watch || {}; const next = { balances: {}, pal: { ...(st.pal || {}) }, rec: { ...(st.rec || {}) }, flash: { ...(st.flash || {}) } };
  // Événements (immédiat, regroupés par passage)
  for (const club of clubs) {
    const fresh = Object.values(S.resiliations || {}).filter(r => r && r.clubId === club && r.at > last && now - r.at < 864e5 && resOpen(r));
    if (fresh.length) {
      const targets = {}; fresh.forEach(r => { (r.ownerId ? [r.ownerId] : team(club).map(u => u.id)).forEach(id => { if (id !== r.userId && id !== r.by) (targets[id] = targets[id] || []).push(r); }); });
      Object.entries(targets).forEach(([id, L]) => { const n = L.length === 1 && L[0].effective ? daysTo(L[0].effective, t) : null; add(id, 'res_new', `resnew_${L.map(r => r.id).sort().join(',').slice(0, 60)}`, 'Résiliation reçue', L.length > 1 ? `${L.length} résiliations reçues. Prenez les dossiers.` : n != null ? `Un client veut partir. Effective dans ${Math.max(0, n)} jours. Prenez le dossier.` : 'Un client veut partir. Date effective inconnue. Prenez le dossier.', '#/resiliations'); });
    }
    // nouveaux impayés (solde qui passe de 0 à plus de 0)
    const prev = st.balances || null; const neu = [];
    Object.values(S.clients || {}).filter(c => c && c.clubId === club).forEach(c => { const b = Number(c.balance) > 0; next.balances[c.id] = b ? 1 : 0; if (b && prev && !prev[c.id]) neu.push(c); });
    if (neu.length) { const tot = Math.round(neu.reduce((s, c) => s + Number(c.balance), 0)); const by = {}; neu.forEach(c => { ((c.dunning || {}).ownerId ? [c.dunning.ownerId] : mgrs(club).map(u => u.id)).forEach(id => { by[id] = (by[id] || 0) + 1; }); }); Object.entries(by).forEach(([id, n]) => add(id, 'dun_new', `dunnew_${t}_${P.h}`, 'Nouvel impayé', `${n} nouveau${n > 1 ? 'x' : ''} dossier${n > 1 ? 's' : ''}, ${tot} € au total. À attribuer.`, '#/impayes')); }
    // défis : lancement et fin
    Object.values(S.challenges || {}).filter(ch => ch && ch.clubId === club).forEach(ch => {
      if (ch.start > last && ch.end > now.getTime()) { const h = Math.max(1, Math.round((ch.end - ch.start) / 3600000)); const k = ((S.kpis || {})[ch.kpiId] || {}).label || 'relances'; team(club).filter(u => u.id !== ch.by).forEach(u => add(u.id, 'defi', `defi_${ch.id}`, 'Défi flash lancé', `${String(ch.title || '').slice(0, 60)}, ${h} h sur ${k}. Classement en direct.`, '#/challenges', { ttl: 3600, urgent: h <= 12 })); }
      if (ch.end <= now.getTime() && ch.end > last && !next.flash[ch.id]) { next.flash[ch.id] = 1; team(club).forEach(u => add(u.id, 'defi', `defiend_${ch.id}`, 'Défi terminé', `${String(ch.title || '').slice(0, 60)} est terminé. Voir le classement.`, '#/challenges', { ttl: 12 * 3600 })); }
    });
    // paliers d'équipe : tout proche et atteint
    const pal = paliers(S, club, mk);
    Object.entries(pal).forEach(([k, tiers]) => { const T = (tiers || []).filter(x => Number(x.target) > 0).map(x => Number(x.target)).sort((a, b) => a - b); if (!T.length) return; const real = sum(S, e => e.clubId === club && e.kpiId === k && (e.date || '').slice(0, 7) === mk); const reached = T.filter(x => real >= x).length; const key = `${club}|${mk}|${k}`; const old = next.pal[key] || { reached: 0, near: [] };
      const label = ((S.kpis || {})[k] || {}).label || k;
      if (reached > old.reached) team(club).forEach(u => add(u.id, 'palier', `palhit_${key}_${reached}`, `Palier ${reached} atteint`, `${label} : ${Math.round(real)} pour l’équipe.${(tiers[reached - 1] || {}).reward ? ' ' + String(tiers[reached - 1].reward).slice(0, 60) : ''}`, '#/home'));
      const nxt = T[reached]; if (nxt && nxt - real <= Math.max(2, Math.ceil(nxt * 0.05)) && !(old.near || []).includes(reached)) { team(club).forEach(u => add(u.id, 'palier', `palnear_${key}_${reached + 1}`, `Palier ${reached + 1} tout proche`, `Plus que ${Math.ceil(nxt - real)} ${label.toLowerCase()} pour la prime d’équipe.`, '#/home')); old.near = [...(old.near || []), reached]; }
      next.pal[key] = { reached, near: old.near || [] }; });
    // chiffre à vérifier : saisie hors norme
    Object.values(S.entries || {}).filter(e => e && e.clubId === club && e.source === 'manual' && e.at > last && !e.adjust).forEach(e => {
      const hist = Object.values(S.entries).filter(x => x && x.userId === e.userId && x.kpiId === e.kpiId && x.source === 'manual' && x.id !== e.id).sort((a, b) => b.at - a.at).slice(0, 30).map(x => Number(x.value) || 0);
      const floor = e.kpiId === 'contrats' ? 3 : e.kpiId === 'avis' ? 10 : ((S.kpis || {})[e.kpiId] || {}).unit === 'eur' ? 300 : 5;
      if (hist.length >= 5 && Number(e.value) > 5 * Math.max(median(hist), 0.01) && Number(e.value) > floor) mgrs(club).forEach(u => add(u.id, 'anomalie', `anom_${e.id}`, 'Chiffre à vérifier', `Une saisie de ${((S.kpis || {})[e.kpiId] || {}).label || e.kpiId} sort de l’ordinaire. Contrôlez-la.`, '#/members'));
    });
  }
  // Resamania : le robot attend le code de connexion saisi dans l'appli → alerte urgente aux managers.
  const rsmEtat = (S.rsm || {}).etat || {};
  if (rsmEtat.step === 'code' && rsmEtat.at && now - rsmEtat.at < 15 * 60000) clubs.forEach(club => mgrs(club).forEach(u => add(u.id, 'rsm', `rsmcode_${Math.floor(rsmEtat.at / 60000)}`, 'Resamania : code demandé', 'Ouvrez Fit Pulse et saisissez le code reçu par e-mail pour lancer la mise à jour.', '#/kpimatin', { urgent: true, ttl: 900 })));
  // Records personnels du mois (un par KPI et par jour)
  for (const u of users) for (const k of Object.keys(S.kpis || {})) { if (!((S.kpis[k] || {}).points > 0)) continue;
    const cur = sum(S, e => e.userId === u.id && e.kpiId === k && (e.date || '').slice(0, 7) === mk); if (!cur) continue;
    const rk = `${u.id}|${k}`; let best = next.rec[rk]; if (best == null) { const by = {}; Object.values(S.entries || {}).forEach(e => { if (e && e.userId === u.id && e.kpiId === k && counts(S, e) && (e.date || '').slice(0, 7) < mk) { const m = e.date.slice(0, 7); by[m] = (by[m] || 0) + (Number(e.value) || 0); } }); best = Math.max(0, ...Object.values(by)); next.rec[rk] = best; }
    if (best > 0 && cur > best) { add(u.id, 'record', `rec_${k}_${t}`, 'Record battu', `Votre meilleur mois en ${(S.kpis[k].label || k).toLowerCase()} : ${Math.round(cur * 100) / 100}.`, '#/dashboard'); next.rec[rk] = cur; } }
  // Planifiées (heures de Paris, jours ouvrés ; férié = dimanche)
  if (!ferie) {
    if (at('07:45')) for (const u of users) { const res = Object.values(S.resiliations || {}).filter(r => r && resOpen(r) && r.ownerId === u.id).length; const dun = Object.values(S.clients || {}).filter(c => c && dunDue(c, t) && (c.dunning || {}).ownerId === u.id).length; add(u.id, 'am_digest', `am_${t}`, 'Votre journée', res + dun ? `${plurFr(res + dun, 'relance', 'relances')} à votre nom aujourd’hui. Ouvrez Fit Pulse pour commencer.` : 'Rien en retard. Bonne journée sur le terrain.', '#/home', { ttl: 6 * 3600 }); }
    if (at('09:30')) Object.values(S.resiliations || {}).forEach(r => { if (!r || !resOpen(r) || !r.effective) return; const n = daysTo(r.effective, t); if (![7, 3, 1].includes(n)) return; (r.ownerId ? [r.ownerId] : mgrs(r.clubId).map(u => u.id)).forEach(id => add(id, 'res_j7', `res7_${r.id}_${n}`, `Sauvetage à J-${n}`, 'Dernier délai pour appeler. Notez l’appel dans Fit Pulse.', '#/resiliations', { urgent: n === 1 })); });
    if (at('09:45')) Object.values(S.clients || {}).forEach(c => { const d = (c && c.dunning) || {}; if (d.status === 'promesse' && Number(c.balance) > 0 && !(d.promiseBase != null && Number(c.balance) <= Number(d.promiseBase) - Number(d.promiseAmount || 0) + 0.01) && (d.promiseDate || d.next) && (d.promiseDate || d.next) < t && d.ownerId) add(d.ownerId, 'dun_promise', `prom_${c.id}_${t}`, 'Promesse non tenue', 'Le paiement promis n’est pas arrivé. Relancez aujourd’hui.', '#/relances'); });
    if (at('10:00')) for (const u of users) { const cl = Object.values(S.clients || {}).filter(c => c && inClub(u, c.clubId) && !/ancien|perdu|prospect/i.test(c.status || '')); const n = { r: cl.filter(c => dunDue(c, t) && (c.dunning || {}).ownerId === u.id).length + Object.values(S.resiliations || {}).filter(r => r && resOpen(r) && r.ownerId === u.id).length, b: cl.filter(c => c.birth && c.birth.slice(-5) === t.slice(5)).length, e: cl.filter(c => c.end === addDays(t, 7)).length, j: cl.filter(c => c.start === addDays(t, -15)).length };
      const parts = [n.r && plurFr(n.r, 'relance', 'relances'), n.b && plurFr(n.b, 'anniversaire', 'anniversaires'), n.e && `${plurFr(n.e, 'fin de contrat', 'fins de contrat')} à J-7`, n.j && `${plurFr(n.j, 'appel J+15', 'appels J+15')}`].filter(Boolean);
      if (parts.length) add(u.id, 'relances_jour', `jour_${t}`, 'Appels du jour', `${parts.join(', ')}. Ouvrez Mes relances.`, '#/relances'); }
    if (at('10:15')) clubs.forEach(club => { const L = Object.values(S.resiliations || {}).filter(r => r && r.clubId === club && (r.status || 'nouvelle') === 'nouvelle' && !r.ownerId && r.at < now - 864e5); if (L.length) mgrs(club).forEach(u => add(u.id, 'res_noowner', `noown_${t}`, 'Dossier sans responsable', `${plurFr(L.length, 'résiliation attend', 'résiliations attendent')} depuis 24 h. Attribuez-les.`, '#/resiliations')); });
    if (at('13:30') && (P.dow.startsWith('mar') || P.dow.startsWith('jeu')) && dom >= 7 && dom <= 26) { const days = new Date(Date.UTC(Number(mk.slice(0, 4)), Number(mk.slice(5)), 0)).getUTCDate(); const exp = dom / days;
      for (const u of users.filter(x => !isMgr(x) || x.role === 'manager')) { const tg = ((S.targets || {})[mk] || {})[u.id] || {}; let worst = null; Object.entries(tg).forEach(([k, target]) => { if (!(Number(target) > 0) || !((S.kpis || {})[k] || {}).required) return; const real = sum(S, e => e.userId === u.id && e.kpiId === k && (e.date || '').slice(0, 7) === mk); const ratio = real / target / exp; if (ratio < 0.75 && (!worst || ratio < worst.ratio)) worst = { k, real, target: Number(target), ratio }; });
        if (worst) { const per = (worst.target - worst.real) / Math.max(1, days - dom + 1); const K = S.kpis[worst.k]; add(u.id, 'obj_late', `late_${t}`, `${K.label} en retard`, `${Math.round(worst.real)} sur ${worst.target}. ${K.unit === 'eur' ? Math.ceil(per) + ' €' : Math.ceil(per)} par jour pour finir à l’objectif.`, '#/dashboard'); } } }
    const routine = club => ((S.rsm || {}).routine || {})[club] || {};
    if ((at('11:00') || at('16:00')) && P.dow.startsWith('lun')) { const mon = parisMidnight(t); clubs.forEach(club => { const ok = WEEK.filter(id => (routine(club)[id] || 0) >= mon).length; if (ok < WEEK.length) mgrs(club).forEach(u => add(u.id, 'rsm', `rsmw_${t}_${P.h}`, 'Imports du lundi', `${ok} sur ${WEEK.length} exports faits. Relances et impayés à jour après import.`, '#/imports')); }); }
    if (at('10:00') && dom === 2) clubs.forEach(club => { const m0 = parisMidnight(mk + '-01'); const ok = MONTH.filter(id => (routine(club)[id] || 0) >= m0).length; if (ok < MONTH.length) mgrs(club).forEach(u => add(u.id, 'rsm', `rsmm_${mk}`, 'Imports du mois', 'Exports du mois écoulé à déposer pour le récapitulatif.', '#/imports')); });
    if (at('16:00') && !P.dow.startsWith('sam')) clubs.forEach(club => { const silent = team(club).filter(u => u.role === 'membre').filter(u => { const lm = Object.values(S.entries || {}).filter(e => e && e.userId === u.id && e.source === 'manual').reduce((m, e) => (e.date > m ? e.date : m), ''); return !lm || lm < addDays(t, -2); }); silent.forEach(s => mgrs(club).forEach(m => add(m.id, 'mgr_silent', `silent_${s.id}_${t}`, 'Commercial sans saisie', `${s.first || 'Un commercial'} n’a rien saisi depuis 2 jours ou plus.`, '#/team'))); });
    if (at('19:30')) for (const u of users.filter(x => x.role === 'membre')) { const n = Object.values(S.entries || {}).filter(e => e && e.userId === u.id && e.source === 'manual' && e.date === t).length; const club = (u.clubs || [])[0]; const c = sum(S, e => e.clubId === club && e.kpiId === 'contrats' && e.date === t); add(u.id, 'pm_digest', `pm_${t}`, 'Bilan du jour', `${plurFr(n, 'saisie', 'saisies')} aujourd’hui. Équipe : ${plurFr(Math.round(c), 'contrat', 'contrats')}.`, '#/home', { ttl: 12 * 3600 }); }
    if (P.dow.startsWith('lun') && at('09:00', 180)) users.forEach(u => add(u.id, 'digest', `digest_${t}`, 'Bilan de la semaine', 'Votre bilan de la semaine est prêt sur l’accueil.', '#/home', { ttl: 12 * 3600 }));
    // Rappel du soir : lancer la mise à jour Resamania et garder le code à portée (urgent : passe l'heure calme).
    if (at('21:30')) clubs.forEach(club => mgrs(club).forEach(u => add(u.id, 'rsm', `rsmsoir_${t}`, 'Mise à jour Resamania', 'C’est l’heure : lancez la mise à jour du soir dans KPI du matin et gardez le code Resamania à portée.', '#/kpimatin', { urgent: true, ttl: 2 * 3600 })));
  }
  // Pause décidée par le manager : la boîte de réception seulement.
  const paused = club => !!((S.clubs || {})[club] || {}).notifPaused;
  const items = out.filter(x => ruleOn(S, x.uid, x.rule)).map(x => { const u = (S.users || {})[x.uid] || {}; return { ...x, push: !(u.clubs || []).every(paused) && (x.urgent || !quiet(S, x.uid, P)) }; });
  return { P, items, watch: next };
}
// Passage complet : clés, plan, boîte de réception, envois, journal, statistiques.
export async function passagePush(api, tk, S, mail = null) {
  const state = (await (await api(tk, 'fitpulse_secret.json')).json()) || {};
  let vapid = state.vapid;
  if (!vapid) { vapid = newVapid(); await api(tk, 'fitpulse_secret/vapid.json', { method: 'PUT', body: JSON.stringify(vapid) }); }
  if (!S.serveur || S.serveur.vapidPublic !== vapid.publicKey) await api(tk, 'pulse/serveur/vapidPublic.json', { method: 'PUT', body: JSON.stringify(vapid.publicKey) });
  const subs = (await (await api(tk, 'pulse_push.json')).json()) || {};
  const log = state.log || {}; const { P, items: all, watch } = plan(S, state);
  // Premier passage : on mémorise l'état (paliers, records, soldes) sans envoyer de rafale.
  const items = state.watch ? all : all.filter(x => !['palier', 'record', 'dun_new'].includes(x.rule));
  let sent = 0; const dead = []; const perDay = {}; const inbox = {}; const stats = {};
  Object.entries(log).forEach(([k, v]) => { const uid = k.split('|').pop(); if (v && v.day === P.day && v.push) perDay[uid] = (perDay[uid] || 0) + 1; });
  for (const it of items) {
    const lk = it.key.replace(/[.#$/[\]]/g, ','); if (log[lk]) continue;
    const id = crypto.createHash('sha1').update(lk).digest('hex').slice(0, 20);
    inbox[`${it.uid}/${id}`] = { title: it.title, body: it.body, url: it.url, kind: it.rule, at: Date.now() };
    stats[it.rule] = (stats[it.rule] || 0) + 1;
    const devices = Object.entries(subs[it.uid] || {}); const canPush = it.push && devices.length && (it.urgent || (perDay[it.uid] || 0) < maxOf(S, it.uid));
    log[lk] = { day: P.day, at: Date.now(), push: !!canPush };
    if (!canPush) continue; perDay[it.uid] = (perDay[it.uid] || 0) + 1;
    for (const [h, sub] of devices) {
      try { const st = await sendPush(sub, { title: it.title, body: it.body, url: it.url, tag: it.key.split('|')[0] }, vapid, { ttl: it.ttl }); if (st === 404 || st === 410) dead.push(`${it.uid}/${h}`); else if (st < 300) sent++; else console.log(`push ${st}`); }
      catch (e) { console.log('push échec :', e.message); }
    }
  }
  // Boîte de réception côté serveur (lue par l'appli, 30 jours), statistiques du mois par règle.
  if (Object.keys(inbox).length) await api(tk, 'pulse_inbox.json', { method: 'PATCH', body: JSON.stringify(inbox) });
  const mk = P.day.slice(0, 7); const old = ((S.serveur || {}).stats || {})[mk] || {};
  if (Object.keys(stats).length) { const up = {}; Object.entries(stats).forEach(([r, n]) => { up[r] = (Number(old[r]) || 0) + n; }); await api(tk, `pulse/serveur/stats/${mk}.json`, { method: 'PATCH', body: JSON.stringify(up) }); }
  // E-mails : bilan du soir des managers (19 h 30) et semaine écoulée (lundi 8 h 15).
  if (mail) await mailsBilan(S, P, log, mail).catch(e => console.log('e-mail bilan :', e.message));
  const cut = Date.now() - 8 * 864e5; Object.keys(log).forEach(k => { if (!log[k] || log[k].at < cut) delete log[k]; });
  await api(tk, 'fitpulse_secret/log.json', { method: 'PUT', body: JSON.stringify(log) });
  await api(tk, 'fitpulse_secret/watch.json', { method: 'PUT', body: JSON.stringify(watch) });
  await api(tk, 'fitpulse_secret/lastRun.json', { method: 'PUT', body: JSON.stringify(Date.now()) });
  for (const d of dead) await api(tk, `pulse_push/${d}.json`, { method: 'DELETE' });
  // purge de la boîte de réception (30 jours), une fois par jour
  if (P.h === 3) { const ib = (await (await api(tk, 'pulse_inbox.json?shallow=false')).json()) || {}; const lim = Date.now() - 30 * 864e5; const del = {}; Object.entries(ib).forEach(([u, L]) => Object.entries(L || {}).forEach(([k, v]) => { if (!v || v.at < lim) del[`${u}/${k}`] = null; })); if (Object.keys(del).length) await api(tk, 'pulse_inbox.json', { method: 'PATCH', body: JSON.stringify(del) }); }
  return { sent, planned: items.length, inbox: Object.keys(inbox).length, dead: dead.length, devices: Object.values(subs).reduce((s, x) => s + Object.keys(x || {}).length, 0) };
}
async function mailsBilan(S, P, log, mail) {
  const users = Object.values(S.users || {}).filter(u => active(u) && u.email); const t = P.day; const ferie = FERIES.includes(t) || P.dow.startsWith('dim');
  const once = async (key, fn) => { if (log[key]) return; log[key] = { day: t, at: Date.now() }; await fn(); };
  const hm = P.h * 60 + Number(P.hm.slice(3));
  if (!ferie && !P.dow.startsWith('dim') && hm >= 19 * 60 + 30 && hm < 20 * 60 + 30) for (const u of users.filter(isMgr)) await once(`mailpm|${u.id}|${t}`, async () => {
    const lines = (u.clubs || Object.keys(S.clubs || {})).map(club => { const c = sum(S, e => e.clubId === club && e.kpiId === 'contrats' && e.date === t); const n = Object.values(S.entries || {}).filter(e => e && e.clubId === club && e.source === 'manual' && e.date === t).length; const res = Object.values(S.resiliations || {}).filter(r => r && r.clubId === club && resOpen(r)).length; return `${((S.clubs || {})[club] || {}).name || club} : ${plurFr(Math.round(c), 'contrat', 'contrats')} aujourd’hui, ${plurFr(n, 'saisie', 'saisies')}, ${plurFr(res, 'résiliation ouverte', 'résiliations ouvertes')}.`; });
    await mail(u.email, `Bilan du jour Fit Pulse, ${t.split('-').reverse().join('/')}`, [`Bonjour ${u.first || ''},`, '', ...lines, '', 'Détails dans Fit Pulse.'].join('\n'));
  });
  if (P.dow.startsWith('lun') && hm >= 8 * 60 + 15 && hm < 9 * 60 + 15) for (const u of users.filter(x => prefsOf(S, x.id).digest !== false)) await once(`mailwk|${u.id}|${t}`, async () => {
    const from = addDays(t, -7), to = addDays(t, -1), pf = addDays(t, -14), pt = addDays(t, -8);
    const mine = (a, b) => sum(S, e => e.userId === u.id && e.kpiId === 'contrats' && e.date >= a && e.date <= b);
    const club = (u.clubs || [])[0]; const cl = (a, b) => sum(S, e => e.clubId === club && e.kpiId === 'contrats' && e.date >= a && e.date <= b);
    await mail(u.email, 'Votre semaine Fit Pulse', [`Bonjour ${u.first || ''},`, '', `Vos contrats : ${Math.round(mine(from, to))} (semaine d’avant : ${Math.round(mine(pf, pt))}).`, `Le club : ${Math.round(cl(from, to))} contrats (semaine d’avant : ${Math.round(cl(pf, pt))}).`, '', 'Votre bilan complet est sur l’accueil de Fit Pulse.'].join('\n'));
  });
}
