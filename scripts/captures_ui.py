#!/usr/bin/env python3
"""Captures d'écran de l'app, au banc 390x844 (série 4, 07/10/2026).

    python3 scripts/captures_ui.py                  # tous les écrans
    python3 scripts/captures_ui.py --ecrans s-nutrition,s-coach-home
    python3 scripts/captures_ui.py --sortie docs/captures/1893-avant
    python3 scripts/captures_ui.py --hors-ligne     # navigator.onLine = false
    python3 scripts/captures_ui.py --vide           # athlète et coach sans données
    python3 scripts/captures_ui.py --planche AVANT APRES --ecrans … --sortie planche.png

- Sert le dépôt sur 127.0.0.1 (un port libre).
- BLOQUE TOUT RÉSEAU EXTERNE : seules passent 127.0.0.1, data: et blob:.
- Pose AVANT le chargement un faux athlète et un faux coach dans localStorage
  (rc_session, rc_users, rc_cgu_ok=1), inspirés des fixtures _ath( de
  app/tests.js. Aucune donnée réelle.
- Ouvre chaque écran par sa fonction réelle, et écrit
  docs/captures/<build>/<écran>.png (ou --sortie).
- `--zoom SELECTEUR` ajoute <écran>-zoom.png : l'élément agrandi deux fois.

Chromium : celui de /opt/pw-browsers (PLAYWRIGHT_BROWSERS_PATH), ou le
navigateur de Playwright à défaut.
"""
import argparse, functools, http.server, json, os, re, socketserver, sys, threading, time

RACINE = os.environ.get('CAP_RACINE') or os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = 864e5

def _build():
    s = open(os.path.join(RACINE, 'app', 'index.html'), encoding='utf-8').read()
    m = re.search(r"window\.RC_BUILD='(\d+)'", s)
    return m.group(1) if m else 'x'

# ── Les personnages ─────────────────────────────────────────────────────────
def fixtures(vide=False):
    now = int(time.time() * 1000)
    jour = lambda n: time.strftime('%Y-%m-%d', time.localtime((now - n * J) / 1000))
    coach = {'id': 'coach_banc', 'email': 'coach@banc.test', 'fname': 'Kevin', 'lname': 'Banc', 'role': 'coach',
             'createdAt': now - 400 * J, 'updatedAt': now, 'palier': 'pro', 'consent': {'health': True}}
    ath = {'id': 'ath_banc', 'email': 'lea@banc.test', 'fname': 'Léa', 'lname': 'Martin', 'role': 'athlete',
           'gender': 'F', 'birthdate': '1994-05-12', 'age': 32, 'createdAt': now - 120 * J, 'updatedAt': now,
           'coachId': coach['id'], 'coachEmailKey': 'coach@banc,test', 'coachName': 'Kevin Banc',
           'consent': {'health': True, 'policyVersion': 99, 'ts': now - 100 * J},
           'essai': {'ouvertLe': now - 2 * J, 'seancesAuDebut': 0},
           'exAlias': {}, 'exMuscles': {}, 'videos': [], 'programs': {}, 'nutrition': {},
           'sessions': [], 'bilans': [], 'weightLog': [], 'stepsLog': [], 'sleepLog': []}
    if not vide:
        ath['sessions_config'] = [
            {'day': 'Lundi', 'name': 'Jambes', 'active': True, 'exercises': [
                {'name': 'Squat', 'sets': 4, 'reps': '6-8', 'rest': 150},
                {'name': 'Fentes', 'sets': 3, 'reps': '10', 'rest': 90}]},
            {'day': 'Jeudi', 'name': 'Haut du corps', 'active': True, 'exercises': [
                {'name': 'Développé couché', 'sets': 4, 'reps': '8', 'rest': 120},
                {'name': 'Tractions assistées', 'sets': 3, 'reps': '8', 'rest': 90, 'typeCharge': 'assiste'}]}]
        for i, n in enumerate([2, 5, 9, 12, 16, 19, 23]):
            nom = 'Jambes' if i % 2 == 0 else 'Haut du corps'
            ex = {'Squat': 80 + i * 2.5, 'Fentes': 20} if nom == 'Jambes' else {'Développé couché': 45 + i, 'Tractions assistées': 30 - i}
            ath['sessions'].append({'id': 's%d' % i, 'date': now - n * J, 'name': nom, 'complete': True, 'sets': 7,
                'volume': 3000 + i * 100, 'duration': 3400,
                'data': {k: {'sets': [{'weight': str(v), 'repsDone': '8', 'done': True, 'rir': '2'} for _ in range(3)]} for k, v in ex.items()}})
        ath['weightLog'] = [{'date': jour(n), 'kg': round(64.8 - n * 0.04, 1)} for n in range(1, 28, 2)]
        ath['stepsLog'] = [{'date': jour(n), 'count': 6000 + (n * 731) % 5000} for n in range(1, 15)]
        ath['sleepLog'] = [{'date': jour(n), 'duration': 420 + (n * 17) % 90} for n in range(1, 15)]
        ath['bilans'] = [
            {'type': 'depart', 'date': now - 90 * J, 'deb-weight': '66', 'deb-taille': '72'},
            {'type': 'coaching', 'date': now - 30 * J, 'bil-weight': '65,2', 'bil-motivation': '7', 'bil-sleep-quality': 'Correct',
             'reponseCoach': 'Belle régularité, on garde le cap.', 'reponseDate': now - 28 * J, 'reponseVue': True},
            {'type': 'coaching', 'date': now - 9 * J, 'bil-weight': '64,6', 'bil-motivation': '8'}]
        ath['supplements'] = []
        ath['motCoach'] = {'texte': 'Genou un peu sensible sur les fentes.', 'maj': now - 3 * J}
    athletes = {ath['email'].replace('.', ','): ath}
    if not vide:
        for k, (fn, jours) in enumerate([('Tom', 14), ('Inès', 3), ('Hugo', 40)]):
            a = {'id': 'ath_b%d' % k, 'email': 'a%d@banc.test' % k, 'fname': fn, 'lname': 'Test', 'role': 'athlete',
                 'coachId': coach['id'], 'coachEmailKey': 'coach@banc,test', 'createdAt': now - 200 * J, 'updatedAt': now - jours * J,
                 'sessions': [{'id': 'x', 'date': now - jours * J, 'name': 'Full body', 'complete': True, 'sets': 3,
                               'data': {'Squat': {'sets': [{'weight': '60', 'repsDone': '8', 'done': True}]}}}],
                 'bilans': [{'type': 'coaching', 'date': now - (jours + 1) * J, 'bil-weight': '70'}] if k != 1 else [],
                 'consent': {'health': True}}
            athletes[a['email'].replace('.', ',')] = a
    users = dict(athletes)
    users[coach['email'].replace('.', ',')] = coach
    return ath, coach, users

# ── Les écrans : (id de capture, persona, expression qui l'ouvre) ───────────
ECRANS = [
    ('s-client-home', 'ath', "clientTab('home')"),
    ('s-bilan-choice', 'ath', "clientTab('bilan')"),
    ('s-nutrition', 'ath', "clientTab('nutrition')"),
    ('s-videos', 'ath', "clientTab('videos')"),
    ('s-lifestyle', 'ath', "clientTab('lifestyle')"),
    ('s-progress', 'ath', "clientTab('evolution')"),
    ('s-canal', 'ath', "clientTab('canal')"),
    ('s-session-manager', 'ath', "loadSessionManager()"),
    ('s-historique-seances', 'ath', "loadHistoriqueSeances()"),
    ('s-charges', 'ath', "loadCharges()"),
    ('s-athlete-profile', 'ath', "openAthleteProfile()"),
    ('s-client-reglages', 'ath', "ouvrirReglagesAthlete();document.querySelectorAll('#s-client-reglages details').forEach(d=>d.open=true)"),
    ('s-messages', 'ath', "msgOuvrirFil()"),
    ('s-supplements', 'ath', "loadSupplements()"),
    ('s-steps', 'ath', "loadSteps()"),
    ('s-sleep', 'ath', "loadSleep()"),
    ('s-recettes', 'ath', "ouvrirRecettes()"),
    ('s-client-amis', 'ath', "ouvrirAmis()"),
    ('s-workout', 'athH', "clientTab('home');startWorkoutSession(0,{sansApercu:true})"),
    ('feuille-cycle', 'athF', "clientTab('home');startWorkoutSession(0)"),
    ('barre-onglets', 'ath', "clientTab('home')"),
    ('s-coach-home', 'coach', "go('s-coach-home');try{loadCoachHome()}catch(e){}"),
    ('s-coach-client', 'coach', "openClientDetail(getClients()[0].id,false,true)"),
    ('s-coach-lundi', 'coach', "ouvrirLundi()"),
    ('s-coach-messages', 'coach', "ouvrirMessages()"),
    ('s-coach-programs', 'coach', "openCoachPrograms()"),
    ('s-coach-banque', 'coach', "ouvrirBanque()"),
    ('s-coach-relances', 'coach', "ouvrirRelances()"),
    ('s-coach-prospects', 'coach', "ouvrirProspects()"),
    ('s-coach-activite', 'coach', "loadCoachActivite()"),
    ('s-protocoles', 'coach', "ouvrirProtocoles()"),
    ('s-coach-canal', 'coach', "loadCanalCoach()"),
    ('s-coach-file', 'coach', "loadFileReprise()"),
]

NETTOYER = """()=>{ try{ if(window._bdgFile) _bdgFile.length=0; }catch(e){}
  try{ clearTimeout(window._bdgMinuterie); }catch(e){}
  document.querySelectorAll('#bdg-ecran,#rc-ban-install').forEach(x=>{ if(x.id==='bdg-ecran') x.remove(); else x.style.display='none'; });
  try{ const m=document.getElementById('modal-overlay'); if(m) m.remove(); }catch(e){}
  document.querySelectorAll('.toast,#toast').forEach(x=>x.style.display='none'); }"""

# Les styles de titre rendus : h1-h4, .topbar-title, .t-*, et tout texte en
# majuscules espacées (≥ 1,5 px), gras, hors bouton, champ, badge et chiffre.
SONDE_TITRES = """()=>{
  const ecran=document.querySelector('.screen.active'); if(!ecran) return [];
  const vus=new Map();
  const propre=e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim();
  for(const e of ecran.querySelectorAll('h1,h2,h3,h4,.topbar-title,.t-page,.t-section,.t-carte,div,span,b,strong,p,summary')){
    if(!e.getClientRects().length) continue;
    const cs=getComputedStyle(e); if(cs.visibility==='hidden'||+cs.opacity===0) continue;
    const t=propre(e); if(t.length<3||/^[\d\s.,:%+\-–—\/kgKG]+$/.test(t)) continue;
    if(e.closest('[data-legende],.metric-box,button,label,a,input,select,textarea,[class*="badge"],[class*="pastille"],[class*="tag"],[class*="pill"],.tab-bar')) continue;
    const titre=/^H[1-4]$/.test(e.tagName)||e.matches('.topbar-title,.t-page,.t-section,.t-carte')
      ||(cs.textTransform==='uppercase'&&parseFloat(cs.letterSpacing)>=1.5&&+cs.fontWeight>=700);
    if(!titre) continue;
    const sig=[cs.fontFamily.split(',')[0].replace(/["']/g,''),cs.fontSize,cs.fontWeight,cs.textTransform,cs.letterSpacing,cs.color].join(' | ');
    if(!vus.has(sig)) vus.set(sig,t.slice(0,40));
  }
  return [...vus.entries()];
}"""

class _Calme(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def servir():
    h = functools.partial(_Calme, directory=RACINE)
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', 0), h)
    srv.daemon_threads = True
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]

def _navigateur(p):
    for chemin in ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome']:
        if os.path.exists(chemin):
            return p.chromium.launch(executable_path=chemin, args=['--no-sandbox'])
    return p.chromium.launch()

def capturer(ecrans, sortie, hors_ligne=False, vide=False, zoom=None, titres=None, sonde=None):
    from playwright.sync_api import sync_playwright
    os.makedirs(sortie, exist_ok=True)
    srv, port = servir()
    origine = 'http://127.0.0.1:%d' % port
    ath, coach, users = fixtures(vide)
    athF = dict(ath, cycleSuivi='actif', gender='F')
    athH = dict(ath, gender='H', fname='Tom', cycleSuivi=None)
    ecrits = []
    with sync_playwright() as p:
        nav = _navigateur(p)
        for nom, perso, expr in ecrans:
            moi = {'ath': ath, 'athF': athF, 'athH': athH, 'coach': coach}[perso]
            us = dict(users); us[moi['email'].replace('.', ',')] = moi
            ctx = nav.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2,
                                  service_workers='block', locale='fr-FR', timezone_id='Europe/Paris')
            def filtre(route):
                u = route.request.url
                if u.startswith(origine) or u.startswith('data:') or u.startswith('blob:'): return route.continue_()
                return route.abort()
            ctx.route('**/*', filtre)
            init = ('localStorage.setItem("rc_session",%s);localStorage.setItem("rc_users",%s);'
                    'localStorage.setItem("rc_cgu_ok","1");' % (json.dumps(json.dumps(moi)), json.dumps(json.dumps(us))))
            if hors_ligne:
                init += 'Object.defineProperty(navigator,"onLine",{get:()=>false});'
            ctx.add_init_script(init)
            page = ctx.new_page()
            page.goto(origine + '/app/index.html', wait_until='domcontentloaded')
            try: page.wait_for_function('typeof currentUser!=="undefined"&&currentUser&&document.querySelector(".screen.active")&&document.querySelector(".screen.active").id!=="s-splash"', timeout=15000)
            except Exception: pass
            # Les célébrations de badges (file planifiée à ~900 ms) et les
            # feuilles d'accueil masqueraient l'écran : on les vide.
            page.wait_for_timeout(1500)
            page.evaluate(NETTOYER)
            try: page.evaluate('()=>{ try{ ' + expr + ' }catch(e){ console.warn(e) } }')
            except Exception as e: print('!', nom, e, file=sys.stderr)
            page.wait_for_timeout(1200)
            page.evaluate(NETTOYER)
            f = os.path.join(sortie, nom + '.png')
            if nom == 'barre-onglets':
                el = page.query_selector('#client-tabbar')
                (el.screenshot(path=f) if el else page.screenshot(path=f))
            else:
                page.screenshot(path=f)
            ecrits.append(f)
            if zoom:
                el = page.query_selector(zoom)
                if el:
                    el.scroll_into_view_if_needed(); page.wait_for_timeout(300)
                    bb = el.bounding_box()
                    if bb and bb['width'] > 0:
                        zf = os.path.join(sortie, nom + '-zoom.png')
                        page.screenshot(path=zf, clip={'x': max(0, bb['x'] - 8), 'y': max(0, bb['y'] - 8),
                                                       'width': min(390, bb['width'] + 16), 'height': bb['height'] + 16})
                        ecrits.append(zf)
            if titres is not None:
                titres[nom] = page.evaluate(SONDE_TITRES)
            if sonde:
                r = page.evaluate(sonde)
                if r: print('SONDE', nom, json.dumps(r, ensure_ascii=False))
            actif = page.evaluate('()=>(document.querySelector(".screen.active")||{}).id||"?"')
            print('ecrit', f, '(écran actif : %s)' % actif)
            if os.environ.get('CAP_DEBUG'): print(page.title())
            ctx.close()
        nav.close()
    srv.shutdown()
    return ecrits

def planche(avant, apres, noms, sortie):
    """Avant à gauche, après à droite, une rangée par écran."""
    from PIL import Image, ImageDraw
    rangs = []
    for n in noms:
        a, b = os.path.join(avant, n + '.png'), os.path.join(apres, n + '.png')
        if os.path.exists(a) and os.path.exists(b):
            rangs.append((n, Image.open(a), Image.open(b)))
    if not rangs: print('planche : aucune paire'); return
    ech = 0.5
    w = max(int(x.width * ech) + int(y.width * ech) for _, x, y in rangs) + 30
    h = sum(max(int(x.height * ech), int(y.height * ech)) + 40 for _, x, y in rangs)
    pl = Image.new('RGB', (w, h), (20, 20, 20)); d = ImageDraw.Draw(pl); yy = 0
    for n, x, y in rangs:
        xs = x.resize((int(x.width * ech), int(x.height * ech))); ys = y.resize((int(y.width * ech), int(y.height * ech)))
        d.text((6, yy + 8), n + '   AVANT  |  APRÈS', fill=(230, 230, 230))
        pl.paste(xs, (0, yy + 30)); pl.paste(ys, (xs.width + 30, yy + 30))
        yy += max(xs.height, ys.height) + 40
    os.makedirs(os.path.dirname(sortie) or '.', exist_ok=True)
    pl.save(sortie, optimize=True); print('planche', sortie)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--ecrans', default='')
    ap.add_argument('--sortie', default='')
    ap.add_argument('--hors-ligne', action='store_true')
    ap.add_argument('--vide', action='store_true')
    ap.add_argument('--zoom', default='')
    ap.add_argument('--planche', nargs=2, metavar=('AVANT', 'APRES'))
    ap.add_argument('--sonde', default='', help='fichier JS : une fonction ()=>[…] évaluée sur chaque écran')
    ap.add_argument('--titres', action='store_true', help='relève les styles de titre rendus (titres.json)')
    a = ap.parse_args()
    voulus = [x for x in a.ecrans.split(',') if x]
    if a.planche:
        noms = voulus or [n for n, _, _ in ECRANS]
        planche(a.planche[0], a.planche[1], noms, a.sortie or 'docs/captures/planche.png')
        sys.exit(0)
    liste = [e for e in ECRANS if not voulus or e[0] in voulus]
    inconnus = set(voulus) - {e[0] for e in ECRANS}
    if inconnus: sys.exit('écrans inconnus : ' + ', '.join(sorted(inconnus)))
    sortie = a.sortie or os.path.join(RACINE, 'docs', 'captures', _build())
    t = {} if a.titres else None
    capturer(liste, sortie, a.hors_ligne, a.vide, a.zoom or None, t, open(a.sonde).read() if a.sonde else None)
    if t is not None:
        tous = {}
        for nom, l in t.items():
            for sig, ex in l: tous.setdefault(sig, []).append('%s « %s »' % (nom, ex))
        json.dump({'styles': tous, 'par_ecran': t}, open(os.path.join(sortie, 'titres.json'), 'w'), ensure_ascii=False, indent=1)
        print('%d style(s) de titre distinct(s) sur %d écran(s)' % (len(tous), len(t)))
        for sig, ou in sorted(tous.items(), key=lambda x: -len(x[1])): print('  %3d  %s   ex. %s' % (len(ou), sig, ou[0]))
