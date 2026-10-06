const CACHE = 'repcore-v1806';
// ══ L'INSTALLATION NE RETÉLÉCHARGE QUE CE QUI A CHANGÉ (01/10/2026) ══════
// Chaque build retéléchargeait les 141 entrées d'ASSETS avec cache:'reload'
// (~4,8 Mo, images inchangées comprises), et rc-core partait deux fois au
// premier passage : la page le demandait, puis l'install le redemandait. Le
// quota Hosting du plan Spark est de 360 Mo par jour. Désormais l'install
// cherche d'abord une copie dans les anciens caches repcore-v<n>, du plus
// récent au plus ancien :
//   · rc-core.<n>.js, rc-style.<n>.css, rc-theme.<n>.css : MÊME NOM = MÊME CONTENU. Recopié
//     s'il existe ; sinon un fetch NORMAL (le cache HTTP immutable suffit) ;
//   · index.html : toujours cache:'reload' (voir le commentaire du 27/09) ;
//   · tout le reste (images, polices, vendor/, manifest) : recopié si la copie
//     a moins de STATIC_TTL_MS (en-tête 'date' de la réponse rangée), sinon
//     un fetch normal. Une image réécrite SOUS LE MÊME NOM met donc au plus
//     trente jours à arriver — PURGE_EXERCICES reste l'outil pour l'imposer.
const STATIC_TTL_MS = 30 * 24 * 3600 * 1000;
// v1167 - inscription sans impasse, courbes lifestyle, pastilles chiffrees,
// calendrier des bilans. Sans numero neuf, un appareil deja equipe garde
// l'index.html du cache precedent et ne verrait rien de tout cela.
// LA SEULE VERSION QUI NE REPORTE PAS LES ILLUSTRATIONS.
// Le report d'un cache a l'autre traite /exercices/ en PRIORITAIRE : c'est
// ce qui evite de retelecharger 3,3 Mo a chaque deploiement. Mais le
// 25/08/2026, 273 photos ont ete remplacees SOUS LE MEME NOM DE FICHIER,
// depuis le nouveau guide du coach. Reportees, elles auraient masque les
// nouvelles pour toujours chez ceux qui avaient deja ouvert l'app.
// On les laisse donc repartir du reseau — une fois, pour cette version-la.
// Les versions suivantes reprennent le report normal : il suffit que cette
// constante ne vaille plus CACHE.
//
// LE 26/08/2026, MEME CAS : 49 photos de pectoraux reecrites sous leur nom.
// La constante revient donc a CACHE le temps de cette version-ci.
//
// LE 07/09/2026, TROISIEME FOIS : reprise du guide des exercices du coach.
//
// LA v1138 A PURGE POUR RIEN, ET LA LECON VAUT D'ETRE ECRITE. Elle portait
// la tuyauterie des renommages, PAS les nouvelles images : la purge a joue
// sur un dossier identique. Les images n'arrivent que maintenant, avec la
// v1139 — et un client deja passe en v1138 ne repurgerait JAMAIS si on s'en
// tenait a ce numero, puisque c'est le changement de CACHE qui declenche
// activate. Regler PURGE_EXERCICES sans monter CACHE ne purge personne.
//
// 366 illustrations reecrites SOUS LE MEME NOM DE FICHIER, 24 neuves, et le
// dossier passe de 3,3 a 8,2 Mo. La constante valait donc CACHE en v1139.
//
// LE 07/09/2026 ENCORE, v1140 : LES DEUX TAILLES. Les 427 fiches repassent de
// 640 a 900 px SOUS LE MEME NOM — elles etaient floues des qu'on les affichait
// en width:100% dans une modale de 480 px — et 427 vignettes de 256 px
// arrivent dans app/exercices/vignettes/. Meme raison, meme remede : la
// constante vaut CACHE une fois de plus.
//
// ⚠ CES VIGNETTES N'EXISTENT PAS. Le paragraphe ci-dessus les annonce depuis
// le 07/09/2026 et decrit meme comment elles sont reportees et purgees ; le
// dossier app/exercices/vignettes/ n'a jamais ete cree, ni dans le depot ni
// sur le disque. Le seeding qui devait les produire n'a pas tourne, et
// index.html a bascule sur le schema a deux tailles sans elles : chaque ligne
// de liste demandait un fichier absent, prenait un 404, puis se rabattait sur
// la fiche. Constate le 15/09/2026.
//
// index.html est revenu a UNE seule taille — celle qui existe — et n'emet plus
// aucune requete vers vignettes/. Le motif /\/exercices\// reste juste tel
// qu'il est : il couvre le dossier reel, et il couvrirait les vignettes le
// jour ou elles seraient vraiment produites.
//
// ET LA v1141 L'A REMISE A UNE VALEUR ANCIENNE, comme annonce. Les lots qui
// ont suivi ne touchent AUCUNE image — EX_VIDEOS, les methodes
// d'intensification et la video de methode vivent dans index.html. Le dossier
// /exercices/ est donc reporte normalement, et les 12,7 Mo ne repartent pas du
// reseau. La constante ne redeviendra CACHE qu'au prochain reseeding d'images.
// LE 25/09/2026, QUATRIEME FOIS : les photos du guide actuel (6/09/2026),
// filmees par le coach, remplacent 402 illustrations SOUS LE MEME NOM, en
// 927 px de mediane au lieu de 248 (scripts/illustrations_guide.py). La
// constante vaut donc CACHE pour cette version : sans purge, les appareils
// deja equipes garderaient les anciennes images en cache.
// ⚠ ET ELLE EST RESTEE A CACHE DE LA v1556 A LA v1578 — un oubli : chaque
// version a donc repurge les 14 Mo d'illustrations chez tous les athletes.
// Remise a la valeur de la v1556 le 26/09/2026 : le report normal reprend.
const PURGE_EXERCICES = 'repcore-v1556';
const SW_DATA = 'repcore-sw-data'; // persistent across updates — not wiped by activate

// DÉLAI DE GARDE sur index.html. Le handler était en network-first avec un
// simple .catch() : celui-ci ne joue que sur ÉCHEC, jamais sur LENTEUR. En
// « lie-fi » — un réseau qui répond au DNS et ne transporte rien — la promesse
// ne rejette pas, elle PEND, et l'athlète en sous-sol regarde un écran blanc
// aussi longtemps que le navigateur tolère la requête.
const SW_DELAI_RESEAU_MS = 2500;

// index.html EST dans ASSETS depuis ce lot. Sans lui, la copie hors-ligne ne
// se constituait qu'au premier passage réussi du handler fetch, et activate la
// détruisait à chaque déploiement.
// vendor/qr.js et les deux polices : rapatries pour supprimer trois tiers.
// Ils entrent dans ASSETS car ils sont demandes au PREMIER affichage — une
// police absente donne un texte de repli, un encodeur absent donne un QR
// absent. pdf.min.js et le moteur de lecture des captures, eux, sont charges
// dynamiquement : ils rejoignent le cache par le handler fetch au premier
// usage, et y restent pour le suivant, hors ligne compris. Cela n a ete VRAI
// qu a partir du lot qui a ajoute le put dans la branche generique du handler :
// avant lui, celle-ci lisait le cache sans jamais l alimenter.
// Le temps que le report de cache a le droit de prendre dans activate, qui
// retient la prise de contrôle. Au-delà, on laisse le reste au handler fetch.
const REPORT_BUDGET_MS = 1000;
// LES VINGT-HUIT AVATARS DE PROGRESSION ENTRENT DANS LA LISTE — face et dos. Ils sont demandés
// pendant la séance, c'est-à-dire souvent en salle, c'est-à-dire souvent sans
// réseau : laissés au handler fetch, une première séance commencée hors ligne
// n'aurait affiché aucun personnage. 123 ko pour les quatorze — le coût est
// sans commune mesure avec le défaut.
const AVATARS = [];
for (let n = 1; n <= 7; n++) for (const g of ['h', 'f']) for (const v of ['', '-dos'])
  AVATARS.push('./icons/avatar/n' + n + '-' + g + v + '.png');
// './img/arn.png' EST DANS LA LISTE, et elle y a sa place : elle est demandee
// au PREMIER affichage de « Mes seances », comme les polices le sont a
// l ouverture. Sans elle, un athlete hors ligne verrait la carte de citation
// se rendre sans sa photo — le onerror la retirerait, silencieusement, et il
// n aurait aucune raison de comprendre pourquoi.
// LES QUINZE MEDAILLONS. Ils etaient laissés au handler fetch, et le
// commentaire de LISEZ-MOI l'expliquait par leur poids : 1,2 Mo pour les
// quinze. Ils en pesent 221 ko depuis leur reindexation sur 96 couleurs, soit
// moins que les vingt-huit avatars qui sont dans la liste depuis toujours.
//
// Le raisonnement d'AVATARS s'applique alors mot pour mot : ils sont demandes
// A LA FIN D'UNE SEANCE, c'est-a-dire souvent en salle, c'est-a-dire souvent
// sans reseau. Sans eux l'ecran de fin retombait sur les glyphes au trait —
// il restait complet, mais la recompense dessinee n'arrivait jamais au seul
// moment ou elle compte. La carte « Mes badges » du profil les demande aussi.
const MEDAILLONS = ['new_record', 'multiple_records', 'new_load', 'personal_best',
  'new_perf', 'progression', 'monster', 'high_volume', 'no_mercy', 'full_session',
  'no_fail', 'perfect', 'streak', 'return', 'discipline']
  .map(n => './img/badges/' + n + '.png');
// LA COLLECTION (26/09/2026) : les médaillons 184×200 de la vitrine « Mes
// badges » et de la bannière. Liste réécrite par scripts/badges.py entre les
// deux marqueurs — ne pas l'éditer à la main. Les 512 px n'y sont pas : ils ne
// servent qu'à la fiche et au partage, et 2 Mo de plus à chaque installation
// ne se justifient pas pour un geste rare.
// LES DIX EMBLÈMES DE RANG (les « volts »), aux deux tailles : l'écran de
// passage de rang peut tomber en fin de séance, hors ligne. Liste écrite par
// scripts/rangs.py entre ses deux marqueurs — ne pas l'éditer à la main.
// rangs.py:debut
const EMBLEMES_RANGS = Array.from({ length: 10 }, (_, i) => i + 1)
  .flatMap(n => ['./img/rangs/rang_' + n + '.webp', './img/rangs/rang_' + n + '-512.webp']);
// rangs.py:fin
// badges.py:debut
const MEDAILLONS_COLLECTION = [
  'tonnage_1', 'tonnage_2', 'tonnage_3', 'tonnage_4', 'verrouille'
]
  .map(n => './img/badges/' + n + '.webp');
// badges.py:fin
// LES QUATRE SILHOUETTES DU CADRE « EVOLUTION ELEVE » de la fiche coach
// (140 ko) : le coach ouvre une fiche en salle aussi, et sans elles le cadre
// sortirait sans corps, les etiquettes pointant dans le vide.
// Et leurs quatre cartes de zones musculaires (37 ko), lues pour peindre la
// charge de la semaine par muscle.
const CORPS = ['h-face', 'h-dos', 'f-face', 'f-dos']
  .flatMap(n => ['./img/corps/' + n + '.webp', './img/corps/z-' + n + '.png']);
// La photo de fond de la demande de video, fiche coach (4 ko).
CORPS.push('./img/demande-video.webp');
// La photo de fond de la diete respectee, fiche coach (1 ko).
CORPS.push('./img/diete-respectee.webp');
// LA PLANCHE DES SOIXANTE VIGNETTES DE COMPLEMENTS (85 ko), une seule image.
// Le plan de complements se consulte au moment de la prise — le matin, en
// salle, souvent sans reseau — et sans elle chaque carte perdrait sa vignette.
CORPS.push('./img/complements.webp');
// LES SIX IMAGES DES CARTES PAS ET SOMMEIL DE LIFESTYLE (70 ko), decoupees dans
// les maquettes de Kevin : deux decors et quatre telephones.
['rep-pas','rep-som','tel-m-pas','tel-c-pas','tel-m-som','tel-c-som']
  .forEach(n => CORPS.push('./img/lifestyle/' + n + '.webp'));
// LES DIX LOGOS DE « MODIFIER MA SOURCE » (17 ko), decoupes dans la maquette.
['apple','google','garmin','samsung','huawei','fitbit','xiaomi','amazfit','polar','coros']
  .forEach(n => CORPS.push('./img/sources/' + n + '.webp'));
// LES SEIZE LOGOS DE « MES APPAREILS » (40 ko), decoupes dans la maquette.
['apple','garmin','samsung','google','huawei','fitbit','xiaomi','amazfit','polar','coros',
  'suunto','whoop','oura','withings','casio','autre']
  .forEach(n => CORPS.push('./img/appareils/' + n + '.webp'));
// LES DIX-HUIT MUSCLES DE L'ONGLET VOLUME (88 ko), decoupes dans la planche
// de Kevin et teintes a la couleur de chaque muscle.
['pectoraux','dorsaux','trap-sup','trap-med','lombaires','delt-ant','delt-lat','delt-post',
  'biceps','triceps','avant-bras','quadriceps','ischios','fessiers','abducteurs','adducteurs',
  'mollets','abdos']
  .forEach(n => CORPS.push('./img/muscles/' + n + '.webp'));
// ⚠ LES DEUX ACTIFS VERSIONNES (build 1417). Le code et la feuille de styles
// ne sont plus dans index.html : ils sont servis sous un nom qui porte le
// numero de build, avec un cache d'un an et `immutable`. Ils DOIVENT entrer
// ici : sans eux, la premiere ouverture hors ligne apres installation n'aurait
// ni code ni style — c'est-a-dire rien du tout.
// Leur nom est tenu a jour par scripts/versionner_actifs.py, qui les renomme a
// chaque build et reecrit cette ligne comme celle d'index.html.
const ASSETS = ['./index.html', './rc-core.1806.js', './rc-style.1806.css', './rc-theme.1806.css',
  './manifest.json', './icons/icon-192x192.png',
  './vendor/qr.js', './vendor/rc-video.js',
  // LES DEUX COPIES FIGEES MP4. En cache des l installation : une seance se
  // filme souvent dans une salle sans reseau, et une compression qui echoue
  // faute de script fait partir 170 Mo par la voie 3.
  './vendor/mp4/mp4box.all.min.js', './vendor/mp4/mp4-muxer.js',
  './fonts/montserrat-var-latin.woff2',
  './fonts/bebasneue-400-latin.woff2', './img/arn.png']
  .concat(AVATARS).concat(MEDAILLONS).concat(MEDAILLONS_COLLECTION).concat(EMBLEMES_RANGS).concat(CORPS);

// Une séance en cours interdit la bascule. Prendre le contrôle en pleine
// séance, c'est purger le cache sous les pieds de quelqu'un qui est peut-être
// hors ligne.
//
// L'ÉTAT VIT DANS LE CACHE PARTAGÉ, ET NON DANS UNE VARIABLE DE MODULE.
//
// Une variable appartient au worker qui l'a déclarée. Le client levait le
// drapeau en postant au worker ACTIF, alors que le handler `install` du worker
// EN COURS D'INSTALLATION lisait SA copie, restée à false : skipWaiting()
// partait à chaque fois, et le garde-fou n'a jamais rien gardé.
//
// repcore-sw-data est le seul support que les deux workers voient. Il survit
// aux mises à jour, et activate l'épargne explicitement.
const SEANCE_CLE = '/seance-en-cours';
// QUATRE HEURES. Un drapeau plus vieux décrit une séance jamais terminée —
// l'app fermée en plein milieu, le téléphone éteint. Le respecter
// indéfiniment bloquerait TOUTES les mises à jour, pour toujours ; l'ignorer
// ramène ce cas-là au comportement d'avant, qui n'était pas pire.
const SEANCE_PEREMPTION_MS = 4 * 3600 * 1000;
// `_attenteFinSeance`, LUI, reste une variable de module — et c'est correct :
// il décrit ce que CE worker-ci a décidé de retenir, pas un état du monde.
let _attenteFinSeance = false;
async function seanceActive() {
  const s = await swGet(SEANCE_CLE);
  const d = s && Number(s.depuis);
  if (!d) return false;
  return (Date.now() - d) < SEANCE_PEREMPTION_MS;
}

self.addEventListener('install', e => {
  // TOUT est dans le waitUntil, y compris la décision de basculer : la lecture
  // de l'état est asynchrone, et une décision prise hors du waitUntil serait
  // prise avant que la réponse n'arrive.
  e.waitUntil((async () => {
    // allSettled et non addAll : un asset manquant ou en erreur ne doit plus
    // faire échouer toute l'installation du Service Worker.
    try {
      const c = await caches.open(CACHE);
      // LES ANCIENS CACHES, du plus récent au plus ancien (STATIC_TTL_MS, en tête).
      const _num = k => Number((k.match(/(\d+)$/) || [])[1]) || 0;
      const anciens = [];
      for (const k of (await caches.keys()).filter(k => /^repcore-v\d+$/.test(k) && k !== CACHE).sort((x, y) => _num(y) - _num(x))) {
        try { anciens.push(await caches.open(k)); } catch (err) {}
      }
      const _copie = async (a, accepter) => {
        for (const v of anciens) {
          try { const r = await v.match(a); if (r && r.ok && accepter(r)) return r; } catch (err) {}
        }
        return null;
      };
      const _fraiche = r => {
        const d = Date.parse((r.headers && r.headers.get('date')) || '');
        return d > 0 && Date.now() - d < STATIC_TTL_MS;
      };
      const _actifVersionne = a => /\/rc-(core|style|theme)\.\d+\.(js|css)$/.test(a);
      await Promise.allSettled(ASSETS.map(async a => {
        if (/index\.html$/.test(a)) {
          // cache:'reload' : SANS LE CACHE DU NAVIGATEUR (27/09/2026). GitHub
          // Pages sert index.html avec max-age=600 : un worker neuf installe dans
          // ces dix minutes rangeait l'ANCIENNE page dans le cache NEUF.
          return c.add(new Request(a, { cache: 'reload' }));
        }
        const vieille = await _copie(a, _actifVersionne(a) ? () => true : _fraiche);
        if (vieille) return c.put(a, vieille);
        return c.add(a);
      }));
    } catch (err) {}
    // Sans séance en cours, comportement inchangé : la mise à jour est
    // immédiate. Avec, on retient la bascule jusqu'à SEANCE_TERMINEE.
    if (await seanceActive()) _attenteFinSeance = true;
    else self.skipWaiting();
  })());
});

// Préchargement différé et non bloquant de la base alimentaire (672 Ko).
// index.html poste ce message au premier affichage de l'écran nutrition :
// la recherche d'aliment fonctionne alors hors-ligne aux visites suivantes,
// sans peser sur le tout premier chargement de l'app.
const CIQUAL_URL = './data/ciqual.json';
// LA VERSION DE LA BASE, À CHANGER À CHAQUE RÉGÉNÉRATION DE ciqual.json
// (30/09/2026). L'URL ne change pas, et la base est REPORTÉE d'un cache à
// l'autre à chaque mise à jour : sans version, un athlète déjà installé
// gardait l'ancienne pour toujours (ni whey, ni énergie calculée). Le marqueur
// vit à côté, sous CIQUAL_VERSION_URL ; une base d'une autre version n'est
// plus reportée, et le préchargement la retélécharge.
const CIQUAL_VERSION = '2026-09-30';
const CIQUAL_VERSION_URL = './data/ciqual.version';
async function _ciqualAJour(c) {
  try { const r = await c.match(CIQUAL_VERSION_URL); return !!(r && (await r.text()) === CIQUAL_VERSION); }
  catch (err) { return false; }
}
let _ciqualPrefetch = null;
self.addEventListener('message', e => {
  // Séance en cours : on retient la bascule. À la fin, si CE worker attendait,
  // il prend la main immédiatement — l'utilisateur n'a rien à faire.
  //
  // L'écriture passe par le cache partagé, jamais par une variable : c'est là
  // que le prochain `install` viendra lire. La page écrit la même clé de son
  // côté ; les deux chemins mènent au même endroit, ce qui est tout le point.
  if (e.data?.type === 'SEANCE_EN_COURS') {
    e.waitUntil(swSet(SEANCE_CLE, { depuis: Date.now() }));
    return;
  }
  if (e.data?.type === 'SEANCE_TERMINEE') {
    e.waitUntil((async () => {
      await swSet(SEANCE_CLE, null);
      if (_attenteFinSeance) { _attenteFinSeance = false; self.skipWaiting(); }
      // Le worker ACTIF, lui, n'a rien retenu : c'est update() qui redemande
      // au navigateur d'aller chercher sw.js, donc de relancer un `install`
      // qui, cette fois, ne verra plus de séance. Sans lui, la bascule
      // retenue attendait la fermeture de tous les onglets.
      try { await self.registration.update(); } catch (err) {}
    })());
    return;
  }
  if (e.data?.type !== 'PREFETCH_CIQUAL') return;
  if (_ciqualPrefetch) return;            // une seule tentative par cycle de vie du SW
  _ciqualPrefetch = caches.open(CACHE)
    .then(async c => {
      if ((await c.match(CIQUAL_URL)) && (await _ciqualAJour(c))) return;   // à jour : rien à faire
      // cache:'reload' : pas la copie du cache HTTP, celle du serveur.
      await c.add(new Request(CIQUAL_URL, { cache: 'reload' }));
      await c.put(CIQUAL_VERSION_URL, new Response(CIQUAL_VERSION));
    })
    .catch(() => { _ciqualPrefetch = null; }); // échec (hors ligne) : réessayable
});

// ACTIVATION. L'ancienne version supprimait TOUT cache dont le nom différait,
// sans regarder ce que le nouveau contenait. Or activate s'exécute avant que
// le nouveau cache porte autre chose que les ASSETS : chaque déploiement
// détruisait la copie hors-ligne d'index.html ET les 852 Ko de Ciqual, que
// rien ne remplaçait tant que l'utilisateur n'avait pas rouvert l'écran
// nutrition EN LIGNE.
//
// Deux changements : on RECOPIE Ciqual de l'ancien cache vers le nouveau
// (852 Ko économisés par déploiement, et il survit hors ligne), et on ne
// supprime un ancien cache QUE si le nouveau porte bien index.html. Sinon on
// le garde un cycle de plus : un cache de trop coûte de la place, un cache
// manquant coûte l'application.
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    try {
      const neuf = await caches.open(CACHE);
      const cles = await caches.keys();
      const anciens = cles.filter(k => k !== CACHE && k !== SW_DATA);
      // 1. REPORT GENERAL. Deux entrées seulement étaient reportées, et tout le
      //    reste du cache hors ligne partait à la purge : pdf.min.js, le moteur
      //    de reconnaissance et ses données, zxing, et les 407 illustrations
      //    d'exercices déjà vues. Le commentaire d'ASSETS affirme pourtant que
      //    ces fichiers restent « pour le suivant, hors ligne compris ».
      //
      //    DU PLUS RÉCENT AU PLUS ANCIEN, première occurrence gagnante : quand
      //    plusieurs anciens caches ont survécu, le plus récent porte la version
      //    la plus juste.
      //
      //    ON NE REMPLACE JAMAIS ce que le nouveau cache porte déjà : ASSETS
      //    vient d'être téléchargé, il fait foi.
      //
      //    BUDGET DE TEMPS. activate retient la prise de contrôle : recopier
      //    15 Mo sur un téléphone lent ne doit pas la bloquer. On trie par
      //    valeur — vendor/ et exercices/ sont les plus coûteux à retélécharger
      //    — et on s'arrête quand le budget est épuisé. Ce qui reste sera repris
      //    par le handler fetch au premier usage, exactement comme avant.
      const _t0 = Date.now();
      let _reportes = 0, _sautes = 0, _octets = 0, _inconnus = 0;
      // La taille se lit dans l'en-tête, jamais en relisant le corps :
      // relire 15 Mo pour les mesurer coûterait le budget qu'on tient.
      const _taille = r => {
        try { return Number(r.headers.get('content-length')) || 0; }
        catch (err) { return 0; }
      };
      const _lisible = n => n >= 1048576 ? (n / 1048576).toFixed(1) + ' Mo'
        : n >= 1024 ? Math.round(n / 1024) + ' Ko' : n + ' o';
      const _prioritaire = u => /\/vendor\/|\/exercices\//.test(u);
      // index.html est traité juste en dessous, en réseau-d'abord ; tests.js ne
      // doit JAMAIS être mis en cache d'office — il n'est pas dans ASSETS pour
      // cette raison, et le reporter le remettrait par la porte de derrière.
      //
      // sw.js NON PLUS. versionSW() le lit pour afficher la version du cache ;
      // le transporter d'une version à l'autre lui faisait annoncer la
      // PRÉCÉDENTE. C'est aussi le seul fichier dont une copie périmée se
      // recopierait indéfiniment : chaque report la reconduirait.
      //
      // database.rules.json REJOINT LA LISTE. Il n'a jamais eu sa place dans un
      // cache — la suite le lit pour comparer les regles de la base au code — et
      // depuis que le handler fetch le laisse au reseau, aucune version neuve ne
      // peut plus en contenir. Mais un cache d'AVANT ce lot en garde une copie,
      // et sans cette ligne le report la ferait passer de version en version,
      // indefiniment, pour un fichier que plus personne ne lira jamais.
      //
      // motion-lab.js?v=<build> SE REPORTE DESORMAIS (01/10/2026), comme les
      // actifs rc-* : rc-core le demande avec ?v=<build>, et la version
      // COURANTE reportee evite 660 Ko de reseau a la premiere ouverture du
      // Motion Lab apres chaque mise a jour. Les AUTRES versions sont gardees
      // ou purgees par la meme regle que rc-* (_versionActif, juste en
      // dessous) : la courante et la precedente, pas plus.
      // ══ LES ACTIFS VERSIONNES : LA COURANTE ET LA PRECEDENTE, PAS PLUS ══
      //
      // rc-core.<build>.js pese 5,5 Mo. Le report general recopie tout ce qu'un
      // ancien cache porte : sans garde, chaque mise a jour EMPILERAIT une
      // version de plus sur le telephone — dix builds, 55 Mo, pour du code que
      // plus aucune page ne demande.
      //
      // ON EN GARDE DEUX, et c'est delibere : la courante, et celle d'avant.
      // Un appareil qui a encore l'ancien index.html en memoire (page ouverte
      // avant la mise a jour) demande encore l'ancien nom ; le lui retirer le
      // laisserait sans code jusqu'au rechargement, hors ligne compris.
      const _ACTIF = /\/rc-(?:core|style|theme)\.(\d+)\.(?:js|css)$/;
      // motion-lab.js?v=<build> : meme numero, meme regle de garde.
      const _ML = /\/motion-lab\.js\?(?:[^#]*&)?v=(\d+)(?:&|#|$)/;
      const _versionActif = u => {
        const m = String(u).match(_ACTIF) || String(u).match(_ML);
        return m ? Number(m[1]) : null;
      };
      const _versionsVues = new Set();
      { const m = CACHE.match(/(\d+)/); if (m) _versionsVues.add(Number(m[1])); }
      for (const k of anciens) {
        try {
          const c = await caches.open(k);
          for (const rq of await c.keys()) {
            const v = _versionActif(rq.url);
            if (v !== null) _versionsVues.add(v);
          }
        } catch (err) {}
      }
      const _gardees = [..._versionsVues].sort((a, b) => b - a).slice(0, 2);
      const _actifGarde = u => { const v = _versionActif(u); return v === null || _gardees.indexOf(v) >= 0; };
      // data/ciqual.* : la base alimentaire a son propre report, gardé par sa
      // version (plus bas) ; la boucle générique la ramènerait telle quelle.
      const _exclu = u => !_actifGarde(u)
        || /\/index\.html$/.test(u) || /\/tests\.js$/.test(u)
        || /\/sw\.js$/.test(u) || /\/database\.rules\.json$/.test(u)
        || /\/data\/ciqual\.(json|version)$/.test(u)
        || (PURGE_EXERCICES === CACHE && /\/exercices\//.test(u));
      // LA BASE ALIMENTAIRE D'ABORD, ET HORS BUDGET. Elle n'entre dans le
      // cache que par un prefetch explicite, et le report ne la connaissait
      // pas : elle passait après vendor/ et les 407 illustrations, donc
      // souvent jamais. À chaque mise à jour la recherche d'aliment
      // redevenait indisponible hors ligne et 672 Ko repartaient sur le
      // réseau. C'est une entrée unique et connue : la faire concourir dans
      // un tri ne garantirait rien.
      //
      // put/clone, jamais add : add irait la rechercher sur le réseau.
      // `_ciqual` dit qu'elle a été REPORTÉE, pas qu'elle avait une taille
      // connue : une entrée sans content-length est reportée quand même, et le
      // journal doit le dire.
      let _ciqual = false;
      if (!(await neuf.match(CIQUAL_URL))) {
        for (let i = anciens.length - 1; i >= 0; i--) {
          try {
            const vieux = await caches.open(anciens[i]);
            const r = await vieux.match(CIQUAL_URL);
            // Une base d'une AUTRE version ne se reporte pas : elle se retélécharge.
            if (r && (await _ciqualAJour(vieux))) {
              await neuf.put(CIQUAL_URL, r.clone());
              await neuf.put(CIQUAL_VERSION_URL, new Response(CIQUAL_VERSION));
              _ciqual = true; _reportes++;
              const _n = _taille(r);
              if (_n) _octets += _n; else _inconnus++;
              break;
            }
          } catch (err) {}
        }
      }
      for (let i = anciens.length - 1; i >= 0; i--) {
        try {
          const vieux = await caches.open(anciens[i]);
          const req = await vieux.keys();
          const tri = req.slice().sort((a, b) =>
            (_prioritaire(b.url) ? 1 : 0) - (_prioritaire(a.url) ? 1 : 0));
          for (const rq of tri) {
            if (_exclu(rq.url)) continue;
            if (Date.now() - _t0 > REPORT_BUDGET_MS) { _sautes++; continue; }
            try {
              if (await neuf.match(rq)) continue;
              const r = await vieux.match(rq);
              if (r) {
                await neuf.put(rq, r.clone()); _reportes++;
                const _n = _taille(r);
                if (_n) _octets += _n; else _inconnus++;
              }
            } catch (err) {}
          }
        } catch (err) {}
      }
      // ══ PURGE DES ACTIFS PERIMES, DANS LE CACHE NEUF ═══════════════════
      // Le report ne peut plus en amener (voir _exclu), mais un cache deja
      // constitue avant ce lot en porte, et le handler fetch a pu en ajouter.
      // On les retire ici : c'est le seul moment ou personne ne les lit.
      let _purges = 0, _octetsPurges = 0;
      try {
        for (const rq of await neuf.keys()) {
          if (_actifGarde(rq.url)) continue;
          try {
            const r = await neuf.match(rq);
            if (r) _octetsPurges += _taille(r);
            await neuf.delete(rq);
            _purges++;
          } catch (err) {}
        }
      } catch (err) {}
      if (_purges) console.log('[RepCore SW] actifs perimes retires :', _purges,
        'fichier(s),', _lisible(_octetsPurges), '— versions gardees :', _gardees.join(', '));
      // ON DIT CE QU'ON N'A PAS FAIT. Un report tronqué en silence se lirait
      // comme un cache complet, et la prochaine ouverture hors ligne serait une
      // surprise.
      console.log('[RepCore SW] report cache :', _reportes, 'entrées,',
        _lisible(_octets) + (_inconnus ? ' (+ ' + _inconnus + ' sans taille connue)' : ''),
        'en ' + (Date.now() - _t0) + ' ms'
        + (_sautes ? ', ' + _sautes + ' hors budget' : '')
        + (_ciqual ? ', base alimentaire comprise' : ''));
      // 2. Report d'index.html si ASSETS a échoué (hors ligne à l'install).
      if (!(await neuf.match('./index.html'))) {
        for (const k of anciens) {
          try {
            const vieux = await caches.open(k);
            const r = await vieux.match('./index.html');
            if (r) { await neuf.put('./index.html', r.clone()); break; }
          } catch (err) {}
        }
      }
      // ⚠ 2 bis. LE DOCUMENT REPORTE VIENT D'UNE AUTRE VERSION, PAR
      //    CONSTRUCTION. Le report ci-dessus existe pour une bonne raison —
      //    une installation hors ligne n'a pas pu telecharger index.html — mais
      //    il place le document d'HIER dans le cache d'AUJOURD'HUI. La branche
      //    index.html du fetch le sert alors des que le reseau met plus de
      //    2 500 ms a repondre : le worker annonce la version du jour, et
      //    l'ecran affiche celle d'avant. Rien, nulle part, ne le signalait.
      //
      //    ON LE VERIFIE DONC, ET C'EST EXACT : le document porte son propre
      //    numero, `window.RC_BUILD='1234'`, et le cache porte le sien dans son
      //    nom. Deux numeros differents = un document etranger : on le RETIRE
      //    plutot que de le servir. Le prochain chargement ira au reseau —
      //    `if (!enCache) return reseau` attend alors le temps qu'il faut,
      //    quel qu'il soit, ce qui est le bon comportement pour un document
      //    dont on n'a aucune copie valable.
      try {
        const doc = await neuf.match('./index.html');
        if (doc) {
          const attendu = (CACHE.match(/(\d+)/) || [])[1] || '';
          const txt = await doc.clone().text();
          const vu = (txt.match(/RC_BUILD\s*=\s*'(\d+)'/) || [])[1] || '';
          if (attendu && vu && vu !== attendu) {
            console.warn('[RepCore SW] document en cache en version', vu,
              'alors que le worker est en', attendu, '— on le retire');
            await neuf.delete('./index.html');
          }
        }
      } catch (err) { console.warn('[RepCore SW] verif version du document :', err); }
      // 3. Purge SOUS CONDITION. Le nouveau cache doit être utilisable.
      if (await neuf.match('./index.html')) {
        await Promise.all(anciens.map(k => caches.delete(k)));
      } else {
        console.warn('[RepCore SW] index.html absent du cache', CACHE,
          '— anciens caches conservés un cycle de plus');
      }
      // ⚠ ET ON PREVIENT LES ONGLETS DEJA OUVERTS. C'est la lecon des 19 et
      //    20/09/2026 : une application laissee ouverte ne rechargeait jamais,
      //    donc ne recevait jamais rien — six versions publiees, aucune vue, et
      //    rien a l'ecran pour le dire. `controllerchange` ne suffit pas : il
      //    ne se declenche que si le client n'avait pas deja un controleur.
      //    Le message, lui, part a TOUS les onglets de ce domaine, et c'est le
      //    client qui decide s'il peut recharger — jamais sous les doigts de
      //    quelqu'un qui saisit un bilan.
      try {
        const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const f of fenetres) {
          try { f.postMessage({ rc: 'maj', version: CACHE }); } catch (err) {}
        }
      } catch (err) {}
    } catch (err) { console.error('[RepCore SW] activate:', err); }
  })());
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  // Ne jamais intercepter les requêtes cross-origin (Firebase, Cloud Functions, Realtime DB…)
  // Sinon le SW renverrait index.html (HTML) en fallback offline, ce qui fait planter
  // tout appel fetch() qui attend du JSON — notamment generateAccessToken.
  if (!url.startsWith(self.location.origin)) return;
  // index.html : network-first AVEC DÉLAI DE GARDE. Toujours pas cache-first —
  // la mise à jour doit rester rapide — mais le réseau ne peut plus retenir
  // l'affichage au-delà de SW_DELAI_RESEAU_MS quand une copie existe.
  // ⚠ /i EST UNE NOUVELLE ENTREE DE CACHE, et c'est le piege de cette route.
  // Le handler met en cache PAR URL : sans cette ligne, /i tombait dans la
  // branche generique — cache-first, sans mise a jour reseau — et quiconque
  // entre par le lien court restait sur la version du jour de sa premiere
  // visite, indefiniment. Il sert index.html : il doit etre traite comme lui,
  // en reseau-d'abord avec le meme delai de garde.
  //
  // On compare le CHEMIN, pas la fin de l'URL : endsWith('/i') attraperait
  // aussi n'importe quel fichier nomme « i » ailleurs sur le site.
  const _chemin0 = (() => { try { return new URL(url).pathname; } catch (e) { return ''; } })();
  if (url.includes('index.html') || url.endsWith('/') || url.endsWith('/coaching/')
      || _chemin0 === '/i') {
    e.respondWith((async () => {
      // cache:'no-cache' : on REVALIDE aupres du serveur. Sans lui, la
      // requete sortait du cache du navigateur (dix minutes sur GitHub
      // Pages) et le « reseau-d'abord » servait l'ancienne page.
      // On GARDE la requete d'origine (sa redirection « manual », que la
      // navigation exige) et on ne change que son mode de cache.
      let _req = e.request;
      try { _req = new Request(e.request, { cache: 'no-cache' }); } catch (err) {}
      const reseau = fetch(_req).then(r => {
        // La mise en cache est DÉTACHÉE de la réponse servie : si le quota
        // est saturé, on journalise et on sert quand même. Un put qui échoue
        // ne doit pas casser un affichage qui, lui, fonctionne.
        // SEULE UNE VRAIE PAGE REMPLACE LA COPIE (01/10/2026) : un 503 de
        // l'hébergeur, une page d'erreur d'un portail captif ou une
        // redirection ne doivent pas écraser l'index.html hors ligne.
        if (r.ok && r.status === 200 && (r.headers.get('content-type') || '').includes('text/html')) {
          const clone = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', clone))
            .catch(err => console.warn('[RepCore SW] put index.html:', err));
        }
        return r;
      });
      const enCache = await caches.match('./index.html');
      // Aucune copie : on attend le réseau, quel que soit le temps. Servir
      // une page blanche plus vite n'est pas un progrès. Si le réseau échoue
      // AUSSI, le rejet remonte et le navigateur affiche son écran d'erreur —
      // explicite, et jamais une page vide.
      if (!enCache) return reseau;
      // Course. Le perdant n'est pas annulé : la réponse réseau arrivée après
      // le délai met le cache à jour pour le lancement suivant, sans remplacer
      // l'écran déjà affiché.
      const attente = new Promise(resolve => setTimeout(() => {
        // En-tête ajouté à la COPIE servie : le SW ne peut pas toucher au DOM,
        // c'est le client qui lit cet en-tête et pose la pastille.
        const h = new Headers(enCache.headers);
        h.set('X-RepCore-Cache', '1');
        resolve(enCache.blob().then(b => new Response(b, {
          status: enCache.status, statusText: enCache.statusText, headers: h
        })));
      }, SW_DELAI_RESEAU_MS));
      return Promise.race([reseau.catch(() => attente), attente]);
    })());
    return;
  }
  // sw.js : ON NE S'EN MÊLE PAS. versionSW() le lit avec {cache:'no-store'},
  // mais no-store ne parle qu'au cache HTTP — le service worker interceptait
  // quand même, et sa branche générique, cache-first, servait la copie de la
  // version PRÉCÉDENTE. L'écran de synchronisation annonçait donc une version
  // périmée. Et le put générique l'y remettait au premier passage, d'où le
  // report la reconduisait de version en version.
  //
  // Ni lecture ni écriture : on rend la main au navigateur, qui sait gérer le
  // script d'un service worker mieux que nous.
  //
  // ══ ET LES DEUX FICHIERS DE DIAGNOSTIC AVEC LUI ═══════════════════════
  //
  // tests.js ÉTAIT DÉJÀ DÉCLARÉ EXCLU en deux endroits — il n'est pas dans
  // ASSETS, et _exclu l'écarte du report d'un cache à l'autre — mais la branche
  // générique, tout en bas, le rattrapait au premier chargement et le mettait
  // en cache comme n'importe quel asset. Les deux exclusions étaient donc
  // exactes et sans effet : le fichier entrait par la porte de derrière.
  //
  // LA CONSÉQUENCE EST LA PIRE POSSIBLE POUR UN OUTIL DE DIAGNOSTIC : on
  // pouvait éprouver l'application avec la version d'HIER de ses propres
  // tests. Une assertion corrigée le matin continuait de tomber, une
  // assertion neuve n'existait pas, et rien à l'écran ne le disait — le
  // symptôme se lit exactement comme un vrai échec.
  //
  // database.rules.json POUR LA MÊME RAISON. La suite le lit en {cache:
  // 'no-store'} pour comparer la liste blanche de coach_public à
  // CHAMPS_PROFIL_COACH — la sonde née du jour où « dispo » a fait cesser
  // DÉFINITIVEMENT la publication du profil coach. Mais no-store ne parle
  // qu'au cache HTTP, jamais au service worker, exactement comme pour sw.js
  // juste au-dessus : la branche générique servait une copie, et la sonde
  // validait les règles de la veille en annonçant celles du jour.
  //
  // AUCUN DES TROIS N'A DE RAISON DE FONCTIONNER HORS LIGNE. Ce sont des
  // outils de diagnostic : sans réseau ils doivent manquer franchement — le
  // chargeur de tests.js dit déjà « il faut être en ligne » — et non répondre
  // avec une version périmée d'eux-mêmes.
  const _chemin = url.split('?')[0];
  // ET version.json (01/10/2026) : la sonde de version d'index.html le lit a
  // chaque ouverture. Mis en cache par la branche generique, il rendrait pour
  // toujours le numero du jour de sa premiere lecture — et plus aucune mise a
  // jour ne serait vue.
  if (/\/sw\.js$/.test(_chemin) || /\/tests\.js$/.test(_chemin)
      || /\/database\.rules\.json$/.test(_chemin) || /\/version\.json$/.test(_chemin)) return;
  // Assets same-origin : cache-first, sans fallback HTML (évite de servir HTML
  // a la place d un asset). La reponse reseau REJOINT desormais le cache : sans
  // ce put, la branche lisait le cache sans jamais l alimenter, et vendor/
  // pdf.min.js etait retelecharge a CHAQUE ouverture de PDF sans jamais
  // fonctionner hors ligne — contrairement a ce que le commentaire d ASSETS
  // affirmait. Meme cause pour le moteur de lecture des captures.
  e.respondWith((async () => {
    const enCache = await caches.match(e.request);
    if (enCache) return enCache;
    const r = await fetch(e.request);
    // Mise en cache DETACHEE de la reponse servie, comme pour index.html : un
    // quota sature ne doit pas casser un affichage qui fonctionne. Seules les
    // reponses completes et valides sont conservees — une 404 ou une reponse
    // partielle en cache serait pire que pas de cache du tout.
    if (r && r.ok && r.status === 200) {
      const clone = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone))
        .catch(err => console.warn('[RepCore SW] put asset:', err));
    }
    return r;
  })());
});

// ─── SW data store (Cache API key/value, survives SW updates) ───────────────
async function swGet(key) {
  try {
    const c = await caches.open(SW_DATA);
    const r = await c.match(key);
    return r ? r.json() : null;
  } catch(e) { return null; }
}
async function swSet(key, val) {
  try {
    const c = await caches.open(SW_DATA);
    await c.put(key, new Response(JSON.stringify(val), { headers: { 'Content-Type': 'application/json' } }));
  } catch(e) {}
}

// ─── Periodic background sync — fires even when app is closed (Chrome/Android) ─
// ─── BACKGROUND SYNC : LA FILE D'ENVOI (30/09/2026) ────────────────────────
// La page enregistre 'rc-sync' quand sa file n'est pas vide ; le navigateur
// nous reveille au retour du reseau. On NE PEUT PAS envoyer d'ici : le jeton
// Firebase et la fusion a trois voies vivent dans la page. On demande donc aux
// pages ouvertes de vider leur file ; sans page ouverte, la file attend le
// prochain demarrage, qui la vide.
self.addEventListener('sync', e => {
  if (e.tag !== 'rc-sync') return;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(cs => { cs.forEach(c => { try { c.postMessage({ rc: 'vider-file' }); } catch (x) {} }); }));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'bilan-reminder') e.waitUntil(swCheckAndNotify());
  if (e.tag === 'wo-reminder') e.waitUntil(swCheckWoReminder());
  if (e.tag === 'supp-reminder') e.waitUntil(swCheckSuppReminders());
  if (e.tag === 'wrapped-reminder') e.waitUntil(swCheckWrapped());
  if (e.tag === 'serie-reminder') e.waitUntil(swCheckSerie());
});

// ─── LE PLAFOND COMMUN (27/09/2026) ────────────────────────────────────────
// Série, bilan et Wrapped existent deux fois : ici, en local, et chez le
// serveur léger (push). Les deux se cumulaient : jusqu'à deux « série en
// danger » le même jeudi, plus un Wrapped, sur un seul téléphone.
//   · PUSH SERVEUR ACTIF sur cet appareil (la page écrit '/push-serveur' à
//     l'abonnement, le retire au désabonnement) : ces trois rappels locaux se
//     taisent, le serveur les porte ;
//   · SINON, ils suivent SA règle : une notification par jour au plus
//     ('/notif-jour', le jour de la dernière), jamais entre 21 h et 8 h. Un
//     push reçu compte aussi dans la journée.
// Le rappel de séance et les compléments, réglés par l'athlète à l'heure
// près, restent hors du plafond : ce sont des alarmes qu'il a posées.
const NOTIF_JOUR = '/notif-jour';
async function swPushServeurActif() {
  const p = await swGet('/push-serveur');
  return !!(p && p.actif);
}
// Rend true quand un rappel local de ce plafond peut partir MAINTENANT.
async function swPeutNotifier() {
  const h = new Date().getHours();
  if (h >= 21 || h < 8) return false;
  return (await swGet(NOTIF_JOUR)) !== _jourLocal();
}
async function swNoterNotif() { await swSet(NOTIF_JOUR, _jourLocal()); }

// ─── « Série en danger » : jeudi 18 h, samedi 10 h ─────────────────────────
// Si la semaine en cours n'est pas encore validée (streakWeek n'est pas son
// lundi) et qu'il y a une série à perdre. Deux créneaux par semaine au plus,
// chacun une seule fois. Le réveil périodique n'est pas à l'heure : la
// notification part au premier réveil APRÈS l'heure, tant qu'on est encore
// le jour dit.
async function swCheckSerie() {
  if (await swPushServeurActif()) return;
  const cfg = await swGet('/serie');
  if (!cfg || !cfg.actif || !(cfg.streak > 0)) return;
  const d = new Date();
  const j = d.getDay(), h = d.getHours();
  const creneau = (j === 4 && h >= 18) ? 'jeu' : (j === 6 && h >= 10) ? 'sam' : null;
  if (!creneau) return;
  const l = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((j + 6) % 7));
  const lundi = _jourLocal(l);
  if (cfg.streakWeek === lundi) return;                  // semaine déjà validée
  const cle = lundi + '-' + creneau;
  const faites = (await swGet('/serie-notifs')) || [];
  if (faites.indexOf(cle) >= 0) return;
  if (!(await swPeutNotifier())) return;       // réessayé au réveil suivant
  await swSet('/serie-notifs', faites.concat([cle]).slice(-8));
  await swNoterNotif();
  const n = cfg.streak;
  await self.registration.showNotification('Ta série de ' + n + ' semaine' + (n > 1 ? 's' : '') + ' est en danger', {
    body: (cfg.fname ? cfg.fname + ', il' : 'Il') + ' te reste jusqu’à dimanche pour valider ta semaine.'
      + (cfg.jokers > 0 ? ' Ton joker la sauverait, mais garde-le pour un vrai coup dur.' : ''),
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'serie-' + cle,
    requireInteraction: false,
    data: { url: './?wo=1' }
  });
}

// ─── Wrapped : « Ton mois de septembre est prêt » ──────────────────────────
// Du 1er au 7 du mois (le mois écoulé), et tout décembre (l'année). UNE
// notification par période, jamais deux : la clé notifiée est retenue. Rien
// si l'athlète ne s'est pas entraîné pendant la période — la page écrit sa
// dernière séance dans '/wrapped'. Même clés que wrappedPeriodes (rc-core).
async function swCheckWrapped() {
  if (await swPushServeurActif()) return;
  const cfg = await swGet('/wrapped');
  if (!cfg) return;
  const d = new Date();
  const faites = (await swGet('/wrapped-notifs')) || [];
  const offres = [];
  if (d.getMonth() === 11) {
    const a = d.getFullYear();
    offres.push({ cle: 'a-' + a, debut: new Date(a, 0, 1).getTime(), titre: 'Ton année ' + a + ' est prête' });
  }
  if (d.getDate() <= 7) {
    const m = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    let mois = '';
    try { mois = m.toLocaleDateString('fr-FR', { month: 'long' }); } catch (e) {}
    offres.push({ cle: 'm-' + m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'),
      debut: m.getTime(), titre: 'Ton mois de ' + mois + ' est prêt' });
  }
  const o = offres.find(x => faites.indexOf(x.cle) < 0 && Number(cfg.derniereSeance) >= x.debut);
  if (!o) return;
  if (!(await swPeutNotifier())) return;
  await swSet('/wrapped-notifs', faites.concat([o.cle]).slice(-24));
  await swNoterNotif();
  await self.registration.showNotification(o.titre, {
    body: (cfg.fname ? cfg.fname + ', tes' : 'Tes') + ' chiffres, tes records et ton profil t’attendent.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'wrapped-' + o.cle,
    requireInteraction: false,
    data: { url: './?wrapped=' + o.cle }
  });
}

// Jour LOCAL au format AAAA-MM-JJ. toISOString() rend une date UTC : a
// 00 h 30 en France l'ete, elle designe encore la veille, et la cle de
// deduplication d'une notification changeait donc a 2 h du matin au lieu de
// minuit. L'application, elle, a toujours raisonne en date locale.
function _jourLocal(d) {
  const x = d || new Date();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const j = String(x.getDate()).padStart(2, '0');
  return x.getFullYear() + '-' + m + '-' + j;
}

// Compléments : les dix créneaux restent, ils disent QUAND chaque produit est
// dû. Mais l'émission est regroupée en trois moments. Dix notifications par
// jour, c'est un produit qu'on finit par couper — et couper les
// notifications, c'est aussi couper les deux rappels qui comptent.
const SUPP_GROUPES = [
  { cle: 'matin', heure: 8,  timings: ['jeun', 'matin', 'toutes-4h'] },
  { cle: 'jour',  heure: 13, timings: ['midi', 'apres-midi', 'avant-entrainement', 'intra', 'apres-entrainement'] },
  { cle: 'soir',  heure: 20, timings: ['soir', 'coucher'] }
];
// Fréquence de bilan, en semaines. Bornée : une valeur aberrante venue d'un
// cache corrompu ne doit pas espacer les rappels de 99 semaines.
function _freqBilan(sched) {
  const n = Number(sched && sched.freqSemaines);
  return (n === 1 || n === 2) ? n : 2;
}

async function swCheckAndNotify() {
  if (await swPushServeurActif()) return;
  const sched = await swGet('/bilan-schedule');
  if (!sched?.nextDate) return;
  if (Date.now() < sched.nextDate) return;
  const today = _jourLocal();
  if (await swGet('/bilan-last-notif') === today) return;
  if (!(await swPeutNotifier())) return;
  await swSet('/bilan-last-notif', today);
  await swNoterNotif();
  // Advance schedule by 14 days for the next cycle
  // Avance paramétrée par la fréquence CHOISIE par l'athlète. Le repli sur 2
  // est obligatoire : les caches écrits par les versions antérieures ne
  // portent pas ce champ.
  const _fq = _freqBilan(sched);
  await swSet('/bilan-schedule', { ...sched, nextDate: sched.nextDate + _fq * 7 * 24 * 3600 * 1000 });
  await self.registration.showNotification(_fq === 1 ? 'Bilan de la semaine' : 'Bilan de quinzaine', {
    body: (sched.fname || '') + ', 10 min quand tu as le temps ce week-end.',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'bilan-reminder',
    // Une notification qui reste collée jusqu'au clic pour un rappel de bilan
    // est disproportionnée : elle se subit, elle ne se lit pas.
    requireInteraction: false,
    data: { url: './?bilan=1' }
  });
}

// ─── Notification click → ouvre l'écran visé ───────────────────────────────
// L'adresse vient de data.url : notifications locales ET push serveur (qui
// passe par swUrlSure). On NAVIGUE toujours quand l'app est déjà ouverte :
// sans navigation, focus() ramènerait l'onglet sur l'écran où il était, et
// « Ton coach t'a répondu » ouvrirait… la séance en cours.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = swUrlSure(e.notification.data && e.notification.data.url);
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(ws => {
      const w = ws.find(c => c.url.startsWith(self.registration.scope));
      if (!w) return clients.openWindow(url);
      // Le repos en cours : la séance est dans CETTE page ; la naviguer la rechargerait.
      if (e.notification.tag === 'rc-repos') return w.focus();
      const cible = new URL(url, self.registration.scope).href;
      if (w.navigate && cible !== w.url && url !== './') {
        return w.focus().then(c => (c || w).navigate(cible)).catch(() => w.focus());
      }
      return w.focus();
    })
  );
});

// ─── Workout reminder ───────────────────────────────────────────────────────
async function swCheckWoReminder() {
  const sched = await swGet('/wo-reminder');
  if (!sched?.enabled) return;

  const now = new Date();
  const todayStr = _jourLocal(now);
  if (sched.lastNotifDate === todayStr) return;

  const todayJS = now.getDay();                          // 0=Sun … 6=Sat
  const todayApp = todayJS === 0 ? 6 : todayJS - 1;     // 0=Lun … 6=Dim
  if (!(sched.days || []).includes(todayApp)) return;

  const h = now.getHours();
  if (h < (sched.hour ?? 18)) return;       // trop tôt
  if (h >= (sched.hour ?? 18) + 3) return;  // plus de 3h après l'heure cible

  await swSet('/wo-reminder', { ...sched, lastNotifDate: todayStr });

  // Le nom de la séance du jour, quand le planning le porte. Sans lui, on
  // reste générique plutôt que d'inventer un intitulé.
  const _nom = (sched.noms && sched.noms[todayApp]) || 'ta séance';
  await self.registration.showNotification('Séance du jour', {
    // Le record à portée du jour, posé par l'app (_recordsAPorteeParJour).
    body: (sched.fname || '') + ', ' + _nom + ' est au programme.'
      + ((sched.records && sched.records[todayApp]) ? ' ' + sched.records[todayApp] + '.' : ''),
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-192x192.png',
    tag: 'wo-reminder',
    requireInteraction: false,
    data: { url: './?wo=1' }
  });
}

// ─── Supplement reminders ───────────────────────────────────────────────────
async function swCheckSuppReminders() {
  const sched = await swGet('/supp-reminders');
  if (!sched?.enabled || !sched?.items?.length) return;

  const now = new Date();
  const todayStr = _jourLocal(now);
  const h = now.getHours();
  const lastNotif = sched.lastNotif || {};

  // Les dix créneaux restent la nomenclature de référence : c'est ce que
  // portent les compléments eux-mêmes. Ils ne pilotent plus l'ÉMISSION, qui
  // passe par SUPP_GROUPES — mais ils servent à vérifier qu'aucun créneau
  // n'est orphelin le jour où on en ajoutera un.
  const TIMING_HOURS = {
    'jeun': 6, 'matin': 7, 'midi': 12, 'apres-midi': 15,
    'avant-entrainement': 17, 'intra': 18, 'apres-entrainement': 20,
    'soir': 19, 'coucher': 21, 'toutes-4h': 8
  };
  const _couverts = SUPP_GROUPES.reduce((a, g) => a.concat(g.timings), []);
  const _orphelins = Object.keys(TIMING_HOURS).filter(k => _couverts.indexOf(k) < 0);

  const updatedLastNotif = { ...lastNotif };
  let changed = false;

  // UNE notification par groupe et par jour, trois groupes : trois au maximum.
  // La boucle porte sur les groupes et non sur les créneaux, ce qui rend le
  // plafond structurel plutôt que surveillé.
  for (const g of SUPP_GROUPES) {
    if (h < g.heure || h >= g.heure + 3) continue;
    if (lastNotif[g.cle] === todayStr) continue;
    const timings = g.timings.concat(_orphelins.length && g.cle === 'jour' ? _orphelins : []);
    const due = sched.items.filter(x => (x.timings || []).some(t => timings.indexOf(t) >= 0));
    if (!due.length) continue;
    updatedLastNotif[g.cle] = todayStr;
    changed = true;
    const noms = due.map(x => x.name + (x.dosage_quantity ? ' ' + x.dosage_quantity + (x.dosage_unit ? ' ' + x.dosage_unit : '') : '')).join(' · ');
    await self.registration.showNotification('Compléments', {
      body: (sched.fname || '') + ' : ' + noms,
      icon: './icons/icon-192x192.png',
      badge: './icons/icon-192x192.png',
      tag: 'supp-' + g.cle,
      requireInteraction: false,
      data: { url: './' }
    });
  }

  if (changed) await swSet('/supp-reminders', { ...sched, lastNotif: updatedLastNotif });
}

// ─── Push serveur (Web Push VAPID, functions/index.js → envoyerPush) ───────
// Charge utile : {title, body, url, tag, type}. Chiffrée de bout en bout par
// le protocole : seul ce worker la lit. Le serveur applique déjà le plafond
// (1/jour) et les heures calmes ; ici, on AFFICHE — une notification push
// silencieuse est interdite (userVisibleOnly) et Chrome la remplacerait par
// « Ce site a été mis à jour en arrière-plan ».
// PURE. Une adresse sûre : relative à l'app, ou de la même origine. Une URL
// externe dans un push compromis n'ouvrira jamais une autre page.
function swUrlSure(u) {
  if (typeof u !== 'string' || !u) return './';
  try {
    const x = new URL(u, self.registration.scope);
    if (x.origin !== new URL(self.registration.scope).origin) return './';
    return x.pathname.startsWith(new URL(self.registration.scope).pathname) ? x.href : './';
  } catch (e) { return './'; }
}
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch (err) { try { d = { body: e.data.text() }; } catch (e2) { d = {}; } }
  if (!d || typeof d !== 'object') d = {};
  const titre = String(d.title || 'RepCore').slice(0, 80);
  // Un push reçu compte dans la journée : un rappel local ne s'y ajoute pas.
  e.waitUntil(swNoterNotif().catch(() => {}));
  e.waitUntil(self.registration.showNotification(titre, {
    body: String(d.body || '').slice(0, 240),
    icon: d.icon && swUrlSure(d.icon) !== './' ? swUrlSure(d.icon) : './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    tag: String(d.tag || ('push-' + (d.type || 'repcore'))).slice(0, 64),
    renotify: false,
    requireInteraction: false,
    data: { url: swUrlSure(d.url), type: d.type || null }
  }));
});
