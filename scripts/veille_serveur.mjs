// ══════════════════════════════════════════════════════════════════════════
//  LA VEILLE DU SERVEUR LÉGER — la décision, sans réseau
// ══════════════════════════════════════════════════════════════════════════
//
//  Appelé par .github/workflows/veille-serveur.yml APRÈS `curl -fsS …/sante`.
//  Il lit ce que curl a rendu (code de sortie, corps) et l'état du passage
//  précédent (gardé par actions/cache), et décide s'il faut écrire à Kevin.
//
//  ON ÉCRIT QUAND :
//    · /sante a échoué (503 : pouls de plus de 5 min, base injoignable ; ou
//      serveur muet) ;
//    · ko > 0 ET plus grand qu'au dernier courriel (un nouvel événement en
//      échec depuis).
//  UNE FOIS PAR HEURE AU PLUS (heure UTC du dernier courriel dans l'état).
//
//  Usage (dans le workflow) :
//    node scripts/veille_serveur.mjs <code-curl> <sante.json> <etat.json> <message.md>
//  Écrit dans $GITHUB_OUTPUT : envoyer=true|false, panne=true|false.
//
//  La fonction `decider` est pure : cloudflare/test/veille.test.mjs l'éprouve.
// ══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const URL_SANTE = 'https://repcore-serveur.repcore.workers.dev/sante';

// `curl` : { code, corps } ; `etat` : { koSignale, mailHeure } ; `t` : ms.
// Rend { panne, envoyer, etat, objet, message }.
export function decider(curl, etat0, t) {
  const etat = Object.assign({ koSignale: 0, mailHeure: null }, etat0 || {});
  let j = null;
  try { j = JSON.parse(String(curl.corps || '')); } catch (e) { j = null; }
  const panne = Number(curl.code) !== 0 || !j || j.ok !== true;
  const ko = j && Number.isFinite(Number(j.ko)) ? Number(j.ko) : null;
  // Des échecs effacés depuis (écran des échecs vidé) : on repart plus bas.
  if (ko !== null && ko < etat.koSignale) etat.koSignale = ko;
  const hausse = ko !== null && ko > 0 && ko > etat.koSignale;
  const heure = new Date(t).toISOString().slice(0, 13);
  const envoyer = (panne || hausse) && etat.mailHeure !== heure;
  let objet = null, message = null;
  if (envoyer) {
    etat.mailHeure = heure;
    if (hausse) etat.koSignale = ko;
    objet = panne ? 'RepCore : le serveur léger ne répond plus correctement' : 'RepCore : ' + ko + ' événement(s) en échec sur le serveur';
    const l = [];
    l.push('# ' + objet, '');
    l.push('Relevé du ' + new Date(t).toISOString().replace('T', ' ').slice(0, 16) + ' UTC, par la veille GitHub (toutes les 15 min).', '');
    if (panne) {
      if (Number(curl.code) !== 0) l.push('- `curl` a échoué (code ' + curl.code + ') : le Worker répond une erreur (503 = pouls de plus de 5 min ou base injoignable), ou ne répond pas.');
      if (j && j.raison) l.push('- Raison donnée par /sante : **' + j.raison + '**.');
      if (j && j.derniereMinuteIlYA_s != null) l.push('- Dernière minute exécutée il y a ' + j.derniereMinuteIlYA_s + ' s.');
      l.push('', 'À regarder : le tableau de bord Cloudflare (Workers > repcore-serveur > Logs, et les déclencheurs « cron »),'
        + ' puis `/sante?cles=1` avec le secret d’administration (mode d’accès à la base, secrets posés).');
    }
    if (hausse) l.push('- **' + ko + '** événement(s) dans `evenements_ko` (écran des échecs de l’app, côté administrateur).');
    if (j && j.file != null) l.push('- File en attente : ' + j.file + '.');
    l.push('', 'Un seul courriel par heure au plus. Corps brut de /sante :', '', '```', String(curl.corps || '(vide)').slice(0, 800), '```', '');
    message = l.join('\n');
  }
  return { panne, envoyer, etat, objet, message };
}

// En ligne de commande (le workflow).
if (import.meta.url === 'file://' + process.argv[1]) {
  const [code, fSante, fEtat, fMessage] = process.argv.slice(2);
  const lire = (f) => { try { return readFileSync(f, 'utf8'); } catch (e) { return ''; } };
  let etat = null;
  try { etat = JSON.parse(lire(fEtat) || 'null'); } catch (e) { etat = null; }
  const d = decider({ code: Number(code), corps: lire(fSante) }, etat, Date.now());
  mkdirSync(dirname(fEtat), { recursive: true });
  writeFileSync(fEtat, JSON.stringify(d.etat));
  if (d.envoyer) { writeFileSync(fMessage, d.message); writeFileSync(fMessage + '.objet', d.objet); }
  const sortie = process.env.GITHUB_OUTPUT;
  if (sortie) appendFileSync(sortie, 'envoyer=' + d.envoyer + '\npanne=' + d.panne + '\n');
  console.log(JSON.stringify({ panne: d.panne, envoyer: d.envoyer, etat: d.etat }));
}
