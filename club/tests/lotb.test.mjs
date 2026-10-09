// Lot B (pilotage du directeur) : résiliations en euros, journée, brief, impayés, imports,
// récap, confiance, adoption. Vrai code de l'appli.
//   TZ=Europe/Paris node --test club/tests/lotb.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chargerAppli } from '../outils/fitpulse-rapport.mjs';

const base = (extra = {}) => ({ clubs: { k: { id: 'k', name: 'Club' } }, users: { u: { id: 'u', first: 'Alex', last: 'M', role: 'manager', status: 'active', clubs: ['k'] }, v: { id: 'v', first: 'Sam', last: 'V', role: 'membre', status: 'active', clubs: ['k'] } }, ...extra });
const appli = (extra) => { const run = chargerAppli(base(extra)); run(`CLUB = S.clubs.k; ME = S.users.u;`); return run; };
const J = (run, code) => JSON.parse(run(`JSON.stringify(${code})`));

test('résiliation : 39,90 € et 4 mois restants, En jeu 160 €', () => {
  const run = appli({ clients: { c1: { id: 'c1', clubId: 'k', name: 'Lea Martin', num: '77', price: 39.9, end: '2026-09-20' } },
    resiliations: { r1: { id: 'r1', clubId: 'k', client: 'MARTIN Léa', date: '2026-05-20', status: 'nouvelle' } } });
  const v = J(run, `(({ euros, estimee, mois, client }) => ({ euros, estimee, mois, id: client && client.id }))(valeurEnJeu(S.resiliations.r1))`);
  assert.deepEqual(v, { euros: 160, estimee: false, mois: 4, id: 'c1' });
  assert.match(run(`resCard(S.resiliations.r1)`), /En jeu : 160 €/);
});
test('sans prix ni réglage : 32 € et mention estimé ; panier moyen réglé', () => {
  const run = appli({ resiliations: { r1: { id: 'r1', clubId: 'k', client: 'Inconnu Total', date: '2026-05-20', status: 'nouvelle' } } });
  assert.equal(J(run, `valeurEnJeu(S.resiliations.r1).euros`), 32 * 12);
  assert.match(run(`resCard(S.resiliations.r1)`), /estimé/);
  run(`S.settings.panierMoyen = 40; REV++`);
  assert.equal(J(run, `valeurEnJeu(S.resiliations.r1).euros`), 480);
});
test('homonymes : choix manuel, puis rattachement gardé', () => {
  const run = appli({ clients: { a: { id: 'a', clubId: 'k', name: 'Paul Roy', price: 30, end: '2027-01-01' }, b: { id: 'b', clubId: 'k', name: 'Paul Roy', price: 45 } },
    resiliations: { r1: { id: 'r1', clubId: 'k', client: 'Paul Roy', date: '2026-10-01', status: 'nouvelle' } } });
  assert.equal(J(run, `resClient(S.resiliations.r1)`), null);
  // Deux fiches au même nom : aucun lien automatique, deux suggestions à associer.
  const h = run(`resCard(S.resiliations.r1)`); assert.match(h, /Associer à :/); assert.equal((h.match(/data-act="resAssoc"/g) || []).length, 2);
  run(`S.resiliations.r1.clientId = 'b'; REV++`);
  assert.equal(J(run, `valeurEnJeu(S.resiliations.r1).euros`), 45 * 12);
});
test('tuile Valeur en jeu = somme des cartes ; récap « Sauvé »', () => {
  const run = appli({ clients: { c1: { id: 'c1', clubId: 'k', name: 'A B', price: 30, end: '2099-01-01' } },
    resiliations: { r1: { id: 'r1', clubId: 'k', client: 'A B', date: '2026-10-01', status: 'nouvelle' }, r2: { id: 'r2', clubId: 'k', client: 'C D', date: '2026-10-02', status: 'nouvelle', effective: '2099-01-01' },
      r3: { id: 'r3', clubId: 'k', client: 'E F', date: '2026-10-03', status: 'sauvee', saved: true, valeur: 384 } } });
  run(`UI.resTab = 'todo'`); const h = run(`PAGES.resiliations.render()`);
  const cartes = [...h.matchAll(/data-valeur="(\d+)"/g)].reduce((s, m) => s + Number(m[1]), 0);
  run(`UI.resTab = 'analyse'`); const a = run(`PAGES.resiliations.render()`);
  assert.equal(Number(a.match(/En jeu sur les dossiers ouverts : <b data-v="(\d+)"/)[1]), cartes);
  const mk = run('curMonth()'); run(`UI.recapMonth = '${mk}'`);
  assert.equal(J(run, `monthFigures('k', '${mk}').sauveEuros`), 384);
});

test('impayés : 4 tranches = total dû, date inconnue en « plus de 60 », Appeler seulement avec un numéro', () => {
  const run = appli(); const t = J(run, 'today()'); const ago = n => J(run, `addDays(today(), -${n})`);
  run(`Object.assign(S.clients, {
    a: { id: 'a', clubId: 'k', name: 'Ana One', balance: 50, balanceAt: '${ago(3)}', phone: '06 11 22 33 44' },
    b: { id: 'b', clubId: 'k', name: 'Bob Two', balance: 30.5, balanceAt: '${ago(20)}' },
    c: { id: 'c', clubId: 'k', name: 'Cid Three', balance: 100, balanceAt: '${ago(45)}', phone: '' },
    d: { id: 'd', clubId: 'k', name: 'Dan Four', balance: 19.5 } }); REV++;`);
  void t;
  const h = run(`dunTable()`);
  const tr = [...h.matchAll(/data-tranche="(\d)" data-v="([\d.]+)"/g)].map(m => Number(m[2]));
  assert.equal(tr.length, 4); assert.equal(Math.round(tr.reduce((s, x) => s + x, 0) * 100) / 100, 200);
  assert.match(h, /Total dû<\/span><b>200 €/);
  assert.equal(J(run, `detteTranche(S.clients.d)`), 3);
  assert.match(h, /data-age="">\s*<span class="muted small">date inconnue/);
  assert.equal((h.match(/data-appel="1"/g) || []).length, 1);
  run(`UI.dunAge = '1'; UI.dunQ = 'bob'`); assert.match(run(`dunTable()`), /Bob Two/);
  run(`UI.dunQ = 'ana'`); assert.doesNotMatch(run(`dunTable()`), /Ana One/);
  run(`UI.dunAge = ''; UI.dunQ = ''; UI.dunFilter = 'nobody'`); assert.match(run(`dunTable()`), /Ana One/);
});
test('impayés : message SMS réglable, tuile dette de plus de 60 jours en rouge au-delà de 20 %', () => {
  const run = appli({ clients: { a: { id: 'a', clubId: 'k', name: 'Ana One', balance: 59.9 }, b: { id: 'b', clubId: 'k', name: 'Bo T', balance: 10, balanceAt: '2099-01-01' } } });
  assert.equal(J(run, `dunSmsTexte(S.clients.a)`), 'Bonjour Ana, votre club vous informe d’un solde de 59,90 €. Vous pouvez le régler à l’accueil ou depuis votre espace adhérent. Merci.');
  run(`S.settings.dunSms = 'Salut {prénom} : {montant} €'; REV++`); assert.equal(J(run, `dunSmsTexte(S.clients.a)`), 'Salut Ana : 59,90 €');
  assert.match(run(`managerCockpit()`), /data-tuile="dette60" data-rouge="true"/);
});

const EMOJI = /\p{Extended_Pictographic}/u;
test('brief : un mardi, « Hier » = somme des saisies du lundi ; un lundi, « Samedi »', () => {
  const run = appli({ kpis: undefined });
  run(`S.kpis.contrats.enabled = true; Object.assign(S.entries, {
    e1: { id: 'e1', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-10-12', value: 2, source: 'manual', at: 1 },
    e2: { id: 'e2', userId: 'u', clubId: 'k', kpiId: 'contrats', date: '2026-10-12', value: 1, source: 'manual', at: 2 },
    e3: { id: 'e3', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-10-10', value: 4, source: 'manual', at: 3 },
    e4: { id: 'e4', userId: 'v', clubId: 'autre', kpiId: 'contrats', date: '2026-10-12', value: 9, source: 'manual', at: 4 } }); REV++;`);
  const mardi = J(run, `(B => ({ v: B.veille, l: B.libVeille, t: B.hier.find(x => x.k.id === 'contrats').total }))(briefJour('k', '2026-10-13'))`);
  const attendu = J(run, `Object.values(S.entries).filter(e => e.clubId === 'k' && e.date === '2026-10-12' && e.kpiId === 'contrats').reduce((s, e) => s + e.value, 0)`);
  assert.deepEqual(mardi, { v: '2026-10-12', l: 'Hier', t: attendu });
  const lundi = J(run, `(B => ({ v: B.veille, l: B.libVeille, t: B.hier.find(x => x.k.id === 'contrats').total }))(briefJour('k', '2026-10-12'))`);
  assert.deepEqual(lundi, { v: '2026-10-10', l: 'Samedi', t: 4 });
});
test('brief : impayés sans import depuis 16 jours en rouge ; texte copié propre et court', () => {
  const run = appli();
  run(`S.rsm.routine = { k: { incidents: dateOf(addDays(today(), -16)).getTime() + 36e5, ventes: Date.now(), clients: dateOf(addDays(today(), -9)).getTime() + 36e5 } }; REV++;`);
  const f = J(run, `fraicheur('k').map(x => [x.cle, x.niveau])`);
  assert.deepEqual(f, [['ventes', 'ok'], ['incidents', 'rouge'], ['clients', 'orange']]);
  run(`S.resiliations.r = { id: 'r', clubId: 'k', client: 'Zoé — Test 🔥', date: today(), status: 'nouvelle', effective: addDays(today(), 3) }; REV++;`);
  const t = run(`briefTexte(briefJour('k'), 'Club 🏋️ — Centre')`);
  assert.ok(t.split('\n').length <= 6); assert.ok(!/[–—]/.test(t)); assert.ok(!EMOJI.test(t));
});
test('Ma journée : à 11 h 05 le bloc Impayés est mis en avant ; pas de clôture du mois le 6', () => {
  const run = appli({ clients: { a: { id: 'a', clubId: 'k', name: 'A', balance: 20 }, b: { id: 'b', clubId: 'k', name: 'B', balance: 30, dunning: { next: '2099-01-01' } } } });
  const B = J(run, `journeeBlocs('k', new Date(2026, 9, 13, 11, 5)).map(b => ({ cle: b.cle, courant: b.courant, chiffre: b.chiffre }))`);
  assert.deepEqual(B.filter(b => b.courant).map(b => b.cle), ['impayes']);
  assert.equal(Number(B.find(b => b.cle === 'impayes').chiffre), J(run, `dunRows('k').filter(dunDue).length`));
  assert.ok(!J(run, `journeeBlocs('k', new Date(2026, 9, 6, 9)).map(b => b.cle)`).includes('mois'));
  assert.ok(J(run, `journeeBlocs('k', new Date(2026, 9, 5, 9)).map(b => b.cle)`).includes('mois'));
  assert.ok(J(run, `journeeBlocs('k', new Date(2026, 9, 12, 9)).map(b => b.cle)`).includes('routine'));
  assert.ok(!J(run, `journeeBlocs('k', new Date(2026, 9, 13, 9)).map(b => b.cle)`).includes('routine'));
});
test('clôture : absent hors « sans saisie », projection 100 au 15 septembre (13 sur 26 jours ouvrés), message court', () => {
  const run = appli();
  assert.equal(J(run, `sansSaisie('k').length`), 2);
  run(`S.absences = { v: { [today()]: true } }; REV++;`); assert.deepEqual(J(run, `sansSaisie('k').map(u => u.id)`), ['u']);
  run(`S.kpis.contrats.required = true; S.kpis.contrats.enabled = true; S.targets['2026-09'] = { v: { contrats: 100 } };
    S.entries.c50 = { id: 'c50', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-09-10', value: 50, source: 'manual', at: 1 }; REV++;`);
  const p = J(run, `(p => ({ proj: p.proj, ec: p.ecoules, tot: p.total, v: p.verdict }))(projectionMois('k', '2026-09', '2026-09-15').find(p => p.k.id === 'contrats'))`);
  assert.deepEqual(p, { proj: 100, ec: 13, tot: 26, v: 'Atteint' });
  const t = run(`clotureTexte('k')`); assert.ok(t.split('\n').length <= 5); assert.ok(!EMOJI.test(t)); assert.ok(!/[–—]/.test(t));
});

test('récap : revenu récurrent de 3 clients = 89,70 € ; commentaire rangé par mois ; mailto court', () => {
  const run = appli({ clients: { a: { id: 'a', clubId: 'k', name: 'A', price: 29.9 }, b: { id: 'b', clubId: 'k', name: 'B', price: 39.9 }, c: { id: 'c', clubId: 'k', name: 'C', price: 19.9 } } });
  const mk = J(run, 'curMonth()');
  assert.equal(J(run, `revenusMois('k', '${mk}').mrr`), 89.7);
  run(`UI.recapMonth = '${mk}'`); assert.match(run('PAGES.recap.render()'), /data-rev="mrr" data-v="89.7"><span>Revenu mensuel récurrent<\/span><b>89,70 €/);
  assert.doesNotMatch(run('PAGES.recap.render()'), /data-estimation/);
  run(`S.recapNotes = { k: { '2026-09': 'Bon mois, priorité aux avis.' } }; UI.recapMonth = '2026-09'`);
  assert.match(run('PAGES.recap.render()'), /Bon mois, priorité aux avis\./);
  run(`UI.recapMonth = '2026-10'`); assert.doesNotMatch(run('PAGES.recap.render()'), /Bon mois, priorité/);
  run(`S.recapNotes.k['2026-09'] = 'x'.repeat(3000)`);
  const t = run(`recapGerantTexte('k', '2026-09')`); assert.ok(t.length <= 1800); assert.ok(t.split('\n').length <= 10);
  run(`for (let i = 0; i < 4; i++) S.clients['n' + i] = { id: 'n' + i, clubId: 'k', name: 'N' + i }; REV++;`);
  run(`UI.recapMonth = '${mk}'`); assert.match(run('PAGES.recap.render()'), /Estimation : prix moyen utilisé/);
});
test('compteur : 384 € sauvés + 120 € récupérés par l’équipe = 504 € + boutique ; hypothèses ; membres exclus', () => {
  const run = appli(); const t = J(run, 'today()');
  run(`S.kpis.nutrition.enabled = true; S.resiliations.r = { id: 'r', clubId: 'k', client: 'X Y', date: today(), status: 'sauvee', saved: true, valeur: 384 };
    S.entries.i1 = { id: 'i1', userId: 'v', clubId: 'k', kpiId: 'impayes', date: today(), value: 120, source: 'manual', at: 1 };
    S.entries.n1 = { id: 'n1', userId: 'v', clubId: 'k', kpiId: 'nutrition', date: today(), value: 45.5, source: 'manual', at: 2 }; REV++;`);
  void t;
  const R = J(run, `rapporteCompteurData('k')`);
  assert.equal(R.sauve, 384); assert.equal(R.impayes, 120); assert.equal(R.total, 504 + R.boutique); assert.equal(R.boutique, 45.5);
  const h = run(`rapporteCompteur('k')`); assert.match(h, /panier moyen de 32 €/); assert.match(h, /x 59 minutes/);
  assert.ok(!/h<\/b>[^]*data-total/.test(h)); assert.equal(Number(h.match(/data-total="([\d.]+)"/)[1]), R.total);
  run(`ME = S.users.v`); assert.equal(run(`rapporteCompteur('k')`), '');
});

test('contrôle de la semaine : 2 000 lignes ou deux fois moins que la semaine précédente = Suspect', () => {
  const run = appli(); const lundi = J(run, 'dateOf(weekStart(today())).getTime()');
  run(`S.rsm.routine = { k: { clients: ${lundi + 3600e3}, ventes: ${lundi + 3600e3}, paiements: ${lundi - 3 * 864e5} } };
    S.rsm.rowsHistory = { k: { clients: [{ at: ${lundi + 3600e3}, rows: 2000 }], ventes: [{ at: ${lundi - 7 * 864e5}, rows: 1000 }, { at: ${lundi + 3600e3}, rows: 400 }] } }; REV++;`);
  const c = J(run, `rsmEtat('k', 'clients')`); assert.equal(c.etat, 'Suspect'); assert.equal(c.message, 'Liste tronquée par Resamania : refaites l’export en deux fois');
  assert.equal(J(run, `rsmEtat('k', 'ventes').etat`), 'Suspect');
  assert.equal(J(run, `rsmEtat('k', 'paiements').etat`), 'Manquant');
  const R = J(run, `routineSemaine('k')`); assert.equal(R.total, 7); assert.equal(R.recus, 2); assert.equal(R.suspects, 2);
  assert.match(run(`rsmControleSemaine('k')`), /data-def="clients" data-etat="Suspect"/);
});
test('un ZIP de 7 CSV lance la revue des 7 fichiers en une fois', async () => {
  const run = chargerAppli(base(), { libs: true }); run(`CLUB = S.clubs.k; ME = S.users.u;`);
  run(`globalThis.__zip = new JSZip(); for (let i = 1; i <= 7; i++) __zip.file('export' + i + '.csv', 'Nom;Montant\\nA;' + i + '\\n');`);
  run(`globalThis.__fin = (async () => { const buf = await __zip.generateAsync({ type: 'uint8array' }); const f = { name: 'semaine.zip', size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) }; await rsmRead([f]); return UI.rsmBatch.length; })()`);
  const n = await run('__fin'); assert.equal(n, 7);
});

test('confiance : saisie manuelle et import du même contrat le 12 = doublon probable ; sans contrôle, pas de pastille', () => {
  const run = appli();
  run(`S.kpis.contrats.enabled = true; S.kpis.avis.enabled = true; S.imports.im = { id: 'im', clubId: 'k', active: true, name: 'ventes.csv', at: 1 };
    S.entries.m = { id: 'm', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-09-12', value: 1, source: 'manual', at: 1 };
    S.entries.i = { id: 'i', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-09-12', value: 1, source: 'import', importId: 'im', at: 2 };
    S.entries.a = { id: 'a', userId: 'v', clubId: 'k', kpiId: 'avis', date: '2026-09-12', value: 3, source: 'manual', at: 3 }; REV++;`);
  const L = J(run, `confianceData('k', '2026-09').lignes.map(l => ({ k: l.k.id, d: l.doublons, p: l.pastille, ref: !!l.ref }))`);
  assert.deepEqual(L.find(x => x.k === 'contrats'), { k: 'contrats', d: 2, p: null, ref: false });
  assert.equal(L.find(x => x.k === 'avis').d, 0);
  run(`UI.confMonth = '2026-09'`); const h = run(`PAGES.confiance.render()`);
  assert.match(h, /pas de contrôle importé/); assert.doesNotMatch(h, /data-pastille="vert"/); assert.match(h, /data-doublons="2"/);
  run(`S.rsm.controls = { k: { perf: { '2026-09': { v: { created: 1 } } } } }; REV++;`);
  const c = J(run, `confianceData('k', '2026-09').lignes.find(l => l.k.id === 'contrats')`); assert.equal(c.pastille, 'vert'); assert.equal(c.fp, 1);
});
test('confiance : moins d’une seconde avec 50 000 saisies', () => {
  const run = appli(); run(`toast = () => {}`); // avertissement « données locales volumineuses », sans écran ici
  run(`for (let i = 0; i < 50000; i++) S.entries['p' + i] = { id: 'p' + i, userId: i % 2 ? 'u' : 'v', clubId: 'k', kpiId: ['contrats', 'avis', 'nutrition'][i % 3], date: '2026-09-' + String(1 + (i % 28)).padStart(2, '0'), value: 1, source: i % 5 ? 'manual' : 'import', at: i }; REV++; idx();`);
  const ms = J(run, `(() => { UI.confMonth = '2026-09'; const t = performance.now(); PAGES.confiance.render(); return performance.now() - t; })()`);
  assert.ok(ms < 1000, ms + ' ms');
});

test('RGPD : après effacement, plus aucune trace du nom hors S.audit (qui ne garde que l’identifiant)', () => {
  const run = appli({ clients: { c1: { id: 'c1', clubId: 'k', name: 'Léa Martin', num: '77', email: 'lea.martin@exemple.fr', phone: '06 12 34 56 78', price: 30, balance: 12, dunning: { note: 'rappeler Léa' } } },
    loyalty: { l1: { id: 'l1', clientId: 'c1', userId: 'v', type: 'suivi', outcome: 'ok', note: 'Léa contente', at: 1 } },
    resiliations: { r1: { id: 'r1', clubId: 'k', client: 'MARTIN Lea', date: '2026-10-01', status: 'nouvelle', log: { a: { at: 1, by: 'v', label: 'Appel', note: 'Lea Martin hésite' } } } },
    chat: { m1: { id: 'm1', userId: 'v', channel: 'k', text: 'J’ai eu Léa Martin au téléphone', at: 1 } },
    entries: { e1: { id: 'e1', userId: 'v', clubId: 'k', kpiId: 'impayes', date: '2026-10-01', value: 12, source: 'manual', clientId: 'c1', clientNum: '77', at: 1 } } });
  run(`confirmDlg = async () => true; toast = () => {};`);
  return run(`effacerAdherent('c1')`).then(() => {
    const json = run(`JSON.stringify({ ...S, audit: null })`);
    for (const t of ['Léa Martin', 'MARTIN Lea', 'Lea Martin', 'lea.martin@exemple.fr', '06 12 34 56 78']) assert.ok(!json.toLowerCase().includes(t.toLowerCase()), t);
    assert.equal(J(run, `S.resiliations.r1.client`), 'Adhérent effacé');
    assert.equal(J(run, `S.clients.c1 || null`), null); assert.equal(J(run, `S.loyalty.l1 || null`), null);
    const a = J(run, `Object.values(S.audit).find(x => x.action === 'erase')`); assert.equal(a.clientId, 'c1'); assert.ok(!JSON.stringify(a).toLowerCase().includes('martin'));
    assert.equal(J(run, `S.entries.e1.value`), 12);
  });
});
test('RGPD : un client sorti il y a 25 mois est purgé au chargement, pas celui sorti il y a 23 mois', () => {
  const run = appli(); run(`toast = () => {};`);
  run(`S.clients.old = { id: 'old', clubId: 'k', name: 'Ancien Membre', end: addDays(today(), -Math.round(25 * 30.44)) };
    S.clients.rec = { id: 'rec', clubId: 'k', name: 'Récent Membre', end: addDays(today(), -Math.round(23 * 30.44)) }; REV++;`);
  assert.equal(J(run, `purgeAuto()`), 1);
  assert.equal(J(run, `[!!S.clients.old, !!S.clients.rec]`).join(), 'false,true');
  assert.equal(J(run, `S.settings.dernierePurge.n`), 1);
});
test('RGPD : onglet réservé aux managers ; registre CSV', () => {
  const run = appli(); run(`UI.clubTab = 'rgpd'`);
  assert.match(run(`PAGES.clubs.render()`), /Ce que Fit Pulse conserve/);
  assert.match(run(`PAGES.clubs.render()`), /Les données de ce navigateur ne sont pas partagées\. Ne l’utilisez pas sur un poste public\./);
  const csv = run(`rgpdRegistreCsv()`); assert.equal(csv.trim().split('\r\n').length, 6); assert.match(csv, /24 mois après la fin du contrat/);
  run(`ME = S.users.v`); assert.doesNotMatch(run(`PAGES.clubs.render()`), /Données et RGPD/);
});

test('adoption : 30 pages en une minute = une seule écriture', () => {
  const run = appli(); run(`ME = S.users.v; globalThis.__n = 0; const s0 = db.set; db.set = (p, v) => { if (p[0] === 'usage') __n++; return s0(p, v); };`);
  run(`for (let i = 0; i < 30; i++) usageNote('page' + (i % 7));`);
  assert.equal(J(run, '__n'), 1);
  run(`clearTimeout(USAGE.timer); USAGE.timer = null;`);
});
test('adoption : connecté lundi, mardi et samedi = 3 jours actifs, pastille orange', () => {
  const run = appli(); const lundi = '2026-10-05';
  run(`S.usage = { v: { '2026-10-05': { opens: 1 }, '2026-10-06': { opens: 2 }, '2026-10-10': { opens: 1 }, '2026-10-11': { opens: 1 } } }; REV++;`);
  const w = J(run, `adoptionSemaine('k', 'v', '${lundi}')`); assert.equal(w.jours, 3); assert.equal(J(run, `niveauJours(${w.jours})`), 'orange');
  assert.equal(J(run, `niveauJours(2)`), 'rouge'); assert.equal(J(run, `niveauJours(4)`), 'vert');
});
test('adoption : le parcours de démarrage disparaît à la 4e étape', () => {
  const run = appli(); run(`ME = S.users.v; S.usage = { v: { [today()]: { opens: 1 } } }; REV++;`);
  assert.match(run(`parcoursCard()`), /Bien démarrer : 1 sur 4/);
  run(`S.entries.x = { id: 'x', userId: 'v', clubId: 'k', kpiId: 'avis', date: today(), value: 1, source: 'manual', at: 1 };
    S.loyalty.l = { id: 'l', userId: 'v', clientId: 'c', type: 'suivi', outcome: 'ok', at: Date.now() }; REV++;`);
  assert.match(run(`parcoursCard()`), /3 sur 4/);
  run(`S.clients.c = { id: 'c', clubId: 'k', name: 'C', balance: 10, dunning: { ownerId: 'v', history: [{ at: Date.now(), by: 'v', label: 'Prise en charge' }] } }; REV++;`);
  assert.equal(run(`parcoursCard()`), '');
  run(`ME = S.users.u`); assert.match(run(`managerCockpit()`), /data-tuile="adoption"/);
});

test('application neutre : aucune enseigne, ville ou personne dans fitpulse.html, hors commentaires de licence', async () => {
  const { execFileSync } = await import('node:child_process'); const { readFileSync, mkdtempSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const path = await import('node:path');
  const out = path.join(mkdtempSync(path.join(tmpdir(), 'neutre-')), 'fitpulse.html');
  execFileSync(process.execPath, [new URL('../outils/build-single.mjs', import.meta.url).pathname, out], { stdio: 'ignore' });
  const L = readFileSync(out, 'utf8').split('\n').filter(l => /Fitness Park|Niort|FPN GESTION|KGUE|GUELLEC/.test(l)).filter(l => !/^\/\*! Fit Pulse ©|^<!-- Fit Pulse ©/.test(l.trim()));
  assert.deepEqual(L, []);
  assert.doesNotMatch(readFileSync(out, 'utf8'), /ACCOUNTS = \[|guellec\.coachingpro/);
});
test('couleur primaire du client : texte posé dessus au contraste AA', () => {
  const run = appli();
  for (const c of ['#1E6FD9', '#12B3A8', '#FFD600', '#222222', '#E11D48']) { const ink = J(run, `encreSur('${c}')`); assert.ok(J(run, `contraste('${c}', '${ink}')`) >= 4.5, c); }
  assert.equal(J(run, `encreSur('#1E6FD9', '#0B0B0C')`), '#FFFFFF'); // noir demandé mais insuffisant : blanc
  assert.equal(J(run, `encreSur('#12B3A8', '#0B0B0C')`), '#0B0B0C');
  run(`S.tenant = { colors: { primary: '#1E6FD9' }, entity: 'SAS Exemple', panierMoyen: 41 }; REV++;`);
  assert.equal(J(run, `couleurClub()`), '#1E6FD9'); assert.equal(J(run, `entiteTexte()`), 'Entité = SAS Exemple'); assert.equal(J(run, `panierMoyen()`), 41);
  run(`S.tenant = {}; REV++;`); assert.equal(J(run, `entiteTexte()`), 'Entité = votre société d’exploitation');
});

test('réglages : décocher le samedi change le rythme et la projection', () => {
  const run = appli();
  run(`S.kpis.contrats.required = true; S.kpis.contrats.enabled = true; S.targets['2026-09'] = { v: { contrats: 100 } };
    S.entries.c50 = { id: 'c50', userId: 'v', clubId: 'k', kpiId: 'contrats', date: '2026-09-10', value: 50, source: 'manual', at: 1 }; REV++;`);
  const avant = J(run, `(p => [p.ecoules, p.total, p.proj])(projectionMois('k', '2026-09', '2026-09-14').find(p => p.k.id === 'contrats'))`);
  const rAvant = J(run, `elapsed(rangeOf('month', curMonth()), 'k')`);
  run(`S.clubs.k.openDays = [1, 2, 3, 4, 5]; REV++;`);
  const apres = J(run, `(p => [p.ecoules, p.total, p.proj])(projectionMois('k', '2026-09', '2026-09-14').find(p => p.k.id === 'contrats'))`);
  const rApres = J(run, `elapsed(rangeOf('month', curMonth()), 'k')`);
  assert.deepEqual(avant.slice(0, 2), [12, 26]); assert.deepEqual(apres.slice(0, 2), [10, 22]); assert.notEqual(apres[2], avant[2]);
  assert.notEqual(rApres, rAvant);
  run(`S.settings.panierMoyen = 50; S.resiliations.r = { id: 'r', clubId: 'k', client: 'Inconnu', date: '2026-09-01', status: 'nouvelle' }; REV++;`);
  assert.equal(J(run, `valeurEnJeu(S.resiliations.r).euros`), 600);
});

test('réversibilité : ZIP de la démo, au moins 7 CSV en UTF-8 avec BOM, formule neutralisée, export manager', async () => {
  const run = chargerAppli(base(), { libs: true }); run(`toast = () => {}; S = normalizeState(demoState()); REV++; CLUB = S.clubs[Object.keys(S.clubs)[0]]; ME = Object.values(S.users).find(u => u.role === 'manager');`);
  run(`const c = Object.values(S.clients).find(x => x.clubId === CLUB.id); c.name = '=HYPERLINK("http://x","clic")'; REV++;`);
  run(`globalThis.__z = (async () => { const z = await exportZip([CLUB.id]); const out = {}; for (const f of Object.keys(z.files)) out[f] = await z.file(f).async('string'); return JSON.stringify(out); })()`);
  const F = JSON.parse(await run('__z'));
  const csv = Object.keys(F).filter(f => f.endsWith('.csv')); assert.ok(csv.length >= 7, csv.join());
  for (const f of csv) { assert.equal(F[f].charCodeAt(0), 0xFEFF, f); assert.ok(F[f].split('\r\n')[0].includes(';'), f); }
  assert.ok(F['LISEZMOI.txt'].includes('clients.csv'));
  assert.match(F['clients.csv'], /^﻿Numéro;Nom;Téléphone;E-mail;Club;Statut;Offre;Prix mensuel;Début;Fin d’engagement;Solde dû;Date du solde/);
  assert.match(F['clients.csv'], /;"'=HYPERLINK\(""http:\/\/x"",""clic""\)";/);
  assert.match(F['saisies.csv'], /\n\d{2}\/\d{2}\/\d{4};/);
  assert.match(F['impayes.csv'], /;\d+,\d{2};/);
  assert.equal(J(run, 'isManager() && !isCreator()'), true);
});

test('mise en route : 1 sur 7 après création, étape 4 au premier import ventes, disparaît pour de bon', () => {
  const run = appli(); run(`S.tenant = { name: 'Club' }; REV++;`);
  assert.equal(J(run, `miseEnRouteEtapes().filter(e => e.fait).length`), 1);
  assert.match(run(`miseEnRouteCard()`), /1 étape sur 7/);
  run(`S.rsm.routine = { k: { ventes: Date.now() } }; REV++;`);
  assert.deepEqual(J(run, `miseEnRouteEtapes().filter(e => e.fait).map(e => e.cle)`), ['club', 'ventes']);
  run(`for (const id of ['a', 'b']) S.users[id] = { id, first: id, last: id, role: 'membre', status: 'active', clubs: ['k'] };
    S.targets[curMonth()] = { v: { contrats: 5 }, a: { contrats: 5 }, b: { contrats: 5 } }; S.kpis.contrats.required = true;
    S.rsm.routine.k.clients = 1; S.rsm.routine.k['clients-incident'] = 1; S.rsm.nonRattaches = { k: { at: 1, n: 0 } }; REV++;`);
  assert.equal(J(run, `miseEnRouteEtapes().filter(e => e.fait).length`), 7);
  assert.equal(run(`miseEnRouteCard()`), '');
  return new Promise(r => setTimeout(r, 20)).then(() => {
    assert.equal(J(run, `pref('miseEnRouteFinie', false)`), true);
    run(`S.rsm.routine.k = {}; REV++;`); assert.equal(run(`miseEnRouteCard()`), '');
  });
});

test('démo vendeur : neutre, scénario de relève des résiliations, identique d’un chargement à l’autre, moins de 3 Mo', () => {
  const run = chargerAppli(base()); run(`toast = () => {}`);
  const a = run('JSON.stringify(demoState())'), b = run('JSON.stringify(demoState())');
  assert.equal(a, b); assert.ok(a.length < 3 * 1024 * 1024, a.length); assert.doesNotMatch(a, /Fitness Park|Niort|GUELLEC|Kévin/);
  run(`S = normalizeState(demoState()); REV++; CLUB = S.clubs.horizon; ME = S.users.u1;`);
  const R = J(run, `({ n: resToHandle('horizon').length, v: resToHandle('horizon').reduce((s, r) => s + resValeur(r), 0), j7: resToHandle('horizon').filter(resUrgent).length, sans: resToHandle('horizon').filter(r => !r.ownerId).length,
    imp: dunRows('horizon').filter(c => Number(c.balance) > 0).length, du: dunRows('horizon').filter(c => Number(c.balance) > 0).reduce((s, c) => s + Number(c.balance), 0), prom: Object.values(S.clients).filter(c => c.dunning && c.dunning.status === 'promesse').length,
    clients: Object.keys(S.clients).length, actifs: Object.values(S.clients).filter(c => c.status === 'Client').length, mois: new Set(Object.values(S.entries).map(e => e.date.slice(0, 7))).size, club: S.clubs.horizon.name + ' ' + S.clubs.horizon.city, dir: fullName(S.users.u1) })`);
  assert.equal(R.n, 5); assert.ok(R.v > 0, R.v); assert.equal(R.sans, 2);
  assert.equal(R.imp, 78); assert.ok(R.du > 3000 && R.du < 3800, R.du); assert.equal(R.prom, 6);
  assert.equal(R.clients, 2000); assert.equal(R.actifs, 1600); assert.equal(R.mois, 13); assert.equal(R.club, 'Club Horizon Valmont'); assert.equal(R.dir, 'Directeur Démo');
  assert.match(run(`PAGES.resiliations.render()`), /À traiter \(5\)/); assert.match(run(`PAGES.resiliations.render()`), /À vérifier \(1\)/);
  const tel = J(run, `Object.values(S.clients).every(c => /^06 39 98 \\d\\d \\d\\d$/.test(c.phone) && /@example\\.com$/.test(c.email))`); assert.ok(tel);
});
test('démo vendeur : les 3 exports d’exemple sont reconnus par l’import', () => {
  const run = chargerAppli(base()); run(`toast = () => {}; S = normalizeState(demoState()); REV++; CLUB = S.clubs.horizon; ME = S.users.u1;`);
  const defs = J(run, `['ventes', 'incidents', 'resiliations'].map(t => { const r = analyzeTable({ name: t + '.csv', ...parseCSV(demoCsv(t)) }, { clubId: 'horizon', month: curMonth() }); return [r.def && r.def.id, r.rowsCount, (r.entries || []).filter(e => e.seller && e.seller.status === 'user').length]; })`);
  assert.equal(defs[0][0], 'ventes'); assert.ok(defs[0][2] > 0 && defs[0][2] === defs[0][1], JSON.stringify(defs[0]));
  assert.equal(defs[1][0], 'clients-incident'); assert.equal(defs[1][1], 78);
  assert.equal(defs[2][0], 'resil'); assert.equal(defs[2][1], 5);
});
