// ══ LE CAPTEUR D'ERREURS (série 6, lot 14, 08/10/2026) ════════════════════════
//
// POST /erreur, sans compte : l'app envoie la SIGNATURE d'une erreur — un
// message nettoyé (ni adresse ni longue suite de chiffres), l'endroit, le
// build, une empreinte — jamais le dossier, jamais un identifiant.
//
//   erreurs/<AAAA-MM-JJ>/<build>/<empreinte> = {n, m, s, ou, premier, dernier}
//   erreurs_jour/<AAAA-MM-JJ> = nombre d'entrées distinctes du jour
//
// ⚠ BORNES : 2 Ko de corps au plus ; 500 empreintes distinctes par jour (au
//   delà, seules les empreintes déjà connues comptent) ; n plafonné. La limite
//   générale du Worker (LIMITE_ROUTES) s'applique avant.
// ⚠ LECTURE : le créateur seul (database.rules.json, nœud erreurs).
export const ERREUR_CORPS_MAX = 2048;
export const ERREURS_JOUR_MAX = 500;
export const ERREUR_N_MAX = 1e6;
const BUILD_RE = /^\d{3,6}$/, EMPREINTE_RE = /^[a-z0-9]{4,16}$/;
const net = (x, n) => String(x == null ? '' : x).replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[e-mail]').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
export const jourParis = (t) => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

// PURE. Le corps reçu → {ok, chemin, champs} ou {ok:false, raison}.
export function erreurDepuisCorps(texte, t) {
  const brut = String(texte == null ? '' : texte);
  if (brut.length > ERREUR_CORPS_MAX) return { ok: false, raison: 'taille' };
  let c; try { c = JSON.parse(brut); } catch (e) { return { ok: false, raison: 'json' }; }
  if (!c || typeof c !== 'object') return { ok: false, raison: 'json' };
  const b = String(c.b || ''), h = String(c.h || '');
  if (!BUILD_RE.test(b) || !EMPREINTE_RE.test(h)) return { ok: false, raison: 'champs' };
  const m = net(c.m, 200);
  if (!m.trim()) return { ok: false, raison: 'champs' };
  return { ok: true, jour: jourParis(t), chemin: 'erreurs/' + jourParis(t) + '/' + b + '/' + h,
    champs: { m, s: net(c.s, 120), ou: net(c.ou, 40) } };
}
// PURE. L'entrée après un passage de plus.
export function erreurIncrementee(avant, champs, t) {
  const a = (avant && typeof avant === 'object') ? avant : null;
  return Object.assign({}, champs, { n: Math.min(ERREUR_N_MAX, (a ? Number(a.n) || 0 : 0) + 1), premier: a ? Number(a.premier) || t : t, dernier: t });
}
// L'écriture. Rend {ok, raison?}.
export async function enregistrerErreur(db, texte, t) {
  const e = erreurDepuisCorps(texte, t);
  if (!e.ok) return e;
  const existe = (await db.ref(e.chemin + '/n').get()).val();
  if (existe == null) {
    let plein = false;
    await db.ref('erreurs_jour/' + e.jour).transaction((v) => { const n = Number(v) || 0; if (n >= ERREURS_JOUR_MAX) { plein = true; return undefined; } return n + 1; });
    if (plein) return { ok: false, raison: 'plafond' };
  }
  await db.ref(e.chemin).transaction((v) => erreurIncrementee(v, e.champs, t));
  return { ok: true };
}
