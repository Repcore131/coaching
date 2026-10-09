/**
 * Fit Pulse : relève horaire des demandes de résiliation de la boîte accueil.
 * Lecture seule : aucun libellé posé, aucun message modifié ou envoyé.
 * Le corps des e-mails reste dans Gmail ; seuls les champs extraits partent.
 */
const CFG = {
  ENDPOINT: 'https://europe-west1-VOTRE-PROJET.cloudfunctions.net/ingestResiliations',
  CLUB_ID: 'niort',
  QUERIES: [
    'label:fp-resiliations newer_than:45d',
    '(résiliation OR résilier OR resiliation OR resilier OR "mettre fin" OR préavis) -from:me newer_than:3d -category:promotions -category:social'
  ],
  MAX_THREADS: 150,
  MIN_SCORE: 3,
  SEND_EXCERPT: false,
  OWN_ADDRESSES: [],
  NOTIF_SENDERS: [/resamania/i, /stadline/i, /no-?reply@.*fitness/i],
  IGNORE_SENDERS: [/github/i, /paypal/i, /@google\.com$/i, /newsletter/i]
};
const RULES = [
  { re: /resili/, w: 3, tag: 'mot resiliation' },
  { re: /mettre fin|annuler mon abonnement|arreter mon abonnement|stopper mon abonnement|ne plus etre preleve|arret des prelevements/, w: 3, tag: 'formule de fin' },
  { re: /preavis|date de fin|fin de (mon )?contrat|lettre recommandee/, w: 1, tag: 'vocabulaire contrat' },
  { re: /demenag|mutation|quitte la region/, w: 1, tag: 'demenagement' },
  { re: /suspen(dre|sion)|mettre en pause|geler mon/, w: 1, tag: 'suspension' },
  { re: /abonnement|adherent|salle|fitness/, w: 1, tag: 'contexte salle' },
  { re: /newsletter|se desabonner|unsubscribe|offre speciale/, w: -3, tag: 'publicite' },
  { re: /\bcv\b|candidature|stage/, w: -2, tag: 'recrutement' }
];
const MOTIFS = [
  ['Déménagement', /demenag|mutation|quitte la region|nouvelle ville/],
  ['Santé', /sante|blessure|operation|medecin|enceinte|grossesse|maladie/],
  ['Prix', /prix|cher|budget|financ|moyens|augmentation/],
  ['Manque de temps', /temps|horaire|travail|planning|disponib/],
  ['Concurrence', /autre salle|concurren|basic ?fit|keep ?cool|l'orange bleue|on air/],
  ['Insatisfaction', /insatisf|decu|sale|trop de monde|machines|accueil|propre/]
];
const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8,
  septembre: 9, octobre: 10, novembre: 11, decembre: 12 };

/** À lancer une fois : crée le déclencheur horaire puis fait une première relève. */
function installer() {
  if (!PropertiesService.getScriptProperties().getProperty('FP_SECRET')) {
    throw new Error('Ajoutez la propriété FP_SECRET dans Paramètres du projet > Propriétés du script.');
  }
  ScriptApp.getProjectTriggers()
    .filter(function (t) { return t.getHandlerFunction() === 'releve'; })
    .forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('releve').timeBased().everyHours(1).create();
  releve();
}

/** Aperçu sans envoi : affiche dans le journal ce qui serait transmis. */
function apercu() {
  const res = collecte_();
  console.log(JSON.stringify(res, null, 2));
}

/** Relève appelée toutes les heures par le déclencheur. */
function releve() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  try {
    envoie_(collecte_());
  } catch (e) {
    envoie_({ clubId: CFG.CLUB_ID, runAt: new Date().toISOString(), version: 1, scanned: 0, threads: [],
      error: String(e).slice(0, 300) });
    throw e;
  } finally {
    lock.releaseLock();
  }
}

/** Adresse de la boîte : lue par Gmail (portée gmail.readonly, sans portée supplémentaire). */
function boite_() {
  return String(Gmail.Users.getProfile('me').emailAddress || '').toLowerCase();
}

function collecte_() {
  const me = boite_();
  const ids = {};
  CFG.QUERIES.forEach(function (q) { listeFils_(q).forEach(function (id) { ids[id] = true; }); });
  const threads = [];
  Object.keys(ids).slice(0, CFG.MAX_THREADS).forEach(function (id) {
    try {
      const t = analyseFil_(id, me);
      if (t) threads.push(t);
    } catch (e) {
      console.warn('Fil ' + id + ' ignoré : ' + e);
    }
  });
  return { clubId: CFG.CLUB_ID, mailbox: me, runAt: new Date().toISOString(), version: 1, scanned:
    Object.keys(ids).length, threads: threads };
}

function listeFils_(q) {
  const ids = [];
  let pageToken = null;
  do {
    const opts = { q: q, maxResults: 100 };
    if (pageToken) opts.pageToken = pageToken;
    const r = Gmail.Users.Threads.list('me', opts);
    (r.threads || []).forEach(function (t) { ids.push(t.id); });
    pageToken = r.nextPageToken;
  } while (pageToken && ids.length < CFG.MAX_THREADS);
  return ids;
}

function analyseFil_(id, me) {
  const th = Gmail.Users.Threads.get('me', id, { format: 'full' });
  const msgs = (th.messages || []).slice().sort(function (a, b) { return Number(a.internalDate) -
    Number(b.internalDate); });
  const items = msgs.map(function (m) {
    const h = entetes_(m);
    const from = adresse_(h['from'] || '');
    const sortant = (m.labelIds || []).indexOf('SENT') >= 0 || from.email === me ||
      CFG.OWN_ADDRESSES.indexOf(from.email) >= 0;
    return { at: Number(m.internalDate), out: sortant, from: from, subject: h['subject'] || '', pub:
      !!h['list-unsubscribe'], body: coupeCitation_(texte_(m.payload)) };
  });
  const entrants = items.filter(function (x) { return !x.out; });
  if (!entrants.length) return null;
  const first = entrants[0];
  if (first.pub || CFG.IGNORE_SENDERS.some(function (r) { return r.test(first.from.email); })) return null;
  const brut = entrants.map(function (x) { return x.subject + '\n' + x.body; }).join('\n');
  const txt = norm_(brut);
  const cls = classe_(first, txt);
  if (cls.score < CFG.MIN_SCORE) return null;
  const reponses = items.filter(function (x) { return x.out && x.at > first.at; });
  const lastIn = entrants[entrants.length - 1];
  const lastOut = reponses.length ? reponses[reponses.length - 1] : null;
  return {
    threadId: id,
    link: 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(me) + '#all/' + id,
    subject: first.subject.slice(0, 140),
    kind: cls.kind,
    type: cls.type,
    score: cls.score,
    signals: cls.signals.slice(0, 10),
    fromName: first.from.name.slice(0, 60),
    fromEmail: cls.kind === 'adherent' ? first.from.email : emailDansTexte_(brut, me),
    name: nom_(first, brut, cls.kind),
    clientNum: numero_(txt),
    phone: telephone_(brut),
    motif: motif_(txt),
    effective: dateEffet_(txt),
    requestedAt: first.at,
    firstInAt: first.at,
    lastInAt: lastIn.at,
    inCount: entrants.length,
    firstReplyAt: reponses.length ? reponses[0].at : null,
    lastOutAt: lastOut ? lastOut.at : null,
    outCount: reponses.length,
    awaitingReply: !lastOut || lastIn.at > lastOut.at,
    excerpt: CFG.SEND_EXCERPT ? first.body.replace(/\s+/g, ' ').slice(0, 280) : null
  };
}

function classe_(first, txt) {
  let score = 0;
  const signals = [];
  RULES.forEach(function (r) { if (r.re.test(txt)) { score += r.w; signals.push(r.tag); } });
  const notif = CFG.NOTIF_SENDERS.some(function (r) { return r.test(first.from.email); });
  if (notif && /resili|cancel/.test(txt)) { score += 3; signals.push('notification logiciel'); }
  if (notif && /appli|application|en ligne|espace (membre|adherent)/.test(txt)) signals.push('appli');
  const kind = notif ? 'notification' : /formulaire|via le site|message de contact/.test(txt) ?
    'formulaire' : 'adherent';
  const resil = /resili|mettre fin|annuler mon abonnement|arreter mon abonnement/.test(txt);
  const type = !resil && /suspen|mettre en pause/.test(txt) ? 'suspension' : 'resiliation';
  return { score: score, kind: kind, type: type, signals: signals };
}

function entetes_(m) {
  const o = {};
  ((m.payload && m.payload.headers) || []).forEach(function (h) { o[h.name.toLowerCase()] = h.value; });
  return o;
}

function adresse_(s) {
  const m = s.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() };
  return { name: '', email: s.trim().toLowerCase() };
}

function texte_(p) {
  const plain = partie_(p, 'text/plain');
  if (plain) return plain;
  return partie_(p, 'text/html')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

function partie_(p, type) {
  if (!p) return '';
  if (p.mimeType === type && p.body && p.body.data) {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(p.body.data)).getDataAsString('UTF-8');
  }
  const parts = p.parts || [];
  for (let i = 0; i < parts.length; i++) {
    const r = partie_(parts[i], type);
    if (r) return r;
  }
  return '';
}

function coupeCitation_(s) {
  const m = s.search(/^(Le .{5,80} a écrit|On .{5,80} wrote|-{2,} ?Original|De ?: .+@)/m);
  return m > 0 ? s.slice(0, m) : s;
}

function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function numero_(txt) {
  const m = txt.match(/(?:n(?:°|o|um(?:ero)?)\.?\s*(?:de\s+)?(?:client|adherent|membre|contrat|badge)|(?:client|adherent|membre|contrat)\s*(?:n°|no|numero|id))\s*[:#]?\s*([a-z0-9]{4,12})/);
  return m ? m[1].toUpperCase() : null;
}

function telephone_(s) {
  const m = s.match(/(?:\+33\s?|0)[1-9](?:[\s.]?\d{2}){4}/);
  if (!m) return null;
  const d = m[0].replace(/\D/g, '').replace(/^33/, '0');
  return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : null;
}

function emailDansTexte_(s, me) {
  const all = s.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  const ok = all.map(function (x) { return x.toLowerCase(); }).filter(function (x) {
    return x !== me && !CFG.NOTIF_SENDERS.some(function (r) { return r.test(x); });
  });
  return ok[0] || null;
}

function nom_(first, brut, kind) {
  if (kind !== 'adherent') {
    const n = brut.match(/\bnom\s*:\s*([^\n\r]{2,40})/i);
    const p = brut.match(/\bpr[ée]nom\s*:\s*([^\n\r]{2,40})/i);
    if (n) return ((p ? p[1].trim() + ' ' : '') + n[1].trim()).slice(0, 60);
  }
  const dn = first.from.name;
  if (dn && dn.indexOf('@') < 0 && /\s/.test(dn.trim())) return dn.trim().slice(0, 60);
  const lignes = first.body.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lignes.length - 1; i >= Math.max(0, lignes.length - 6); i--) {
    if (/^[A-ZÀ-Ý][a-zà-ÿ'-]+(\s+[A-ZÀ-Ý][A-Za-zà-ÿ'-]+){1,2}$/.test(lignes[i])) return lignes[i];
  }
  return dn ? dn.trim().slice(0, 60) : null;
}

function motif_(txt) {
  for (let i = 0; i < MOTIFS.length; i++) if (MOTIFS[i][1].test(txt)) return MOTIFS[i][0];
  return null;
}

function dateEffet_(txt) {
  const re = /(?:a compter du|a partir du|au plus tard le|date (?:de fin|d'effet)\s*:?|fin (?:le|au)|resilier (?:au|le))\s*(\d{1,2})(?:er)?[\/. ](\d{1,2}|[a-z]+)(?:[\/. ](\d{2,4}))?/;
  const m = txt.match(re);
  if (!m) return null;
  const j = Number(m[1]);
  const mo = /^\d+$/.test(m[2]) ? Number(m[2]) : MOIS[m[2]];
  if (!mo || j < 1 || j > 31 || mo > 12) return null;
  const now = new Date();
  let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : now.getFullYear();
  if (!m[3] && new Date(y, mo - 1, j) < now) y++;
  const d = new Date(y, mo - 1, j);
  if (d.getMonth() !== mo - 1) return null;
  return Utilities.formatDate(d, 'Europe/Paris', 'yyyy-MM-dd');
}

function envoie_(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty('FP_SECRET');
  if (!secret) throw new Error('FP_SECRET absent');
  const body = JSON.stringify(payload);
  const ts = String(Date.now());
  const sig = Utilities.computeHmacSha256Signature(ts + '.' + body, secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  const res = UrlFetchApp.fetch(CFG.ENDPOINT, {
    method: 'post',
    contentType: 'application/json; charset=utf-8',
    payload: body,
    headers: { 'X-FP-Club': CFG.CLUB_ID, 'X-FP-Time': ts, 'X-FP-Signature': sig },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error('Fit Pulse a répondu ' + res.getResponseCode() + ' : ' +
      res.getContentText().slice(0, 200));
  }
}
