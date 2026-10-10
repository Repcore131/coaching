// ══ LES CONTACTS E-MAIL, SYNCHRONISÉS AVEC SYSTEME.IO (11/10/2026) ═══════
//
// TOUT CE QUI PARLE À SYSTEME.IO PASSE PAR ICI, et nulle part ailleurs : un
// autre outil d'e-mail (HubSpot…) ne demanderait que de remplacer ce module.
// ⚠ LE WORKER N'ENVOIE JAMAIS D'E-MAIL LUI-MÊME. Il crée ou met à jour un
//   contact et lui pose l'étiquette ; ce sont les automatisations de
//   Systeme.io qui écrivent (le guide, la séquence de bienvenue), et le lien
//   de désinscription est le leur. L'app, elle, n'appelle aucun service
//   d'e-mail (un test l'interdit) : elle ne fait que cocher une case.
//
// D'OÙ VIENNENT LES CONTACTS
//   · l'INSCRIPTION, case « Reçois mes conseils et les nouveautés par e-mail »
//     (décochée par défaut) : l'app écrit users/<clé>/consentements/email et
//     un drapeau email_optin/<clé>. Le travail de la minute relit le
//     consentement dans le dossier (le drapeau seul ne suffit pas) et met le
//     contact en file. Sans consentement : RIEN ;
//   · le formulaire du GUIDE sur la page d'accueil (POST /lead) : prénom +
//     e-mail, champ piège, 5 envois par jour et par adresse IP (l'IP n'est
//     jamais gardée : un hachage salé du jour) ;
//   · le PREMIER PAIEMENT d'un compte qui a consenti : son statut passe à
//     « payant ».
//
// LA FILE (sio_file/<id>) : une opération par entrée, traitée chaque minute.
//   · 30 REQUÊTES PAR MINUTE au plus vers Systeme.io (compteur gardé d'une
//     exécution à l'autre dans la même minute), et jamais plus que le budget
//     de l'exécution ;
//   · erreur 5xx, réseau ou 429 : l'opération repart plus tard (1, 2, 4… 60
//     minutes ; un 429 suspend toute la file le temps que Systeme.io dit),
//     et au 8e échec elle passe dans sio_echecs ;
//   · erreur 4xx : définitive, rangée dans sio_echecs avec son code. Un 422
//     sur les champs personnalisés (pas encore créés dans Systeme.io) ne
//     bloque pas : le contact est créé sans eux, et l'échec est noté.
//
// LA SUPPRESSION DE COMPTE (/fn/email, action « supprimer ») met en file la
// suppression du contact (DELETE), consentement ou non (il a pu venir du
// guide), et efface tout ce qui reste ici.

const SIO = 'https://api.systeme.io/api';
export const SIO_PAR_MINUTE = 30;
export const SIO_ESSAIS_MAX = 8;
export const LEAD_PAR_IP_JOUR = 5;
const LOT = 20;
const RE_EMAIL = /^[^@\s,]{1,64}@[^@\s,]{1,190}\.[^@\s,]{2,24}$/;
const cleEmail = (e) => String(e || '').toLowerCase().trim().replace(/\./g, ',');
const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
const net = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n || 60);
const srcNet = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 20) || 'direct';

/** PURE. Le délai avant le n-ième nouvel essai (minutes) : 1, 2, 4… 60. */
export function delaiEssai(n) { return Math.min(60, 2 ** Math.max(0, Number(n) - 1)) * 60e3; }
/** PURE. Une réponse est-elle à retenter ? (réseau = statut 0, 429, 5xx) */
export function aRetenter(statut) { return statut === 0 || statut === 429 || statut >= 500; }
/** PURE. Un e-mail acceptable. */
export function emailValide(e) { return RE_EMAIL.test(String(e || '').trim()); }
/** PURE. Le statut d'un dossier pour Systeme.io. */
export function statutContact(u) {
  const x = u || {};
  if (x.status === 'AUTONOMIE_PREMIUM' || x.status === 'COACHING_SUIVI') return 'payant';
  return 'essai';
}

/** @param {{db:any, env:any, fetchImpl?:Function, maintenant?:()=>number, reste?:()=>number}} ctx */
export function creerSystemeio(ctx) {
  const { db, env } = ctx;
  const now = ctx.maintenant || (() => Date.now());
  const F = ctx.fetchImpl || fetch;
  const lire = async (c) => (await db.ref(c).get()).val();
  const cle = () => String(env.SYSTEMEIO_API_KEY || '').trim();
  const tagNom = () => String(env.SYSTEMEIO_TAG || 'repcore').trim();
  const champ = (nom, defaut) => String(env['SYSTEMEIO_CHAMP_' + nom] || defaut).trim();
  const configure = () => !!cle();

  // ── LA FILE ────────────────────────────────────────────────────────────
  async function enfiler(op) {
    const t = now();
    const ref = db.ref('sio_file').push();
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
  // Les drapeaux posés par l'app à l'inscription.
  async function optins() {
    const l = (await lire('email_optin')) || {};
    const maj = {}; const bilan = {};
    const t = now();
    for (const k of Object.keys(l).sort().slice(0, LOT)) {
      bilan[k] = await contactDuCompte(k);
      // Le dossier part de l'app quelques secondes APRÈS le drapeau : sans
      // consentement lu, le drapeau récent est gardé une heure, puis oublié.
      if (bilan[k] === 'sans_consentement' && t - (Number(l[k] && l[k].le) || 0) < 3600e3) continue;
      maj['email_optin/' + k] = null;
    }
    if (Object.keys(maj).length) await db.ref().update(maj);
    return bilan;
  }

  // ── UN APPEL À SYSTEME.IO (compté) ─────────────────────────────────────
  function client(compteur) {
    return async (methode, chemin, corps, type) => {
      compteur.n++;
      let r;
      try {
        r = await F(SIO + chemin, { method: methode,
          headers: Object.assign({ 'X-API-Key': cle(), Accept: 'application/json' }, corps ? { 'Content-Type': type || 'application/json' } : {}),
          body: corps ? JSON.stringify(corps) : undefined });
      } catch (e) { return { statut: 0, corps: null }; }
      let j = null;
      if (r.status !== 204) { try { j = await r.json(); } catch (e) { j = null; } }
      const ra = r.headers && typeof r.headers.get === 'function' ? Number(r.headers.get('Retry-After')) : 0;
      return { statut: r.status, corps: j, retryAfter: ra > 0 ? ra : 0 };
    };
  }
  class Arret extends Error { constructor(statut, etape, retryAfter) { super('Systeme.io ' + etape + ' ' + statut); this.statut = statut; this.etape = etape; this.retryAfter = retryAfter || 0; } }
  const exiger = (r, etape, ok) => { if (!(ok || [200, 201, 204]).includes(r.statut)) throw new Arret(r.statut, etape, r.retryAfter); return r.corps; };

  // L'identifiant de l'étiquette, retrouvé par son nom (créée si absente), gardé.
  async function tagId(api) {
    const nom = tagNom();
    const garde = await lire('worker/sio/tags/' + nom.replace(/[.#$\[\]\/]/g, '_'));
    if (garde) return garde;
    const l = exiger(await api('GET', '/tags?limit=100'), 'tags');
    let t = l && Array.isArray(l.items) ? l.items.find((x) => x && x.name === nom) : null;
    if (!t) t = exiger(await api('POST', '/tags', { name: nom }), 'tag_creation');
    if (!t || !t.id) throw new Arret(500, 'tag_sans_id');
    await db.ref('worker/sio/tags/' + nom.replace(/[.#$\[\]\/]/g, '_')).set(t.id);
    return t.id;
  }
  async function trouver(api, email) {
    const l = exiger(await api('GET', '/contacts?email=' + encodeURIComponent(email)), 'recherche');
    return l && Array.isArray(l.items) ? (l.items.find((x) => x && String(x.email || '').toLowerCase() === email.toLowerCase()) || l.items[0] || null) : null;
  }
  // UNE OPÉRATION. Rend une note (pour le journal) ou lève Arret.
  async function executer(op, api) {
    const email = String(op.email || '').trim();
    if (op.op === 'supprimer') {
      const c = await trouver(api, email);
      if (!c) return 'absent';
      exiger(await api('DELETE', '/contacts/' + c.id), 'suppression', [200, 204, 404]);
      return 'supprime';
    }
    // op.op === 'contact'
    const perso = [];
    if (op.source) perso.push({ slug: champ('SOURCE', 'source'), value: String(op.source) });
    if (op.date) perso.push({ slug: champ('DATE', 'date_inscription'), value: String(op.date) });
    if (op.statut) perso.push({ slug: champ('STATUT', 'statut'), value: String(op.statut) });
    const base = op.prenom ? [{ slug: 'first_name', value: String(op.prenom) }] : [];
    let note = 'ok';
    let c = await trouver(api, email);
    if (!c) {
      let r = await api('POST', '/contacts', { email, locale: 'fr', fields: base.concat(perso) });
      if (r.statut === 422 && perso.length) { note = 'champs_refuses'; r = await api('POST', '/contacts', { email, locale: 'fr', fields: base }); }
      c = exiger(r, 'creation');
    } else {
      const r = await api('PATCH', '/contacts/' + c.id, { fields: base.concat(perso) }, 'application/merge-patch+json');
      if (r.statut === 422 && perso.length) note = 'champs_refuses';
      else exiger(r, 'mise_a_jour');
    }
    if (!c || !c.id) throw new Arret(500, 'contact_sans_id');
    const id = await tagId(api);
    // Déjà étiqueté : Systeme.io répond une erreur 4xx de doublon, ce n'en est pas une.
    exiger(await api('POST', '/contacts/' + c.id + '/tags', { tagId: Number(id) }), 'etiquette', [200, 201, 204, 409, 422]);
    return note;
  }

  // ── CHAQUE MINUTE ──────────────────────────────────────────────────────
  async function minute(t0) {
    const t = t0 || now();
    const bilan = { optins: await optins(), faites: 0, reportees: 0, echecs: 0 };
    // Les compteurs d'IP des jours passés : effacés une fois par jour.
    const auj = jourParis(t);
    if ((await lire('worker/sio/purge')) !== auj) {
      const jours = await db.ref('lead_ip').shallow();
      const maj = { 'worker/sio/purge': auj };
      for (const j of jours) if (j !== auj) maj['lead_ip/' + j] = null;
      await db.ref().update(maj);
    }
    if (!configure()) return Object.assign(bilan, { etat: 'non_configure' });
    const etat = (await lire('worker/sio/debit')) || {};
    if (Number(etat.pauseJusqua) > t) return Object.assign(bilan, { etat: 'pause_429' });
    const m = new Date(t).toISOString().slice(0, 16);
    const compteur = { n: etat.minute === m ? Number(etat.n) || 0 : 0 };
    const api = client(compteur);
    const reste = () => (typeof ctx.reste === 'function' ? ctx.reste() : Infinity);
    const l = (await db.ref('sio_file').orderByKey().limitToFirst(LOT).get()).val() || {};
    let pause = 0;
    for (const id of Object.keys(l).sort()) {
      const op = l[id];
      if (!op || Number(op.prochain) > t) continue;
      // Une opération coûte au plus 5 appels : on ne la commence que si elle tient.
      if (compteur.n + 5 > SIO_PAR_MINUTE || reste() < 10) break;
      try {
        const note = await executer(op, api);
        const maj = { ['sio_file/' + id]: null };
        if (note === 'champs_refuses') maj['sio_echecs/' + id] = Object.assign({}, op, { le: t, raison: 'champs_refuses', etape: 'champs' });
        await db.ref().update(maj);
        bilan.faites++;
      } catch (e) {
        const statut = e instanceof Arret ? e.statut : 0;
        const essais = (Number(op.essais) || 0) + 1;
        if (statut === 429) pause = Math.max(pause, (e.retryAfter || 60) * 1000);
        if (aRetenter(statut) && essais < SIO_ESSAIS_MAX) {
          await db.ref('sio_file/' + id).update({ essais, prochain: t + Math.max(delaiEssai(essais), statut === 429 ? (e.retryAfter || 60) * 1000 : 0), dernier: { statut, etape: e.etape || 'reseau', le: t } });
          bilan.reportees++;
        } else {
          await db.ref().update({ ['sio_file/' + id]: null, ['sio_echecs/' + id]: Object.assign({}, op, { essais, le: t, statut, etape: (e && e.etape) || 'reseau' }) });
          bilan.echecs++;
        }
        if (statut === 429) break;
      }
    }
    await db.ref('worker/sio/debit').set({ minute: m, n: compteur.n, pauseJusqua: pause ? t + pause : null });
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
    const k = cleEmail(email);
    // La preuve du consentement (RGPD, art. 7.1) : quand, d'où, quel texte.
    await db.ref('leads/' + k).set({ le: t, src: srcNet(b.src), texte: 'guide-cycle-v1' });
    await enfiler({ op: 'contact', email, prenom, source: 'guide_' + srcNet(b.src), date: jour, statut: 'prospect' });
    return { statut: 200, corps: { ok: true } };
  }

  // ── /fn/email (appelé par l'app, compte authentifié) ───────────────────
  async function appel(req) {
    const k = cleEmail(req && req.auth && req.auth.email);
    const email = String((req && req.auth && req.auth.email) || '').trim();
    const a = String((req.data && req.data.action) || '');
    if (!k) return { ok: false, raison: 'compte' };
    if (a === 'supprimer') {
      // Une création encore en file pour cette adresse ne doit pas passer APRÈS la suppression.
      const file = (await lire('sio_file')) || {};
      const maj = { ['email_optin/' + k]: null, ['leads/' + k]: null };
      for (const id of Object.keys(file)) if (file[id] && String(file[id].email || '').toLowerCase() === email.toLowerCase()) maj['sio_file/' + id] = null;
      await db.ref().update(maj);
      if (emailValide(email)) await enfiler({ op: 'supprimer', email });
      return { ok: true };
    }
    return { ok: false, raison: 'action' };
  }

  return { minute, enfiler, contactDuCompte, lead, leadOuvert, appel, executer };
}
