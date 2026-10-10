// ══ LES CONTACTS E-MAIL DE L'APP, SYNCHRONISÉS AVEC BREVO (11/10/2026) ═══
//
// TOUT CE QUI PARLE À BREVO PASSE PAR ICI, et nulle part ailleurs : changer
// d'outil ne demanderait que de remplacer ce module. (Systeme.io reste celui
// de la PROSPECTION de Kevin, hors de l'app : plan gratuit limité à 2 000
// contacts.)
// ⚠ C'EST LE SERVEUR QUI DÉCLENCHE CHAQUE E-MAIL (11/10/2026), par l'API
//   d'envoi de Brevo (envoyerModele : un modèle Brevo + ses paramètres).
//   Brevo achemine (délivrabilité, quota gratuit de 300 par jour) ; le
//   serveur décide QUAND et À QUI, sans automatisation à régler dans Brevo.
//   L'app, elle, n'appelle aucun service d'e-mail (un test l'interdit) :
//   elle ne fait que cocher une case.
//
// LES E-MAILS (un modèle Brevo chacun, identifiants dans wrangler.toml) :
//   · BIENVENUE : une fois, après la case cochée à l'inscription ;
//   · AVIS DE RENOUVELLEMENT (L215-1) : à tout abonné annuel, avant chaque
//     échéance — information contractuelle, envoyée même sans accord e-mail ;
//   · FIN D'ESSAI (J-3) et RECONQUÊTE (J+30) : seulement avec l'accord e-mail.
// Chaque e-mail de conseil porte un LIEN DE DÉSINSCRIPTION signé (HMAC) :
// /desinscription retire l'accord dans le dossier, note desinscrits/<clé> et
// bloque l'adresse chez Brevo.
//
// D'OÙ VIENNENT LES CONTACTS (liste BREVO_LISTE, « RepCore » par défaut)
//   · l'INSCRIPTION, case « Reçois mes conseils et les nouveautés par e-mail »
//     (décochée par défaut) : l'app écrit users/<clé>/consentements/email et
//     un drapeau email_optin/<clé>. Le travail de la minute relit le
//     consentement dans le dossier (le drapeau seul ne suffit pas) et met le
//     contact en file. Sans consentement : RIEN ;
//   · le formulaire du GUIDE sur la page d'accueil (POST /lead) : prénom +
//     e-mail + accord, champ piège, 5 envois par jour et par adresse IP (l'IP
//     n'est jamais gardée : un hachage salé du jour) ;
//   · le PREMIER PAIEMENT d'un compte qui a consenti : STATUT passe à « payant ».
//
// LA FILE (email_file/<id>) : une opération par entrée, traitée chaque minute.
//   · 30 REQUÊTES PAR MINUTE au plus vers Brevo (compteur gardé d'une
//     exécution à l'autre dans la même minute), jamais plus que le budget de
//     l'exécution ;
//   · erreur 5xx, réseau ou 429 : l'opération repart plus tard (1, 2, 4… 60
//     minutes ; un 429 suspend toute la file le temps que Brevo indique), et
//     au 8e échec elle passe dans email_echecs ;
//   · erreur 4xx : définitive, rangée dans email_echecs avec son code. Un 400
//     sur les attributs (pas encore créés dans Brevo) ne bloque pas : le
//     contact est créé sans eux, et l'échec est noté.
//
// LA SUPPRESSION DE COMPTE (/fn/email, action « supprimer ») met en file la
// suppression du contact (DELETE), consentement ou non (il a pu venir du
// guide), et retire toute création encore en file.
//
// SECRET : BREVO_API_KEY. VARIABLES (facultatives) : BREVO_LISTE (nom de la
// liste des contacts, « RepCore »), BREVO_MODELE_BIENVENUE,
// BREVO_MODELE_RENOUVELLEMENT, BREVO_MODELE_FIN_ESSAI, BREVO_MODELE_RECONQUETE
// (identifiants des modèles Brevo, dans wrangler.toml),
// BREVO_ATTR_PRENOM (« PRENOM », l'attribut d'un compte Brevo en français),
// LEAD_OUVERT=oui (ouvre le formulaire du guide).

const BREVO = 'https://api.brevo.com/v3';
export const EMAIL_PAR_MINUTE = 30;
export const EMAIL_ESSAIS_MAX = 8;
export const LEAD_PAR_IP_JOUR = 5;
const LOT = 20;
const RE_EMAIL = /^[^@\s,]{1,64}@[^@\s,]{1,190}\.[^@\s,]{2,24}$/;
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const net = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n || 60);
const srcNet = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'direct';

/** PURE. Le délai avant le n-ième nouvel essai (ms) : 1, 2, 4… 60 minutes. */
export function delaiEssai(n) { return Math.min(60, 2 ** Math.max(0, Number(n) - 1)) * 60e3; }
/** PURE. Une réponse est-elle à retenter ? (réseau = statut 0, 429, 5xx) */
export function aRetenter(statut) { return statut === 0 || statut === 429 || statut >= 500; }
/** PURE. Un e-mail acceptable. */
export function emailValide(e) { return RE_EMAIL.test(String(e || '').trim()); }
/** PURE. Le statut d'un dossier pour Brevo. */
export function statutContact(u) {
  const x = u || {};
  if (x.status === 'AUTONOMIE_PREMIUM' || x.status === 'COACHING_SUIVI') return 'payant';
  return 'essai';
}

// UN APPEL À BREVO, compté. Rend {statut, corps, attente} ; 0 = réseau.
class Arret extends Error { constructor(statut, etape, attente, detail) { super('Brevo ' + etape + ' ' + statut); this.statut = statut; this.etape = etape; this.attente = attente || 0; this.detail = detail || null; } }
function client(env, fetchImpl, compteur) {
  const F = fetchImpl || fetch;
  const cle = String(env.BREVO_API_KEY || '').trim();
  return async (methode, chemin, corps) => {
    if (compteur) compteur.n++;
    let r;
    try {
      r = await F(BREVO + chemin, { method: methode,
        headers: Object.assign({ 'api-key': cle, accept: 'application/json' }, corps ? { 'content-type': 'application/json' } : {}),
        body: corps ? JSON.stringify(corps) : undefined });
    } catch (e) { return { statut: 0, corps: null, attente: 0 }; }
    let j = null;
    if (r.status !== 204) { try { j = await r.json(); } catch (e) { j = null; } }
    const h = (k) => (r.headers && typeof r.headers.get === 'function' ? Number(r.headers.get(k)) : 0) || 0;
    return { statut: r.status, corps: j, attente: h('Retry-After') || h('x-sib-ratelimit-reset') };
  };
}
// Le message d'erreur de Brevo (code + texte, tronqués) : il ne contient jamais la clé.
const detailDe = (c) => (c && typeof c === 'object' ? String((c.code || '') + ' ' + (c.message || '')).trim().slice(0, 160) : null);
const exiger = (r, etape, ok) => { if (!(ok || [200, 201, 204]).includes(r.statut)) throw new Arret(r.statut, etape, r.attente, detailDe(r.corps)); return r.corps; };

// CRÉER OU METTRE À JOUR un contact (un seul appel, updateEnabled). Un 400 sur
// des attributs inconnus de Brevo : on réessaie avec le seul prénom, puis sans
// rien. Rend la note 'ok' ou 'attributs_refuses'.
async function upsert(api, env, { email, prenom, attributs, listIds }) {
  const pr = String(env.BREVO_ATTR_PRENOM || 'PRENOM').trim();
  const base = prenom ? { [pr]: String(prenom) } : {};
  const essais = [Object.assign({}, base, attributs || {}), base, {}];
  let note = 'ok';
  for (let i = 0; i < essais.length; i++) {
    if (i > 0 && JSON.stringify(essais[i]) === JSON.stringify(essais[i - 1])) continue;
    const r = await api('POST', '/contacts', Object.assign({ email, updateEnabled: true, attributes: essais[i] }, listIds && listIds.length ? { listIds } : {}));
    if (r.statut === 400 && i < essais.length - 1 && Object.keys(essais[i]).length) { note = 'attributs_refuses'; continue; }
    exiger(r, 'contact');
    return note;
  }
  return note;
}

const WORKER = (env) => String(env.WORKER_URL || 'https://repcore-serveur.repcore.workers.dev').trim();
// LA SIGNATURE DU LIEN DE DÉSINSCRIPTION : HMAC-SHA256 de l'adresse, avec un
// secret du serveur. Personne ne peut désinscrire l'adresse d'un autre.
async function signer(env, email) {
  const secret = String(env.ADMIN_SECRET || env.BREVO_API_KEY || '').trim();
  if (!secret) return '';
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode('desinscription|' + secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(String(email || '').trim().toLowerCase())));
  return btoa(String.fromCharCode(...sig.slice(0, 18))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Le lien de désinscription d'une adresse (signé). */
export async function lienDesinscription(env, email) {
  const e = String(email || '').trim().toLowerCase();
  return WORKER(env) + '/desinscription?e=' + encodeURIComponent(e) + '&s=' + (await signer(env, e));
}
/** La signature d'un lien est-elle juste ? (comparaison à temps constant) */
export async function signatureDesinscription(env, email, sig) {
  const attendu = await signer(env, email);
  const donne = String(sig || '');
  if (!attendu || attendu.length !== donne.length) return false;
  let d = 0; for (let i = 0; i < attendu.length; i++) d |= attendu.charCodeAt(i) ^ donne.charCodeAt(i);
  return d === 0;
}

/**
 * ENVOYER UN E-MAIL : un modèle Brevo (identifiant numérique) et ses
 * paramètres ({{ params.X }} dans le modèle). Rend 'envoye', 'non_configure'
 * (pas de clé ou pas de modèle), 'sans_email', ou lève.
 * @param {any} env
 * @param {Function} fetchImpl
 * @param {{email:string, prenom?:string, modele?:string|number, params?:Object}} o
 */
export async function envoyerModele(env, fetchImpl, { email, prenom, modele, params }) {
  const id = String(modele || '').trim();
  if (!String(env.BREVO_API_KEY || '').trim() || !/^\d+$/.test(id)) return 'non_configure';
  if (!emailValide(email)) return 'sans_email';
  const api = client(env, fetchImpl);
  const to = [Object.assign({ email: String(email).trim() }, prenom ? { name: String(prenom).slice(0, 40) } : {})];
  exiger(await api('POST', '/smtp/email', { to, templateId: Number(id), params: Object.assign({ PRENOM: prenom || 'à toi' }, params || {}) }), 'envoi', [200, 201, 202]);
  return 'envoye';
}

/**
 * UN E-MAIL SANS MODÈLE (le rapport du lundi à Kevin) : sujet et HTML fournis.
 * Expéditeur : BREVO_EXPEDITEUR_ID (1 par défaut, l'adresse validée du compte).
 * Rend 'envoye', 'non_configure', 'sans_email', ou lève.
 */
export async function envoyerHtml(env, fetchImpl, { email, sujet, html }) {
  if (!String(env.BREVO_API_KEY || '').trim()) return 'non_configure';
  if (!emailValide(email)) return 'sans_email';
  const api = client(env, fetchImpl);
  exiger(await api('POST', '/smtp/email', { sender: { id: Number(env.BREVO_EXPEDITEUR_ID) || 1 }, to: [{ email: String(email).trim() }],
    subject: String(sujet || '').slice(0, 150), htmlContent: String(html || '') }), 'envoi', [200, 201, 202]);
  return 'envoye';
}

/** @param {{db:any, env:any, fetchImpl?:Function, maintenant?:()=>number, reste?:()=>number}} ctx */
export function creerBrevo(ctx) {
  const { db, env } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const lire = async (c) => (await db.ref(c).get()).val();
  const configure = () => !!String(env.BREVO_API_KEY || '').trim();
  const listeNom = () => String(env.BREVO_LISTE || 'RepCore').trim();

  // ── LA FILE ────────────────────────────────────────────────────────────
  async function enfiler(op) {
    const t = now();
    const ref = db.ref('email_file').push();
    await ref.set(Object.assign({ essais: 0, prochain: t, cree: t }, op));
    return ref.key;
  }
  // Le compte qui consent : relu dans SON dossier, jamais sur la foi du drapeau.
  async function contactDuCompte(k, statutForce, bienvenue) {
    const [c, email, fname, status, origine] = await Promise.all(['consentements/email', 'email', 'fname', 'status', 'origine']
      .map((x) => lire('users/' + k + '/' + x)));
    if (!(c && c.accepte === true)) return 'sans_consentement';
    const e = String(email || k.replace(/,/g, '.')).trim();
    if (!emailValide(e)) return 'sans_email';
    await enfiler({ op: 'contact', email: e, prenom: net(fname, 40), source: srcNet(origine && origine.src),
      date: jourParis(Number(c.le) || now()), statut: statutForce || statutContact({ status }), compte: k, bienvenue: bienvenue === true });
    return 'en_file';
  }
  // Les drapeaux posés par l'app à l'inscription. Le dossier part de l'app
  // quelques secondes APRÈS le drapeau : sans consentement lu, un drapeau
  // récent est gardé une heure, puis oublié.
  async function optins() {
    const l = (await lire('email_optin')) || {};
    const maj = {}; const bilan = {};
    const t = now();
    for (const k of Object.keys(l).sort().slice(0, LOT)) {
      bilan[k] = await contactDuCompte(k, undefined, true);
      if (bilan[k] === 'sans_consentement' && t - (Number(l[k] && l[k].le) || 0) < 3600e3) continue;
      maj['email_optin/' + k] = null;
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    return bilan;
  }

  // L'identifiant de la liste des contacts, retrouvée par son nom (créée si
  // absente, dans le premier dossier), puis gardé.
  async function listeId(api) {
    const nom = listeNom();
    const k = 'worker/email/listes/' + nom.replace(/[.#$\[\]\/]/g, '_');
    const garde = await lire(k);
    if (garde) return garde;
    const l = exiger(await api('GET', '/contacts/lists?limit=50&offset=0'), 'listes');
    let x = l && Array.isArray(l.lists) ? l.lists.find((y) => y && y.name === nom) : null;
    if (!x) {
      const d = exiger(await api('GET', '/contacts/folders?limit=10&offset=0'), 'dossiers');
      let dossier = d && Array.isArray(d.folders) && d.folders[0] ? d.folders[0].id : null;
      if (!dossier) dossier = (exiger(await api('POST', '/contacts/folders', { name: 'RepCore' }), 'dossier_creation') || {}).id;
      x = exiger(await api('POST', '/contacts/lists', { name: nom, folderId: Number(dossier) }), 'liste_creation');
    }
    if (!x || !x.id) throw new Arret(500, 'liste_sans_id');
    await db.ref(k).set(x.id);
    return x.id;
  }
  // LA PRÉPARATION DU COMPTE, une fois : les attributs dont le worker a besoin
  // (texte), créés s'ils manquent. Un attribut qui existe déjà répond 400 :
  // ce n'est pas une erreur.
  const ATTRIBUTS = ['SOURCE', 'DATE_INSCRIPTION', 'STATUT', 'ECHEANCE', 'MONTANT'];
  const PREPARATION = 'v2';   // v2 : relance une fois, pour effacer le refus noté avant la bonne clé
  async function preparer(api) {
    if ((await lire('worker/email/prepare')) === PREPARATION) return 'deja';
    for (const nom of ATTRIBUTS) exiger(await api('POST', '/contacts/attributes/normal/' + nom, { type: 'text' }), 'attribut', [200, 201, 204, 400]);
    await db.ref().update({ 'worker/email/prepare': PREPARATION, 'worker/email/dernier': null });   // l'ancien refus ne reste pas affiché
    return 'fait';
  }
  // UNE OPÉRATION. Rend une note ou lève Arret.
  async function executer(op, api) {
    const email = String(op.email || '').trim();
    if (op.op === 'supprimer') {
      const r = exiger(await api('DELETE', '/contacts/' + encodeURIComponent(email)), 'suppression', [200, 204, 404]);
      return r === null ? 'supprime' : 'supprime';
    }
    const attributs = {};
    if (op.source) attributs.SOURCE = String(op.source);
    if (op.date) attributs.DATE_INSCRIPTION = String(op.date);
    if (op.statut) attributs.STATUT = String(op.statut);
    const note = await upsert(api, env, { email, prenom: op.prenom, attributs, listIds: [Number(await listeId(api))] });
    // LA BIENVENUE, une fois par compte, après la case cochée (jamais à un désinscrit).
    if (op.bienvenue && op.compte) {
      const [deja, desinscrit] = await Promise.all([lire('email_envoyes/' + op.compte + '/bienvenue'), lire('desinscrits/' + op.compte)]);
      if (!deja && !desinscrit) {
        const r = await envoyerModele(env, ctx.fetchImpl, { email, prenom: op.prenom, modele: env.BREVO_MODELE_BIENVENUE,
          params: { DESINSCRIPTION: await lienDesinscription(env, email) } });
        if (r === 'envoye') await db.ref('email_envoyes/' + op.compte + '/bienvenue').set(now());
      }
    }
    return note;
  }

  // ── CHAQUE MINUTE ──────────────────────────────────────────────────────
  async function minute(t0) {
    const t = t0 || now();
    const bilan = { optins: await optins(), faites: 0, reportees: 0, echecs: 0 };
    // Les compteurs d'IP des jours passés : effacés une fois par jour.
    const auj = jourParis(t);
    if ((await lire('worker/email/purge')) !== auj) {
      const jours = await db.ref('lead_ip').shallow();
      const maj = { 'worker/email/purge': auj };
      for (const j of jours) if (j !== auj) maj['lead_ip/' + j] = null;
      await db.ref().update(maj);
    }
    if (!configure()) return Object.assign(bilan, { etat: 'non_configure' });
    const etat = (await lire('worker/email/debit')) || {};
    if (Number(etat.pauseJusqua) > t) return Object.assign(bilan, { etat: 'pause_429' });
    const m = new Date(t).toISOString().slice(0, 16);
    const compteur = { n: etat.minute === m ? Number(etat.n) || 0 : 0 };
    const api = client(env, ctx.fetchImpl, compteur);
    const reste = () => (typeof ctx.reste === 'function' ? ctx.reste() : Infinity);
    const l = (await db.ref('email_file').orderByKey().limitToFirst(LOT).get()).val() || {};
    let pause = 0;
    if (Object.keys(l).length) {
      // La préparation (5 appels, une fois) ne commence que si le budget la permet.
      if ((await lire('worker/email/prepare')) !== PREPARATION && (compteur.n + 11 > EMAIL_PAR_MINUTE || reste() < 16)) return false;   // pas fini : repris au réveil suivant
      try { bilan.preparation = await preparer(api); }
      catch (e) {
        // Noté (code et étape, jamais la clé) : c'est la première chose à lire si rien ne part.
        await db.ref('worker/email/dernier').set({ etat: 'preparation_' + (e && e.statut), etape: (e && e.etape) || null, detail: (e && e.detail) || null, le: t });
        return Object.assign(bilan, { etat: 'preparation_' + (e && e.statut) });
      }
    }
    for (const id of Object.keys(l).sort()) {
      const op = l[id];
      if (!op || Number(op.prochain) > t) continue;
      // Une opération coûte au plus 6 appels (liste à créer) : on ne la commence que si elle tient.
      if (compteur.n + 6 > EMAIL_PAR_MINUTE || reste() < 10) break;
      try {
        const note = await executer(op, api);
        const maj = { ['email_file/' + id]: null };
        if (note === 'attributs_refuses') maj['email_echecs/' + id] = Object.assign({}, op, { le: t, raison: 'attributs_refuses', etape: 'attributs' });
        await db.ref().update(maj);
        bilan.faites++;
      } catch (e) {
        const statut = e instanceof Arret ? e.statut : 0;
        const essais = (Number(op.essais) || 0) + 1;
        const attente = statut === 429 ? (e.attente || 60) * 1000 : 0;
        if (attente) pause = Math.max(pause, attente);
        if (aRetenter(statut) && essais < EMAIL_ESSAIS_MAX) {
          await db.ref('email_file/' + id).update({ essais, prochain: t + Math.max(delaiEssai(essais), attente), dernier: { statut, etape: (e && e.etape) || 'reseau', le: t } });
          bilan.reportees++;
        } else {
          await db.ref().update({ ['email_file/' + id]: null, ['email_echecs/' + id]: Object.assign({}, op, { essais, le: t, statut, etape: (e && e.etape) || 'reseau' }) });
          bilan.echecs++;
        }
        if (statut === 429) break;
      }
    }
    await db.ref('worker/email/debit').set({ minute: m, n: compteur.n, pauseJusqua: pause ? t + pause : null });
    return Object.assign(bilan, { appels: compteur.n });
  }

  // ── LE FORMULAIRE DU GUIDE (POST /lead) ────────────────────────────────
  async function hacherIp(ip, jour) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(env.LEAD_SEL || 'repcore') + '|' + jour + '|' + ip));
    return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const leadOuvert = () => configure() && String(env.LEAD_OUVERT || '').trim() === 'oui';
  /** Rend {statut, corps}. Le champ piège rempli : 200, comme un succès (le robot n'apprend rien). */
  async function lead(corps, ip) {
    const t = now();
    if (!leadOuvert()) return { statut: 503, corps: { ok: false, raison: 'ferme' } };
    const b = corps || {};
    if (String(b.site || '').trim()) return { statut: 200, corps: { ok: true } };
    const email = String(b.email || '').trim().toLowerCase(), prenom = net(b.prenom, 40);
    if (!emailValide(email)) return { statut: 400, corps: { ok: false, raison: 'email' } };
    if (b.accord !== true) return { statut: 400, corps: { ok: false, raison: 'accord' } };
    const jour = jourParis(t);
    const h = await hacherIp(String(ip || 'inconnue'), jour);
    const tx = await db.ref('lead_ip/' + jour + '/' + h).transaction((n) => ((Number(n) || 0) >= LEAD_PAR_IP_JOUR ? undefined : (Number(n) || 0) + 1));
    if (!tx.committed) return { statut: 429, corps: { ok: false, raison: 'limite' } };
    // La preuve du consentement (RGPD, art. 7.1) : quand, d'où, quel texte.
    await db.ref('leads/' + cleEmail(email)).set({ le: t, src: srcNet(b.src), texte: 'guide-cycle-v1' });
    await enfiler({ op: 'contact', email, prenom, source: 'guide_' + srcNet(b.src), date: jour, statut: 'prospect' });
    return { statut: 200, corps: { ok: true } };
  }

  // ── LA DÉSINSCRIPTION (GET /desinscription?e=…&s=…, lien des e-mails) ──
  // Rend {statut, html}. Signature fausse : 403, rien ne change.
  async function desinscrire(email, sig) {
    const t = now();
    const e = String(email || '').trim().toLowerCase();
    if (!emailValide(e) || !(await signatureDesinscription(env, e, sig))) return { statut: 403, html: pageDesinscription(false) };
    const k = cleEmail(e);
    const maj = { ['desinscrits/' + k]: t, ['leads/' + k]: null, ['email_optin/' + k]: null };
    if (await lire('users/' + k + '/email')) {
      maj['users/' + k + '/consentements/email'] = { accepte: false, le: t, texte: 'desinscription-lien' };
      maj['users/' + k + '/updatedAt'] = t;
    }
    await db.ref().update(maj);
    // Et chez Brevo : l'adresse ne reçoit plus d'e-mail de conseil.
    if (configure()) { try { await client(env, ctx.fetchImpl)('PUT', '/contacts/' + encodeURIComponent(e), { emailBlacklisted: true }); } catch (x) { /* noté chez nous, c'est ce qui compte */ } }
    return { statut: 200, html: pageDesinscription(true) };
  }

  // ── /fn/email (appelé par l'app, compte authentifié) ───────────────────
  async function appel(req) {
    const k = cleEmail(req && req.auth && req.auth.email);
    const email = String((req && req.auth && req.auth.email) || '').trim();
    const a = String((req && req.data && req.data.action) || '');
    if (!k) return { ok: false, raison: 'compte' };
    if (a === 'supprimer') {
      // Une création encore en file pour cette adresse ne doit pas passer APRÈS la suppression.
      const file = (await lire('email_file')) || {};
      const maj = { ['email_optin/' + k]: null, ['leads/' + k]: null };
      for (const id of Object.keys(file)) if (file[id] && String(file[id].email || '').toLowerCase() === email.toLowerCase()) maj['email_file/' + id] = null;
      await db.ref().update(maj);
      if (emailValide(email)) await enfiler({ op: 'supprimer', email });
      return { ok: true };
    }
    return { ok: false, raison: 'action' };
  }

  // L'ÉTAT, sans aucune donnée personnelle (GET /email/etat) : des compteurs
  // et des codes, pour vérifier la configuration sans accès à la base.
  async function etat() {
    const [file, echecs, prepare, debit, job] = await Promise.all([db.ref('email_file').shallow(), db.ref('email_echecs').shallow(),
      lire('worker/email/prepare'), lire('worker/email/debit'), lire('worker/jobs/emails')]);
    const ech = (await lire('email_echecs')) || {};
    const dernier = await lire('worker/email/dernier');
    return { configure: configure(), dernier: dernier || null, file: file.length, echecs: echecs.length, prepare: prepare || null,
      appelsMinute: (debit && debit.n) || 0, pause: !!(debit && debit.pauseJusqua),
      dernierEchec: Object.values(ech).slice(-3).map((x) => ({ statut: x.statut || null, etape: x.etape || null, raison: x.raison || null })),
      job: job ? { periode: job.jour || null, fini: !!job.fini, erreur: job.erreur ? String(job.erreur).slice(0, 120) : null } : null };
  }

  return { minute, enfiler, contactDuCompte, lead, leadOuvert, appel, executer, etat, desinscrire };
}

/** PURE. La page rendue après un clic sur le lien de désinscription. */
export function pageDesinscription(ok) {
  const t = ok ? 'C’est fait : tu ne recevras plus nos e-mails de conseils.' : 'Ce lien de désinscription n’est pas valide.';
  const d = ok ? 'Les e-mails liés à ton abonnement (comme l’avis avant un renouvellement annuel) restent envoyés, la loi les impose. Tu peux te réabonner aux conseils à tout moment en nous écrivant.'
    : 'Réponds simplement à l’un de nos e-mails pour te désinscrire.';
  return '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>RepCore</title></head>'
    + '<body style="margin:0;background:#080808;color:#f2f2f2;font-family:Arial,Helvetica,sans-serif"><main style="max-width:520px;margin:0 auto;padding:48px 20px">'
    + '<p style="color:#ff4d4d;letter-spacing:3px;font-weight:bold;font-size:12px">REPCORE</p><h1 style="font-size:22px;line-height:1.4">' + t + '</h1>'
    + '<p style="color:#b5b5b5;line-height:1.6">' + d + '</p></main></body></html>';
}
