// Un faux Brevo (API v3) en mémoire, pour les tests : contacts, listes,
// dossiers, attributs. `forcer` impose une réponse par étape (« POST /contacts »,
// « DELETE /contacts/:email »…) : un objet {statut, corps, entetes}, 'reseau',
// ou une fonction (init) → l'un des deux ou null (comportement normal).
export function fauxBrevo(o) {
  const opt = o || {};
  const b = {
    appels: [], corps: [], contacts: {}, listes: (opt.listes || []).map((x) => Object.assign({ membres: [] }, x)),
    dossiers: opt.dossiers || [{ id: 1, name: 'Dossier' }], attributs: new Set(opt.attributs || ['PRENOM', 'NOM']),
    forcer: opt.forcer || {}, suivant: 100, cles: [], envois: [],
  };
  const rep = (statut, corps, entetes) => ({ ok: statut < 400, status: statut, json: async () => corps,
    headers: { get: (k) => (entetes || {})[k] || null } });
  b.gere = (url) => String(url).startsWith('https://api.brevo.com/v3');
  b.fetch = async (url, init) => {
    const u = String(url), chemin = u.slice('https://api.brevo.com/v3'.length), m = (init && init.method) || 'GET';
    const nu = chemin.split('?')[0];
    const etape = m + ' ' + nu.replace(/\/contacts\/[^/]+(@|%40)[^/]+/, '/contacts/:email').replace(/\/\d+(?=\/|$)/g, '/:id').replace(/\/attributes\/normal\/[A-Z_]+/, '/attributes/normal/:nom');
    b.appels.push(etape);
    b.cles.push(init && init.headers && init.headers['api-key']);
    const corps = init && init.body ? JSON.parse(init.body) : null;
    b.corps.push({ etape, corps });
    const f = b.forcer[etape];
    if (f) {
      const r = typeof f === 'function' ? f(init) : f;
      if (r === 'reseau') throw new Error('réseau');
      if (r) return rep(r.statut, r.corps || {}, r.entetes);
    }
    if (etape === 'POST /contacts') {
      const inconnu = Object.keys(corps.attributes || {}).find((k) => !b.attributs.has(k));
      if (inconnu) return rep(400, { code: 'invalid_parameter', message: 'Attribute ' + inconnu + ' does not exist' });
      const e = corps.email;
      const deja = b.contacts[e];
      b.contacts[e] = { email: e, attributs: Object.assign({}, deja ? deja.attributs : {}, corps.attributes || {}), id: deja ? deja.id : b.suivant++ };
      for (const id of corps.listIds || []) { const l = b.listes.find((x) => x.id === id); if (l && !l.membres.includes(e)) l.membres.push(e); }
      return deja ? rep(204, null) : rep(201, { id: b.contacts[e].id });
    }
    if (etape === 'DELETE /contacts/:email') {
      const e = decodeURIComponent(nu.split('/')[2]);
      if (!b.contacts[e]) return rep(404, { code: 'document_not_found' });
      delete b.contacts[e]; for (const l of b.listes) l.membres = l.membres.filter((x) => x !== e);
      return rep(204, null);
    }
    if (etape === 'POST /smtp/email') { b.envois.push(corps); return rep(201, { messageId: '<m' + b.envois.length + '@brevo>' }); }
    if (etape === 'PUT /contacts/:email') {
      const e = decodeURIComponent(nu.split('/')[2]);
      if (!b.contacts[e]) return rep(404, { code: 'document_not_found' });
      Object.assign(b.contacts[e], corps); return rep(204, null);
    }
    if (etape === 'GET /contacts/lists') return rep(200, { lists: b.listes.map(({ id, name }) => ({ id, name })), count: b.listes.length });
    if (etape === 'GET /contacts/folders') return rep(200, { folders: b.dossiers, count: b.dossiers.length });
    if (etape === 'POST /contacts/folders') { const d = { id: b.suivant++, name: corps.name }; b.dossiers.push(d); return rep(201, { id: d.id }); }
    if (etape === 'POST /contacts/lists') { const l = { id: b.suivant++, name: corps.name, folderId: corps.folderId, membres: [] }; b.listes.push(l); return rep(201, { id: l.id }); }
    if (etape === 'POST /contacts/lists/:id/contacts/add' || etape === 'POST /contacts/lists/:id/contacts/remove') {
      const l = b.listes.find((x) => x.id === Number(nu.split('/')[3]));
      if (!l) return rep(404, { code: 'document_not_found' });
      const e = corps.emails[0];
      if (etape.endsWith('remove')) {
        if (!l.membres.includes(e)) return rep(400, { code: 'invalid_parameter', message: 'Contact already removed from list' });
        l.membres = l.membres.filter((x) => x !== e); return rep(201, { contacts: { success: [e] } });
      }
      if (!b.contacts[e]) return rep(400, { code: 'invalid_parameter' });
      if (!l.membres.includes(e)) l.membres.push(e);
      return rep(201, { contacts: { success: [e] } });
    }
    if (etape === 'POST /contacts/attributes/normal/:nom') {
      const n = nu.split('/').pop();
      if (b.attributs.has(n)) return rep(400, { code: 'invalid_parameter', message: 'Attribute name must be unique' });
      b.attributs.add(n); return rep(201, null);
    }
    return rep(404, {});
  };
  return b;
}
