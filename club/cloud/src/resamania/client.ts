/*! Fit Pulse © 2026 Kévin GUELLEC et FPN Gestion. Tous droits réservés. */
// Client de l'API Resamania (lecture seule, appels serveur uniquement).
// Doc publique : https://doc.resamania.com/auth/client-credentials.html (jeton),
// https://doc.resamania.com/general/frequently-asked-questions.html (en-têtes),
// https://doc.resamania.com/general/rate-limiting.html (429, X-Rate-Limit-Reset).
//   URL : https://{GATEWAY_BASE}/{clientToken}/...
//   En-têtes : authorization Bearer, x-gravitee-api-key, x-user-club-id,
//              x-user-network-node-id si défini.
// Jeton client_credentials gardé en mémoire jusqu'à son expiration moins 60 s.
// Sur 429 : X-Rate-Limit-Reset lu, recul exponentiel 1 s, 2 s, 4 s, 8 s ;
// abandon après 5 essais avec une erreur typée (RsmQuotaDepasse).
// Les secrets (clé d'API, identifiant et secret client) viennent de Secret Manager,
// jamais de /pulse ni du front. Le journal ne garde ni paramètre ni identifiant.

export interface RsmIdentite { gatewayBase: string; clientToken: string; clubIri: string; networkNodeIri?: string | null }
export interface RsmSecrets { apiKey: string; clientId: string; clientSecret: string }
export interface RsmAppel { chemin: string; status: number; ms: number; essais: number }
type Fetch = (url: string, init?: any) => Promise<{ status: number; ok: boolean; headers: { get(n: string): string | null }; json(): Promise<any>; text(): Promise<string> }>;

export const RSM_ESSAIS_MAX = 5;
export const RSM_RECUL_MS = [1000, 2000, 4000, 8000];
export const RSM_MARGE_JETON_MS = 60_000;
const RESET_MAX_MS = 60_000; // une attente annoncée par X-Rate-Limit-Reset n'est suivie que jusqu'à 60 s

export class RsmQuotaDepasse extends Error {
  readonly essais: number; readonly reset: number | null;
  constructor(chemin: string, essais: number, reset: number | null) { super(`Resamania : quota dépassé sur ${chemin} après ${essais} essais`); this.name = 'RsmQuotaDepasse'; this.essais = essais; this.reset = reset; }
}
export class RsmErreurHttp extends Error {
  readonly status: number;
  constructor(chemin: string, status: number) { super(`Resamania : HTTP ${status} sur ${chemin}`); this.name = 'RsmErreurHttp'; this.status = status; }
}

// Chemin sans paramètre ni identifiant (journal sans donnée personnelle) : /contacts/123 -> /contacts/:id
export const cheminAnonyme = (chemin: string) => '/' + chemin.split('?')[0].replace(/^\/+/, '').split('/').map(s => (/\d/.test(s) ? ':id' : s)).join('/');

// X-Rate-Limit-Reset : un instant (secondes ou millisecondes depuis 1970) ou un délai en secondes.
export function attenteReset(valeur: string | null, maintenant: number): number | null {
  if (!valeur) return null; const n = Number(valeur); if (!isFinite(n) || n <= 0) return null;
  const ms = n > 1e12 ? n - maintenant : n > 1e9 ? n * 1000 - maintenant : n * 1000;
  return ms > 0 ? Math.min(ms, RESET_MAX_MS) : 0;
}

export function fabriquerClient(o: {
  identite: RsmIdentite; secrets: () => Promise<RsmSecrets>; fetch?: Fetch;
  dormir?: (ms: number) => Promise<void>; maintenant?: () => number; journal?: (a: RsmAppel) => void;
}) {
  const fetcher: Fetch = o.fetch || (globalThis.fetch as any);
  const dormir = o.dormir || (ms => new Promise<void>(r => setTimeout(r, ms)));
  const maintenant = o.maintenant || (() => Date.now());
  const base = () => `https://${o.identite.gatewayBase.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/${o.identite.clientToken}`;
  let jeton: { valeur: string; expire: number } | null = null;

  async function jetonValide(forcer = false): Promise<string> {
    if (!forcer && jeton && maintenant() < jeton.expire - RSM_MARGE_JETON_MS) return jeton.valeur;
    const s = await o.secrets();
    const corps = new URLSearchParams({ grant_type: 'client_credentials', client_id: s.clientId, client_secret: s.clientSecret }).toString();
    const r = await fetcher(`${base()}/oauth/v2/token`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-gravitee-api-key': s.apiKey }, body: corps });
    if (!r.ok) throw new RsmErreurHttp('/oauth/v2/token', r.status);
    const j = await r.json(); const duree = Number(j.expires_in) || 0;
    jeton = { valeur: String(j.access_token), expire: maintenant() + duree * 1000 };
    return jeton.valeur;
  }

  async function get(chemin: string, query: Record<string, string | number | boolean> = {}): Promise<any> {
    const s = await o.secrets(); const q = new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)])).toString();
    const url = `${base()}/${chemin.replace(/^\/+/, '')}${q ? '?' + q : ''}`;
    const t0 = maintenant(); let reset: number | null = null; let reessaiJeton = false;
    for (let essai = 1; essai <= RSM_ESSAIS_MAX; essai++) {
      const h: Record<string, string> = { authorization: `Bearer ${await jetonValide()}`, 'x-gravitee-api-key': s.apiKey, 'x-user-club-id': o.identite.clubIri, accept: 'application/json' };
      if (o.identite.networkNodeIri) h['x-user-network-node-id'] = o.identite.networkNodeIri;
      const r = await fetcher(url, { method: 'GET', headers: h });
      if (r.status === 429) {
        reset = attenteReset(r.headers.get('x-rate-limit-reset'), maintenant());
        if (essai === RSM_ESSAIS_MAX) break;
        await dormir(Math.max(RSM_RECUL_MS[essai - 1], reset || 0)); continue;
      }
      if (r.status === 401 && !reessaiJeton) { reessaiJeton = true; jeton = null; essai--; continue; }
      o.journal?.({ chemin: cheminAnonyme(chemin), status: r.status, ms: maintenant() - t0, essais: essai });
      if (!r.ok) throw new RsmErreurHttp(cheminAnonyme(chemin), r.status);
      return r.json();
    }
    o.journal?.({ chemin: cheminAnonyme(chemin), status: 429, ms: maintenant() - t0, essais: RSM_ESSAIS_MAX });
    throw new RsmQuotaDepasse(cheminAnonyme(chemin), RSM_ESSAIS_MAX, reset);
  }

  // Liste paginée (30 éléments par page par défaut) : réponses JSON-LD (hydra:member) ou tableau.
  async function* liste(chemin: string, query: Record<string, string | number | boolean> = {}, parPage = 100): AsyncGenerator<any> {
    for (let page = 1; page < 1000; page++) {
      const j = await get(chemin, { ...query, page, itemsPerPage: parPage });
      const L: any[] = Array.isArray(j) ? j : (j && (j['hydra:member'] || j.member)) || [];
      for (const x of L) yield x;
      if (L.length < parPage) return;
    }
  }
  return { get, liste, jeton: jetonValide };
}
