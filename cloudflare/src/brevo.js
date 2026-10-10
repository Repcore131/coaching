// ══ LES CONTACTS E-MAIL DE L'APP, SYNCHRONISÉS AVEC BREVO (11/10/2026) ═══
//
// TOUT CE QUI PARLE À BREVO PASSE PAR ICI, et nulle part ailleurs : changer
// d'outil ne demanderait que de remplacer ce module. (Systeme.io reste celui
// de la PROSPECTION de Kevin, hors de l'app : plan gratuit limité à 2 000
// contacts.)
// ⚠ LE WORKER N'ENVOIE JAMAIS D'E-MAIL LUI-MÊME. Il crée ou met à jour un
//   contact et l'inscrit dans une liste ; ce sont les automatisations de
//   Brevo (« contact ajouté à la liste ») qui écrivent, et le lien de
//   désinscription est le leur. L'app, elle, n'appelle aucun service
//   d'e-mail (un test l'interdit) : elle ne fait que cocher une case.
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
// LES LISTES D'ÉVÉNEMENT (inscrireListe) : l'avis de renouvellement annuel
// (L215-1), la fin d'essai (J-3), la reconquête (J+30). Le contact est retiré
// puis remis dans la liste, pour que l'automatisation se redéclenche.
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
// liste des contacts, « RepCore »), BREVO_LISTE_RENOUVELLEMENT,
// BREVO_LISTE_FIN_ESSAI, BREVO_LISTE_RECONQUETE (identifiants numériques),
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

/**
 * Inscrire un contact dans une LISTE D'ÉVÉNEMENT (renouvellement, fin d'essai,
 * reconquête) : contact créé ou mis à jour, retiré puis remis dans la liste
 * (l'automatisation de Brevo se redéclenche ainsi). Rend 'envoye',
 * 'non_configure', 'sans_email', ou lève.
 * @param {any} env
 * @param {Function} fetchImpl
 * @param {{email:string, prenom?:string, liste?:string, attributs?:Object}} o
 */
export async function inscrireListe(env, fetchImpl, { email, prenom, liste, attributs }) {
  const id = String(liste || '').trim();
  if (!String(env.BREVO_API_KEY || '').trim() || !/^\d+$/.test(id)) return 'non_configure';
  if (!emailValide(email)) return 'sans_email';
  const api = client(env, fetchImpl);
  await upsert(api, env, { email, prenom, attributs });
  // Retirer : un contact absent de la liste répond 400, ce n'est pas une erreur.
  exiger(await api('POST', '/contacts/lists/' + id + '/contacts/remove', { emails: [email] }), 'liste_retrait', [200, 201, 204, 400]);
  exiger(await api('POST', '/contacts/lists/' + id + '/contacts/add', { emails: [email] }), 'liste_ajout');
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
  async function contactDuCompte(k, statutForce) {
    const [c, email, fname, status, origine] = await Promise.all(['consentements/email', 'email', 'fname', 'status', 'origine']
      .map((x) => lire('users/' + k + '/' + x)));
    if (!(c && c.accepte === true)) return 'sans_consentement';
    const e = String(email || k.replace(/,/g, '.')).trim();
    if (!emailValide(e)) return 'sans_email';
    await enfiler({ op: 'contact', email: e, prenom: net(fname, 40), source: srcNet(origine && origine.src),
      date: jourParis(Number(c.le) || now()), statut: statutForce || statutContact({ status }), compte: k });
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
      bilan[k] = await contactDuCompte(k);
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
  const PREPARATION = 'v1';
  async function preparer(api) {
    if ((await lire('worker/email/prepare')) === PREPARATION) return 'deja';
    for (const nom of ATTRIBUTS) exiger(await api('POST', '/contacts/attributes/normal/' + nom, { type: 'text' }), 'attribut', [200, 201, 204, 400]);
    await db.ref('worker/email/prepare').set(PREPARATION);
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
    return upsert(api, env, { email, prenom: op.prenom, attributs, listIds: [Number(await listeId(api))] });
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

  return { minute, enfiler, contactDuCompte, lead, leadOuvert, appel, executer, etat };
}
