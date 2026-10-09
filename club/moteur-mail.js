/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — moteur de détection des demandes de résiliation (MAIL_ENGINE) ══
// Même code que le script de relève (apps-script/Code.gs) : scores, signaux, type d'expéditeur,
// type de demande, nom, numéro client, téléphone, motif et date d'effet. Utilisé par le banc
// d'essai de Réglages (testMailRules), par la fonction serveur et par la source Microsoft 365.
// Aucune écriture, aucun réseau : des fonctions pures.

const MAIL_ENGINE = (() => {
  // Règles par défaut d'un club (S.clubs[id].mailRules), modifiables dans Réglages > Relève des résiliations.
  const REGLES_DEFAUT = {
    slaHours: 24, minScore: 3,
    keywords: [{ re: 'resili', w: 3 }, { re: 'mettre fin|annuler mon abonnement|arreter mon abonnement|ne plus etre preleve', w: 3 }, { re: 'preavis|fin de contrat|lettre recommandee', w: 1 }, { re: 'demenag|mutation', w: 1 }, { re: 'suspen|mettre en pause', w: 1 }],
    negatives: [{ re: 'newsletter|se desabonner|unsubscribe|offre speciale', w: -3 }, { re: '\\bcv\\b|candidature|stage', w: -2 }],
    notifSenders: ['resamania', 'stadline', 'no-?reply@.*fitness'],
    ignoreSenders: ['github', 'paypal', 'google\\.com'],
    ownAddresses: [],
  };
  const MOTIFS = [
    ['Déménagement', /demenag|mutation|quitte la region|nouvelle ville/],
    ['Santé', /sante|blessure|operation|medecin|enceinte|grossesse|maladie/],
    ['Prix', /prix|cher|budget|financ|moyens|augmentation/],
    ['Manque de temps', /temps|horaire|travail|planning|disponib/],
    ['Concurrence', /autre salle|concurren|basic ?fit|keep ?cool|l'orange bleue|on air/],
    ['Insatisfaction', /insatisf|decu|sale|trop de monde|machines|accueil|propre/],
  ];
  const MOIS = { janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12 };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const reSur = (x, f = '') => { try { return new RegExp(x, f); } catch (e) { return null; } };
  // Libellé court d'une règle : son premier mot-clé.
  const etiquette = r => r.tag || String(r.re).split('|')[0].replace(/\\b|\\/g, '').trim();

  // Règles du club (texte) -> expressions compilées ; les motifs invalides sont écartés.
  function compile(rules) {
    const R = { ...REGLES_DEFAUT, ...(rules || {}) };
    const regles = [...(R.keywords || []), ...(R.negatives || [])].map(r => ({ re: reSur(r.re), w: Number(r.w) || 0, tag: etiquette(r) })).filter(r => r.re && r.w);
    const liste = l => (l || []).map(x => reSur(x, 'i')).filter(Boolean);
    return { regles, minScore: Number(R.minScore) || 3, slaHours: Number(R.slaHours) || 24, notif: liste(R.notifSenders), ignore: liste(R.ignoreSenders), own: (R.ownAddresses || []).map(x => String(x).toLowerCase().trim()).filter(Boolean) };
  }
  function classe(fromEmail, txt, C) {
    let score = 0; const signals = [];
    C.regles.forEach(r => { if (r.re.test(txt)) { score += r.w; signals.push(r.tag); } });
    const notif = C.notif.some(r => r.test(fromEmail || ''));
    if (notif && /resili|cancel/.test(txt)) { score += 3; signals.push('notification logiciel'); }
    if (notif && /appli|application|en ligne|espace (membre|adherent)/.test(txt)) signals.push('appli');
    const kind = notif ? 'notification' : /formulaire|via le site|message de contact/.test(txt) ? 'formulaire' : 'adherent';
    const resil = /resili|mettre fin|annuler mon abonnement|arreter mon abonnement/.test(txt);
    const type = !resil && /suspen|mettre en pause/.test(txt) ? 'suspension' : 'resiliation';
    return { score, kind, type, signals };
  }
  function numero(txt) {
    const m = txt.match(/(?:n(?:°|o|um(?:ero)?)\.?\s*(?:de\s+)?(?:client|adherent|membre|contrat|badge)|(?:client|adherent|membre|contrat)\s*(?:n°|no|numero|id))\s*[:#]?\s*([a-z0-9]{4,12})/);
    return m ? m[1].toUpperCase() : null;
  }
  function telephone(s) {
    const m = String(s || '').match(/(?:\+33\s?|0)[1-9](?:[\s.]?\d{2}){4}/);
    if (!m) return null;
    const d = m[0].replace(/\D/g, '').replace(/^33/, '0');
    return d.length === 10 ? d.replace(/(\d{2})(?=\d)/g, '$1 ') : null;
  }
  function emailDansTexte(s, me, C) {
    const all = String(s || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
    return all.map(x => x.toLowerCase()).filter(x => x !== me && !C.notif.some(r => r.test(x)))[0] || null;
  }
  function nom(first, brut, kind) {
    if (kind !== 'adherent') {
      const n = brut.match(/\bnom\s*:\s*([^\n\r]{2,40})/i); const p = brut.match(/\bpr[ée]nom\s*:\s*([^\n\r]{2,40})/i);
      if (n) return ((p ? p[1].trim() + ' ' : '') + n[1].trim()).slice(0, 60);
    }
    const dn = (first.from && first.from.name) || '';
    if (dn && dn.indexOf('@') < 0 && /\s/.test(dn.trim())) return dn.trim().slice(0, 60);
    const lignes = String(first.body || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (let i = lignes.length - 1; i >= Math.max(0, lignes.length - 6); i--) {
      if (/^[A-ZÀ-Ý][a-zà-ÿ'-]+(\s+[A-ZÀ-Ý][A-Za-zà-ÿ'-]+){1,2}$/.test(lignes[i])) return lignes[i];
    }
    return dn ? dn.trim().slice(0, 60) : null;
  }
  function motif(txt) { for (const [l, re] of MOTIFS) if (re.test(txt)) return l; return null; }
  // Date d'effet AAAA-MM-JJ (« à compter du 15 novembre », « date de fin : 30/11 »…), dans l'année si elle est à venir.
  function dateEffet(txt, maintenant = new Date()) {
    const re = /(?:a compter du|a partir du|au plus tard le|date (?:de fin|d'effet)\s*:?|fin (?:le|au)|resilier (?:au|le))\s*(\d{1,2})(?:er)?[/. ](\d{1,2}|[a-z]+)(?:[/. ](\d{2,4}))?/;
    const m = txt.match(re); if (!m) return null;
    const j = Number(m[1]); const mo = /^\d+$/.test(m[2]) ? Number(m[2]) : MOIS[m[2]];
    if (!mo || j < 1 || j > 31 || mo > 12) return null;
    let y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : maintenant.getFullYear();
    if (!m[3] && new Date(y, mo - 1, j) < maintenant) y++;
    const d = new Date(y, mo - 1, j); if (d.getMonth() !== mo - 1) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  }
  const coupeCitation = s => { const m = String(s || '').search(/^(Le .{5,80} a écrit|On .{5,80} wrote|-{2,} ?Original|De ?: .+@)/m); return m > 0 ? s.slice(0, m) : String(s || ''); };

  // Un fil de messages -> la demande transmise (même format que le script de relève), ou null.
  // items : [{ at, out, from: { name, email }, subject, pub, body }] triés par date ; me : adresse de la boîte.
  function analyseFil(id, items, me, rules, { link = null, sendExcerpt = false, maintenant = new Date() } = {}) {
    const C = rules && rules.regles ? rules : compile(rules);
    const entrants = items.filter(x => !x.out); if (!entrants.length) return null;
    const first = entrants[0];
    if (first.pub || C.ignore.some(r => r.test(first.from.email))) return null;
    const brut = entrants.map(x => x.subject + '\n' + x.body).join('\n'); const txt = norm(brut);
    const cls = classe(first.from.email, txt, C); if (cls.score < C.minScore) return null;
    const reponses = items.filter(x => x.out && x.at > first.at);
    const lastIn = entrants[entrants.length - 1]; const lastOut = reponses.length ? reponses[reponses.length - 1] : null;
    return {
      threadId: id, link, subject: String(first.subject || '').slice(0, 140), kind: cls.kind, type: cls.type, score: cls.score, signals: cls.signals.slice(0, 10),
      fromName: String(first.from.name || '').slice(0, 60), fromEmail: cls.kind === 'adherent' ? first.from.email : emailDansTexte(brut, me, C),
      name: nom(first, brut, cls.kind), clientNum: numero(txt), phone: telephone(brut), motif: motif(txt), effective: dateEffet(txt, maintenant),
      requestedAt: first.at, firstInAt: first.at, lastInAt: lastIn.at, inCount: entrants.length,
      firstReplyAt: reponses.length ? reponses[0].at : null, lastOutAt: lastOut ? lastOut.at : null, outCount: reponses.length,
      awaitingReply: !lastOut || lastIn.at > lastOut.at, excerpt: sendExcerpt ? String(first.body || '').replace(/\s+/g, ' ').slice(0, 280) : null,
    };
  }
  // Banc d'essai : un e-mail collé (expéditeur, objet, corps) -> ce que la relève en retiendrait. Rien n'est enregistré.
  function testMailRules(text, rules) {
    const C = compile(rules); const t = String(text || '');
    const de = (t.match(/^\s*(?:de|from|exp[ée]diteur)\s*:\s*(.+)$/im) || [])[1] || '';
    const ad = /<([^>]+)>/.exec(de); const email = (ad ? ad[1] : (de.match(/[^\s<>]+@[^\s<>]+/) || [''])[0]).toLowerCase().trim();
    const nomDe = ad ? de.slice(0, ad.index).replace(/"/g, '').trim() : '';
    const objet = (t.match(/^\s*(?:objet|subject)\s*:\s*(.+)$/im) || [])[1] || '';
    const corps = coupeCitation(t.replace(/^\s*(?:de|from|exp[ée]diteur|objet|subject|[àa]|to)\s*:.*$/gim, '').trim());
    const first = { at: 0, out: false, from: { name: nomDe, email }, subject: objet, pub: /se d[ée]sabonner|unsubscribe/i.test(t) && /newsletter|lettre d.information/i.test(t), body: corps || t };
    const txt = norm(objet + '\n' + (corps || t)); const cls = classe(email, txt, C);
    const brut = objet + '\n' + (corps || t);
    return { score: cls.score, retenu: cls.score >= C.minScore && !C.ignore.some(r => r.test(email)), seuil: C.minScore, signals: cls.signals, kind: cls.kind, type: cls.type,
      name: nom(first, brut, cls.kind), clientNum: numero(txt), phone: telephone(brut), motif: motif(txt), effective: dateEffet(txt) };
  }
  // Bloc à coller dans apps-script/Code.gs (remplace CFG et RULES) : la configuration du club en JavaScript.
  function blocScript(rules, { endpoint, clubId }) {
    const R = { ...REGLES_DEFAUT, ...(rules || {}) }; const rx = s => '/' + String(s).replace(/\//g, '\\/') + '/i';
    const lignes = [...(R.keywords || []), ...(R.negatives || [])].map(r => `  { re: /${String(r.re).replace(/\//g, '\\/')}/, w: ${Number(r.w) || 0}, tag: ${JSON.stringify(etiquette(r))} }`);
    return `const CFG = {\n  ENDPOINT: ${JSON.stringify(endpoint)},\n  CLUB_ID: ${JSON.stringify(clubId)},\n  QUERIES: [\n    'label:fp-resiliations newer_than:45d',\n    '(résiliation OR résilier OR resiliation OR resilier OR "mettre fin" OR préavis) -from:me newer_than:3d -category:promotions -category:social'\n  ],\n  MAX_THREADS: 150,\n  MIN_SCORE: ${Number(R.minScore) || 3},\n  SEND_EXCERPT: false,\n  OWN_ADDRESSES: ${JSON.stringify((R.ownAddresses || []).map(x => String(x).toLowerCase()))},\n  NOTIF_SENDERS: [${(R.notifSenders || []).map(rx).join(', ')}],\n  IGNORE_SENDERS: [${(R.ignoreSenders || []).map(rx).join(', ')}]\n};\nconst RULES = [\n${lignes.join(',\n')}\n];\n`;
  }
  return { REGLES_DEFAUT, MOTIFS, norm, compile, classe, numero, telephone, emailDansTexte, nom, motif, dateEffet, coupeCitation, analyseFil, testMailRules, blocScript };
})();
const testMailRules = MAIL_ENGINE.testMailRules;
// Côté serveur (Node) : le même moteur, par require().
/* global module */
if (typeof module === 'object' && module && module.exports) module.exports = MAIL_ENGINE;
