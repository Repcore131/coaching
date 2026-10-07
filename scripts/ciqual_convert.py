"""
Ciqual 2025 → ciqual.json
Converts the Anses Ciqual 2025 xlsx to a lightweight JSON for RepCore.
Usage : python scripts/ciqual_convert.py                (depuis le xlsx de l'Anses)
        python scripts/ciqual_convert.py --depuis-json  (complète app/data/ciqual.json
                                                         sans le xlsx : énergie calculée
                                                         et aliments génériques)
Output: app/data/ciqual.json (~850 KB)

ÉNERGIE ABSENTE, MACROS PRÉSENTES (30/09/2026)
143 aliments n'ont pas d'énergie dans la table ; 62 d'entre eux ont pourtant
protéines, glucides et lipides. Sans énergie, l'app les comptait 0 kcal au
journal. On calcule alors k = 4 p + 4 c + 9 l + 2 f (f = fibres, 0 si absentes),
coefficients d'Atwater et 2 kcal/g pour les fibres (règlement UE 1169/2011,
annexe XIV), arrondi au dixième, et on pose "k_calc": true pour que l'app
dise « kcal estimées ». Un aliment à qui il manque une des trois macros reste
sans énergie : on n'invente pas.

LES ALIMENTS « REPCORE GÉNÉRIQUES » (ids NÉGATIFS)
La table de l'Anses ne connaît ni la whey, ni la caséine, ni le gel
énergétique : l'athlète ne les trouvait pas hors ligne. Onze aliments de
sportifs sont ajoutés, ids -1 à -11, groupe « produits pour sportifs ». Ce ne
sont PAS des données Ciqual : ce sont des valeurs moyennes d'étiquettes du
commerce pour 100 g, arrondies (voir GENERIQUES). Les ids négatifs ne peuvent
pas rencontrer un code Ciqual, et les 3 484 aliments de l'Anses restent
comptables à part (id > 0).

Source : Anses. Table de composition nutritionnelle des aliments Ciqual.
Fichier utilisé : « Table Ciqual 2025_FR_2025_11_03.xlsx », version du 3 novembre
2025, telle que publiée par l'Anses. Le nom du fichier PORTE la version : ne pas
le renommer, c'est la seule trace de la millésime dans ce dépôt.

RÈGLE ABSOLUE SUR LES MICRONUTRIMENTS
Une valeur absente de la base est écrite `null` — JAMAIS 0. Un zéro dirait « cet
aliment n'en contient pas », alors que la base dit « on ne sait pas ». La
différence n'est pas cosmétique : une couverture calculée en comptant les
inconnues comme des zéros sous-estime les apports et ferait poser au coach une
question fondée sur du vide.
Concrètement, la clé est simplement ABSENTE de l'entrée JSON quand la valeur est
inconnue, et le lecteur JavaScript traite l'absence comme null.

Couverture réelle mesurée sur les 3484 aliments retenus (version 2025-11-03) :
    fer 76 %, calcium 78 %, magnésium 74 %, zinc 74 %, iode 61 %,
    potassium 75 %, vitamine B12 62 %, folates 26 %.
Les folates sont documentés sur un aliment sur quatre : c'est une limite de la
base, pas un défaut du calcul. L'application affiche cette part et n'en tire
aucune conclusion quand elle est trop faible.
"""
import json, re, os, sys

SRC = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'Downloads',
                   'Table Ciqual 2025_FR_2025_11_03.xlsx')
# « app/data » et non « data » : le fichier servi est app/data/ciqual.json — c'est
# lui que fetch('./data/ciqual.json') va chercher depuis app/index.html. L'ancien
# chemin pointait un cran trop haut et déposait le résultat dans un data/ à la
# racine que PERSONNE ne lit : le script rendait « Done. » sans que l'application
# voie jamais la moindre modification.
DST = os.path.join(os.path.dirname(__file__), '..', 'app', 'data', 'ciqual.json')

def parse_fr(val):
    """Convert French numeric string to float, handle Ciqual special values.

    MACROS UNIQUEMENT. Le comportement historique est conservé au caractère
    près, y compris « traces » → 0.0 : le changer réécrirait des valeurs déjà
    en production dans les dossiers des athlètes. Les micronutriments passent
    par parse_micro, qui applique la règle stricte.
    """
    if val is None:
        return None
    s = str(val).strip()
    if s in ('', '-', 'nan', 'NaN', 'N/A'):
        return None
    # "traces" or "< X" → treat as 0
    if s.lower() == 'traces':
        return 0.0
    m = re.match(r'[<>]\s*([\d,\.]+)', s)
    if m:
        s = m.group(1)
    s = s.replace(',', '.')
    try:
        return round(float(s), 2)
    except ValueError:
        return None

def parse_micro(val):
    """Micronutriments : rien n'est inventé, rien n'est mis à zéro.

    - vide, '-', 'nan'            → None (inconnu)
    - '< 0,1'                     → 0.1, la BORNE HAUTE numérique. Le seuil de
                                    détection est une information ; le nombre
                                    réel est quelque part en dessous, et
                                    majorer est le sens prudent pour un calcul
                                    de couverture qu'on ne veut pas surestimer
                                    à la baisse.
    - 'traces' sans borne         → None. Aucune borne n'est donnée, donc aucun
                                    nombre ne peut être écrit honnêtement.
                                    Concerne 6 aliments sur le fer, 16 sur le
                                    zinc, 8 sur la B12, zéro ailleurs.
    Trois décimales : l'iode et la B12 se comptent en microgrammes, et un
    arrondi au centième y perdrait l'essentiel de l'information.
    """
    if val is None:
        return None
    s = str(val).strip()
    if s in ('', '-', 'nan', 'NaN', 'N/A'):
        return None
    if s.lower() == 'traces':
        return None
    m = re.match(r'[<>]\s*([\d,\.]+)', s)
    if m:
        s = m.group(1)
    s = s.replace(',', '.')
    try:
        return round(float(s), 3)
    except ValueError:
        return None

def normalize(text):
    """Lowercase + strip accents for search index."""
    if not text:
        return ''
    text = text.lower()
    for a, b in [('é','e'),('è','e'),('ê','e'),('ë','e'),
                 ('à','a'),('â','a'),('ä','a'),
                 ('ù','u'),('û','u'),('ü','u'),
                 ('î','i'),('ï','i'),
                 ('ô','o'),('ö','o'),
                 ('ç','c'),('œ','oe'),('æ','ae')]:
        text = text.replace(a, b)
    return text

# ── Énergie calculée, et aliments génériques ─────────────────────────────
def kcal_calculee(e):
    """k = 4p + 4c + 9l + 2f quand l'énergie manque et que p, c, l sont là."""
    if e.get('k') is not None:
        return None
    if any(e.get(x) is None for x in ('p', 'c', 'l')):
        return None
    return round(4*e['p'] + 4*e['c'] + 9*e['l'] + 2*(e.get('f') or 0), 1)

# ── LES ALIMENTS GÉNÉRIQUES REPCORE : scripts/repcore_generiques.csv ──────
# Sortis du code (BUILD 1854) : une ligne par aliment, séparateur « ; »,
#   id;nom;groupe;k;p;c;l;f;e;sel;portion_lib;portion_g;alias;source;date_source
# pour 100 g. k = kcal, p/c/l = protéines/glucides/lipides, f = fibres,
# e = EAU (g, facultative : elle ne sert qu'au contrôle de la somme), sel = sel
# (g) — écrit sous la clé JSON « e », comme les fiches Ciqual. Les alias sont
# séparés par « | ».
# ⚠ LES IDS : -1 à -11 sont ceux des premières versions et des plans de coach
# les référencent — jamais renumérotés, jamais réutilisés. Un id retiré reste
# dans le fichier en ligne commentée « #retiré;-NN;nom;raison » : il est réservé
# à vie, et le script refuse qu'une ligne active le reprenne.
# ⚠ AUCUNE VALEUR SANS SOURCE. Par ordre de priorité : une fiche Ciqual proche
# (« = Ciqual 25600 »), sinon USDA FoodData Central (domaine public CC0, numéro
# FDC), sinon la moyenne d'au moins 3 étiquettes françaises lues sur Open Food
# Facts (codes EAN) ou le tableau publié par la chaîne, avec sa date.
GROUPE_SPORT = 'produits pour sportifs'
GENERIQUES_CSV = os.path.join(os.path.dirname(__file__), 'repcore_generiques.csv')
COLS_GEN = ['id', 'nom', 'groupe', 'k', 'p', 'c', 'l', 'f', 'e', 'sel',
            'portion_lib', 'portion_g', 'alias', 'source', 'date_source']

def _num(v):
    v = (v or '').strip().replace(',', '.')
    return float(v) if v else None

def lire_generiques():
    lignes, retires = [], set()
    with open(GENERIQUES_CSV, encoding='utf-8') as fp:
        for n, brut in enumerate(fp, 1):
            brut = brut.rstrip('\n')
            if not brut.strip():
                continue
            if brut.startswith('#retiré;') or brut.startswith('#retire;'):
                retires.add(int(brut.split(';')[1]))
                continue
            if brut.startswith('#') or brut.startswith('id;'):
                continue
            cols = brut.split(';')
            if len(cols) != len(COLS_GEN):
                print(f'  ✗ repcore_generiques.csv:{n} : {len(cols)} colonnes au lieu de {len(COLS_GEN)}')
                sys.exit(1)
            lignes.append((n, dict(zip(COLS_GEN, cols))))
    return lignes, retires

def generiques(base):
    """Lit le CSV et REFUSE (exit 1) toute ligne incohérente."""
    lignes, retires = lire_generiques()
    noms_ciqual = {e.get('s') for e in base}
    alias_ciqual = {a for e in base for a in (e.get('a') or [])}
    vus, noms_vus, out, erreurs = set(), set(), [], []
    for n, r in lignes:
        i = int(r['id'])
        k, p, c, l = (_num(r[x]) for x in ('k', 'p', 'c', 'l'))
        f, eau, sel = _num(r['f']), _num(r['e']), _num(r['sel'])
        ou = f'ligne {n} (id {i})'
        if i >= 0: erreurs.append(f'{ou} : un générique a un id négatif')
        if i in vus: erreurs.append(f'{ou} : id en double')
        if i in retires: erreurs.append(f'{ou} : id retiré, réservé à vie')
        vus.add(i)
        if None in (k, p, c, l): erreurs.append(f'{ou} : k, p, c et l sont obligatoires')
        else:
            calc = 4*p + 4*c + 9*l + 2*(f or 0)
            if abs(k - calc) > max(0.15*k, 5): erreurs.append(f'{ou} : {k} kcal contre {calc:.0f} par 4/4/9 (> 15 %)')
            if p + c + l + (f or 0) + (sel or 0) + (eau or 0) > 105: erreurs.append(f'{ou} : plus de 105 g pour 100 g')
        if not r['source'].strip(): erreurs.append(f'{ou} : source vide')
        s_norm = normalize(r['nom'])
        if s_norm in noms_ciqual or s_norm in noms_vus: erreurs.append(f'{ou} : nom déjà pris « {r["nom"]} »')
        noms_vus.add(s_norm)
        alias = sorted({norm_alias(a) for a in r['alias'].split('|') if a.strip()})
        for a in alias:
            if a in noms_ciqual or a in alias_ciqual: erreurs.append(f'{ou} : alias « {a} » déjà pris par une fiche Ciqual')
        e = {'id': i, 'n': r['nom'].strip(), 'g': (r['groupe'].strip() or GROUPE_SPORT), 's': s_norm,
             'k': k, 'p': p, 'c': c, 'l': l}
        # Fibres inconnues : clé ABSENTE, jamais 0 (même règle que Ciqual).
        if f is not None: e['f'] = f
        if sel is not None: e['e'] = sel
        if alias: e['a'] = alias
        # La portion (portion_lib, portion_g) est lue par poser_unites (unités
        # naturelles « u ») : elle ne s'écrit pas ici.
        if r['portion_lib'].strip() and _num(r['portion_g']):
            e['_portion'] = (r['portion_lib'].strip(), _num(r['portion_g']))
        e['src'] = 'repcore'
        out.append(e)
    if erreurs:
        print('  ✗ repcore_generiques.csv refusé :')
        for x in erreurs: print('    - ' + x)
        sys.exit(1)
    out.sort(key=lambda e: -e['id'])
    return out

# ── Les alias de recherche (champ "a") ───────────────────────────────────
# Les noms Ciqual sont des noms de laboratoire (« Boisson à l'amande ») ; l'athlète
# tape « lait d'amande ». scripts/alias_aliments.tsv dit, une ligne par alias,
# quelles fiches il désigne. L'alias est écrit DÉJÀ normalisé comme f.s, plus
# l'apostrophe changée en espace (la requête la change aussi côté app).
# ⚠ UN ID ABSENT DE LA TABLE FAIT ÉCHOUER LA GÉNÉRATION : un alias orphelin est
# une recherche cassée, et personne ne le verrait.
ALIAS = os.path.join(os.path.dirname(__file__), 'alias_aliments.tsv')

def norm_alias(t):
    return re.sub(r'\s+', ' ', re.sub(r"['’]", ' ', normalize(t))).strip()

def lire_alias():
    par_id = {}
    if not os.path.exists(ALIAS):
        return par_id
    with open(ALIAS, encoding='utf-8') as fp:
        for n, ligne in enumerate(fp, 1):
            ligne = ligne.rstrip('\n')
            if not ligne.strip() or ligne.startswith('#'):
                continue
            cols = ligne.split('\t')
            if len(cols) < 2:
                print(f'  ✗ alias_aliments.tsv:{n} : colonne id manquante')
                sys.exit(1)
            a = norm_alias(cols[0])
            if not a:
                continue
            for i in cols[1].split(','):
                par_id.setdefault(int(i.strip()), []).append(a)
    return par_id

def poser_alias(out, garder_csv=False):
    par_id = lire_alias()
    ids = {e['id'] for e in out}
    orphelins = sorted(i for i in par_id if i not in ids and not (garder_csv is False and i < 0))
    if orphelins:
        print(f'  ✗ Alias vers des ids absents de la table : {orphelins}')
        sys.exit(1)
    n = 0
    for e in out:
        # Les alias des génériques viennent de leur CSV (garder_csv) ; ceux du
        # TSV s'y ajoutent.
        avant = e.get('a') if (garder_csv and e.get('src') == 'repcore') else None
        e.pop('a', None)
        tous = set(avant or []) | set(par_id.get(e['id'], []))
        if tous:
            e['a'] = sorted(tous)
            n += len(e['a'])
    print(f'  Alias de recherche : {n} sur {sum(1 for e in out if "a" in e)} fiches')
    return out

# ── Les fiches de référence (champ "r") ──────────────────────────────────
# « pain » rendait le Pain perdu en premier et la baguette en dixième.
# scripts/references_aliments.tsv dit, pour un mot de tête, LA fiche que
# l'athlète attend ; l'app la fait passer devant quand le premier mot de la
# requête est ce mot. "r" porte les mots de tête (et non un simple 1) : une
# fiche peut en avoir plusieurs (« pate » et « spaghetti »).
REFERENCES = os.path.join(os.path.dirname(__file__), 'references_aliments.tsv')

def poser_references(out):
    par_id = {}
    if os.path.exists(REFERENCES):
        with open(REFERENCES, encoding='utf-8') as fp:
            for ligne in fp:
                if not ligne.strip() or ligne.startswith('#'):
                    continue
                cols = ligne.rstrip('\n').split('\t')
                par_id.setdefault(int(cols[1]), []).append(norm_alias(cols[0]))
    ids = {e['id'] for e in out}
    orphelins = sorted(i for i in par_id if i not in ids)
    if orphelins:
        print(f'  ✗ Références vers des ids absents de la table : {orphelins}')
        sys.exit(1)
    for e in out:
        e.pop('r', None)
        if e['id'] in par_id:
            e['r'] = sorted(set(par_id[e['id']]))
    print(f'  Fiches de référence : {len(par_id)}')
    return out

def completer(out):
    """Énergie calculée là où elle manque, puis le bloc générique (remplacé
    s'il existait déjà : le script peut repasser sans rien dupliquer), puis
    les alias de recherche."""
    base = [e for e in out if not (isinstance(e.get('id'), int) and e['id'] < 0)]
    n = 0
    for e in base:
        k = kcal_calculee(e)
        if k is not None:
            e['k'] = k
            e['k_calc'] = True
            n += 1
    print(f'  Énergie calculée (4p + 4c + 9l + 2f) : {n} aliments')
    base = poser_alias(base)
    g = generiques(base)
    print(f'  Aliments génériques RepCore : {len(g)}')
    return poser_references(poser_alias(base + g, garder_csv=True))

def ecrire(out):
    """JSON STABLE : même entrée, même sortie, octet pour octet. La base Ciqual
    garde l'ordre de la table, les génériques suivent par id (-1, -2, …), et
    chaque fiche écrit ses clés dans un ordre fixe. La version écrite dans
    app/data/ciqual.version est la date de la table Anses suivie d'une
    empreinte du contenu — pas la date du jour, qui casserait la reproductibilité.
    sw.js (CIQUAL_VERSION) doit porter la même chaîne : un test le vérifie."""
    import hashlib
    ORDRE = ['id', 'n', 'g', 's', 'k', 'p', 'c', 'l', 'f', 'e']
    def trie(e):
        return {**{k: e[k] for k in ORDRE if k in e}, **{k: e[k] for k in sorted(e) if k not in ORDRE}}
    out = [trie({k: v for k, v in e.items() if not k.startswith('_')}) for e in out]
    avant = {}
    if os.path.exists(DST):
        try:
            with open(DST, encoding='utf-8') as fp:
                avant = {e['id']: e for e in json.load(fp)}
        except Exception:
            avant = {}
    texte = json.dumps(out, ensure_ascii=False, separators=(',', ':'))
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, 'w', encoding='utf-8') as fp:
        fp.write(texte)
    version = '2025-11-03+' + hashlib.sha256(texte.encode('utf-8')).hexdigest()[:10]
    with open(os.path.join(os.path.dirname(DST), 'ciqual.version'), 'w', encoding='utf-8') as fp:
        fp.write(version)
    apres = {e['id']: e for e in out}
    ajouts = sorted(i for i in apres if i not in avant)
    retraits = sorted(i for i in avant if i not in apres)
    modifs = sorted(i for i in apres if i in avant and apres[i] != avant[i])
    print(f'  Écrit : {DST} ({os.path.getsize(DST)/1024:.0f} KB), version {version}')
    print(f'  Delta : {len(ajouts)} ajout(s), {len(modifs)} modification(s), {len(retraits)} retrait(s)')
    if ajouts: print(f'    ajouts : {ajouts[:20]}{" …" if len(ajouts) > 20 else ""}')
    if retraits: print(f'    retraits : {retraits[:20]}')

if '--depuis-json' in sys.argv:
    with open(DST, encoding='utf-8') as fp:
        existant = json.load(fp)
    print(f'Complète {DST} ({len(existant)} entrées) ...')
    ecrire(completer(existant))
    sys.exit(0)

import pandas as pd
print(f'Reading {SRC} ...')
df = pd.read_excel(SRC, dtype=str)
print(f'  {len(df)} rows, {len(df.columns)} columns')

# Column indices (0-based)
COL_ID    = 6   # alim_code
COL_NOM   = 7   # alim_nom_fr
COL_GRP   = 3   # alim_grp_nom_fr
COL_KCAL  = 10  # Énergie EU kcal/100g
COL_PROT  = 14  # Protéines Jones g/100g
COL_GLUC  = 16  # Glucides g/100g
COL_LIP   = 17  # Lipides g/100g
COL_FIB   = 26  # Fibres g/100g
COL_SEL   = 49  # Sel g/100g

# Micronutriments. Clé courte → indice de colonne, comme les macros ci-dessus.
# 'k_' et non 'k' : 'k' porte déjà les kilocalories depuis la première version,
# et le potassium ne peut pas la lui prendre sans casser tous les dossiers.
COLS_MICRO = {
    'fe':  53,  # Fer (mg/100 g)
    'ca':  50,  # Calcium (mg/100 g)
    'mg':  55,  # Magnésium (mg/100 g)
    'zn':  61,  # Zinc (mg/100 g)
    'io':  54,  # Iode (µg/100 g)
    'k_':  58,  # Potassium (mg/100 g)
    'b9':  78,  # Vitamine B9, folates totaux, équivalents DFE (µg/100 g)
    'b12': 82,  # Vitamine B12 (µg/100 g)
}

cols = list(df.columns)
out = []
skipped = 0
couverture = {}

for _, row in df.iterrows():
    alim_id = str(row.iloc[COL_ID]).strip()
    nom     = str(row.iloc[COL_NOM]).strip()
    # Skip header rows or empty
    if not alim_id or alim_id in ('nan','alim_code') or not nom or nom == 'nan':
        skipped += 1
        continue
    try:
        alim_id = int(float(alim_id))
    except (ValueError, TypeError):
        skipped += 1
        continue

    groupe = str(row.iloc[COL_GRP]).strip()
    if groupe == 'nan':
        groupe = ''

    kcal = parse_fr(row.iloc[COL_KCAL])
    prot = parse_fr(row.iloc[COL_PROT])
    gluc = parse_fr(row.iloc[COL_GLUC])
    lip  = parse_fr(row.iloc[COL_LIP])
    fib  = parse_fr(row.iloc[COL_FIB])
    sel  = parse_fr(row.iloc[COL_SEL])

    entry = {
        'id': alim_id,
        'n':  nom,
        'g':  groupe,
        's':  normalize(nom),   # search index
    }
    # Only include non-null macros
    if kcal is not None: entry['k'] = kcal
    if prot is not None: entry['p'] = prot
    if gluc is not None: entry['c'] = gluc
    if lip  is not None: entry['l'] = lip
    if fib  is not None: entry['f'] = fib
    if sel  is not None: entry['e'] = sel

    # Micronutriments : la clé est ABSENTE quand la valeur est inconnue.
    for cle, idx in COLS_MICRO.items():
        v = parse_micro(row.iloc[idx])
        if v is not None:
            entry[cle] = v
            couverture[cle] = couverture.get(cle, 0) + 1

    out.append(entry)

print(f'  {len(out)} aliments convertis, {skipped} lignes ignorées')
print('  Couverture des micronutriments (part des aliments ayant une valeur) :')
for cle in COLS_MICRO:
    n = couverture.get(cle, 0)
    print(f'    {cle:4} {n:5} / {len(out)}  ({100*n/max(1,len(out)):5.1f} %)')

out = completer(out)
ecrire(out)
print('Done.')
print()
print('Source : Anses. 2025. Table de composition nutritionnelle des aliments Ciqual')
