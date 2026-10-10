/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion (Fitness Park Niort). Tous droits réservés. Logiciel protégé (CPI art. L111-1, L112-2, L335-2) : toute reproduction, même partielle, est interdite. */
'use strict';
// ══ FIT PULSE — réversibilité (Club et réglages, managers) ═════════════════
// « Tout exporter en tableur » : un ZIP avec un CSV par collection, lisible tel
// quel dans Excel (UTF-8 avec BOM, « ; », dates JJ/MM/AAAA, virgule décimale) et
// un LISEZMOI.txt qui décrit chaque colonne. Les cellules de texte qui commencent
// par =, +, - ou @ reçoivent une apostrophe (pas de formule exécutée à l'ouverture).
// Version de l'appli, journal des versions (CHANGELOG.md) et état du service.

const csvDate = iso => { const s = String(iso || ''); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
const csvTs = ts => ts ? csvDate(isoOf(new Date(Number(ts)))) : '';
const csvHeure = ts => { if (!ts) return ''; const d = new Date(Number(ts)); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const csvMontant = v => v == null || v === '' || !isFinite(Number(v)) ? '' : (Math.round(Number(v) * 100) / 100).toFixed(2).replace('.', ',');
const csvNombre = v => v == null || v === '' || !isFinite(Number(v)) ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ',');
// Texte : apostrophe devant =, +, - ou @ (injection de formule).
const csvTexte = v => { const s = v == null ? '' : String(v); return /^[=+\-@]/.test(s) ? "'" + s : s; };
const csvCellule = s => /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
// type : 't' texte, 'd' date ISO, 'ts' date d'un horodatage, 'h' heure, 'm' montant, 'n' nombre
function csvFichier(cols, lignes) {
  const f = { t: csvTexte, d: csvDate, ts: csvTs, h: csvHeure, m: csvMontant, n: csvNombre };
  return '﻿' + [cols.map(c => csvCellule(c[0])).join(';'), ...lignes.map(l => cols.map((c, i) => csvCellule(f[c[1]](l[i]))).join(';'))].join('\r\n') + '\r\n';
}
const nomU = id => S.users[id] ? fullName(S.users[id]) : '';
const nomClub = id => (S.clubs[id] || {}).name || id || '';
// Collections exportées : [fichier, description, colonnes [titre, type, description], lignes]
function exportCollections(clubIds) {
  const dans = c => clubIds.includes(c); const clients = Object.values(S.clients || {}).filter(c => c && dans(c.clubId)); const cli = id => S.clients[id] || {};
  const imp = id => (id && S.imports[id]) || null;
  return [
    ['saisies.csv', 'Chaque saisie de KPI, manuelle ou importée.', [['Date', 'd', 'jour de la vente ou de l’action'], ['Club', 't', 'club de la saisie'], ['Commercial', 't', 'prénom et nom'], ['KPI', 't', 'indicateur'], ['Valeur', 'n', 'quantité ou montant en euros selon le KPI'], ['Source', 't', 'Saisie manuelle, Import ou Correction'], ['Fichier d’import', 't', 'nom du fichier Resamania pour une saisie importée'], ['Comptée', 't', 'oui si la saisie compte dans les totaux'], ['Saisie le', 'ts', 'date d’enregistrement'], ['Heure', 'h', 'heure d’enregistrement']],
      Object.values(S.entries || {}).filter(e => e && dans(e.clubId)).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(e => [e.date, nomClub(e.clubId), nomU(e.userId), (S.kpis[e.kpiId] || {}).label || e.kpiId, e.value, e.adjust ? 'Correction' : isImported(e) ? 'Import' : 'Saisie manuelle', (imp(e.importId) || {}).name || '', entryCounts(e) && !replacedByImport(e) ? 'oui' : 'non', e.at, e.at])],
    ['objectifs.csv', 'Objectifs mensuels de chaque commercial.', [['Mois', 't', 'AAAA-MM'], ['Commercial', 't', 'prénom et nom'], ['KPI', 't', 'indicateur'], ['Objectif', 'n', 'quantité ou montant en euros']],
      Object.entries(S.targets || {}).flatMap(([mk, U]) => Object.entries(U || {}).filter(([uid]) => S.users[uid] && (S.users[uid].clubs || []).some(dans)).flatMap(([uid, K]) => Object.entries(K || {}).filter(([, v]) => typeof v === 'number').map(([k, v]) => [mk, nomU(uid), (S.kpis[k] || {}).label || k, v])))],
    ['clients.csv', 'Fiches adhérents importées de Resamania.', [['Numéro', 't', 'numéro d’adhérent Resamania'], ['Nom', 't', 'nom et prénom'], ['Téléphone', 't', ''], ['E-mail', 't', ''], ['Club', 't', ''], ['Statut', 't', 'statut Resamania'], ['Offre', 't', 'formule souscrite'], ['Prix mensuel', 'm', 'euros TTC'], ['Début', 'd', 'début du contrat'], ['Fin d’engagement', 'd', ''], ['Solde dû', 'm', 'euros'], ['Date du solde', 'd', 'date à laquelle le solde est apparu']],
      clients.map(c => [c.num, c.name, c.phone, c.email, nomClub(c.clubId), c.status, c.offer, c.price, c.start, c.end, Number(c.balance) || 0, c.balanceAt])],
    ['relances.csv', 'Appels et messages notés (rétention et contacts).', [['Date', 'ts', ''], ['Heure', 'h', ''], ['Type', 't', 'suivi, renouvellement, impayé, contact…'], ['Client', 't', 'nom de l’adhérent'], ['Commercial', 't', ''], ['Issue', 't', 'résultat noté'], ['Note', 't', 'texte libre']],
      [...Object.values(S.loyalty || {}).filter(a => a && dans(cli(a.clientId).clubId)).map(a => [a.at, a.at, a.type, cli(a.clientId).name, nomU(a.userId), (OUTCOMES[a.outcome] || {}).label || a.outcome, a.note]),
       ...Object.values(S.touches || {}).filter(x => x && (dans(x.clubId) || dans(cli(x.clientId).clubId))).map(x => [x.at, x.at, x.kind || x.channel, cli(x.clientId).name || '', nomU(x.by), x.outcome, x.note])].sort((a, b) => (a[0] || 0) - (b[0] || 0))],
    ['impayes.csv', 'Dossiers d’impayés, en cours et récupérés.', [['Client', 't', ''], ['Numéro', 't', ''], ['Club', 't', ''], ['Montant dû', 'm', 'euros, 0 si soldé'], ['Date du solde', 'd', ''], ['Statut', 't', 'à relancer, promesse, récupéré…'], ['Responsable', 't', ''], ['Prochaine relance', 'd', ''], ['Note', 't', ''], ['Récupéré le', 'd', ''], ['Montant récupéré', 'm', 'euros'], ['Canal', 't', 'équipe, client en ligne, prélèvement…']],
      clients.filter(c => Number(c.balance) > 0 || c.dunning).map(c => { const d = dunOf(c); return [c.name, c.num, nomClub(c.clubId), Number(c.balance) || 0, c.balanceAt, (DUN_STATUS[dunStatus(c)] || {}).label || dunStatus(c), nomU(d.ownerId), d.next, d.note, d.recoveredAt, d.amount, d.canal && RECOV_CHANNELS[d.canal] ? RECOV_CHANNELS[d.canal].label : d.canal]; })],
    ['resiliations.csv', 'Demandes de résiliation et leur issue.', [['Demande du', 'd', ''], ['Client', 't', ''], ['Club', 't', ''], ['Motif', 't', ''], ['Date effective', 'd', ''], ['Statut', 't', 'nouvelle, en traitement, sauvée, résiliée'], ['Responsable', 't', ''], ['Valeur en jeu', 'm', 'euros, prix mensuel x mois restants'], ['Source', 't', 'saisie, Resamania, e-mail']],
      Object.values(S.resiliations || {}).filter(r => r && dans(r.clubId)).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(r => [r.date, r.client, nomClub(r.clubId), r.reason, r.effective, (RES_STATUS[resStatus(r)] || {}).label, nomU(r.ownerId), resValeur(r), r.source || 'saisie'])],
    ['imports.csv', 'Fichiers importés.', [['Date', 'ts', ''], ['Heure', 'h', ''], ['Fichier', 't', ''], ['Type', 't', 'export reconnu'], ['Club', 't', ''], ['Lignes', 'n', 'lignes lues'], ['Actif', 't', 'non si l’import a été annulé'], ['Par', 't', 'qui a importé']],
      Object.values(S.imports || {}).filter(i => i && dans(i.clubId)).sort((a, b) => (a.at || 0) - (b.at || 0)).map(i => [i.at, i.at, i.name, (typeof defById === 'function' && i.defId && defById(i.defId) ? defById(i.defId).label : i.type), nomClub(i.clubId), i.rows, i.active === false ? 'non' : 'oui', nomU(i.by)])],
    ['equipe.csv', 'Membres de l’équipe (sans code ni empreinte).', [['Prénom', 't', ''], ['Nom', 't', ''], ['E-mail', 't', ''], ['Rôle', 't', ''], ['Statut', 't', ''], ['Clubs', 't', '']],
      Object.values(S.users || {}).filter(u => u && !u.virtual && (u.clubs || []).some(dans)).map(u => [u.first, u.last, u.email, roleLabel(u.role), u.status, (u.clubs || []).map(nomClub).join(', ')])],
  ];
}
function lisezmoi(C, clubIds) {
  const L = [`Fit Pulse : export complet, ${clubIds.map(nomClub).join(', ')}`, `Version ${APP.version}, export du ${csvDate(today())}.`, '',
    'Chaque fichier CSV s’ouvre dans Excel ou LibreOffice : encodage UTF-8 avec BOM, séparateur point-virgule, dates JJ/MM/AAAA, montants avec virgule décimale.',
    'Une cellule de texte qui commençait par =, +, - ou @ est précédée d’une apostrophe, pour qu’aucune formule ne s’exécute à l’ouverture.', ''];
  C.forEach(([f, desc, cols, lignes]) => { L.push(`${f} (${lignes.length} lignes) : ${desc}`); cols.forEach(([t, , d]) => L.push(`  - ${t}${d ? ' : ' + d : ''}`)); L.push(''); });
  return L.join('\r\n');
}
async function exportZip(clubIds = myClubs().map(c => c.id)) {
  await loadLib('jszip'); const zip = new JSZip(); const C = exportCollections(clubIds);
  C.forEach(([f, , cols, lignes]) => zip.file(f, csvFichier(cols, lignes)));
  zip.file('LISEZMOI.txt', '﻿' + lisezmoi(C, clubIds));
  return zip;
}
ACTIONS.toutExporter = async el => {
  if (!isManager()) return; if (el) el.disabled = true;
  try { const zip = await exportZip(); const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }); downloadFile(`fit-pulse-export-${norm(CLUB.name).replace(/ /g, '-').slice(0, 30)}-${today()}.zip`, blob, 'application/zip'); db.set(['audit', newId()], { at: Date.now(), by: ME.id, action: 'export-tableur', club: CLUB.id }); toast('1 export prêt'); }
  catch (e) { toast('Export impossible : ' + e.message); } finally { if (el) el.disabled = false; }
};
ACTIONS.journalVersions = async () => {
  let t = ''; try { const r = await fetch('CHANGELOG.md', { cache: 'no-store' }); t = r.ok ? await r.text() : ''; } catch (e) { t = ''; }
  openModal({ title: 'Journal des versions', wide: true, body: t ? `<pre class="changelog">${esc(t)}</pre>` : '<p class="muted">Journal indisponible hors ligne.</p>' });
};
const tailleTexte = n => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;
function clubReversibilite() {
  const taille = new Blob([JSON.stringify(S)]).size; const partage = backend.mode === 'firebase';
  return `<div class="grid">
    <div class="card"><h3>Tout exporter en tableur</h3><p class="muted small">Un fichier ZIP avec un CSV par collection (saisies, objectifs, clients, relances, impayés, résiliations, imports, équipe) et un LISEZMOI.txt qui décrit chaque colonne. Vos données restent les vôtres : cet export suffit pour quitter Fit Pulse.</p>
      <button class="btn primary" data-act="toutExporter">${ico('download')} Tout exporter en tableur</button></div>
    <div class="card"><h3>Version et service</h3><div class="rc-lignes">
      <div class="row small"><span class="spacer">Version de Fit Pulse</span><b data-version="${esc(APP.version)}">${esc(APP.version)}</b></div>
      <div class="row small"><span class="spacer">Mode</span><b>${partage ? 'partagé (base de l’équipe)' : 'local (ce navigateur)'}</b></div>
      <div class="row small"><span class="spacer">Dernière synchronisation réussie</span><b>${partage ? (SYNC.ok ? `${esc(dm(isoOf(new Date(SYNC.ok))))} à ${csvHeure(SYNC.ok)}` : 'pas encore') : 'sans objet en mode local'}</b></div>
      <div class="row small"><span class="spacer">Taille des données</span><b data-taille="${taille}">${tailleTexte(taille)}</b></div></div>
      <button class="btn sm" style="margin-top:10px" data-act="journalVersions">Journal des versions</button></div></div>`;
}
