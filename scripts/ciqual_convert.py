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

# Valeurs moyennes pour 100 g, relevées sur les étiquettes de produits
# courants du commerce (plusieurs marques, 2025-2026) et arrondies. Elles
# ne viennent PAS de Ciqual : chaque ligne dit ce qu'elle représente.
GROUPE_SPORT = 'produits pour sportifs'
GENERIQUES = [
    # Whey concentrée (~80 % de protéines) : étiquettes de whey « standard ».
    (-1,  'Whey concentrée (protéine de lactosérum), poudre',        390, 76,  8,   6,   0,   0.5),
    # Whey isolat (~90 %) : quasi sans lactose ni graisse.
    (-2,  'Whey isolat, poudre',                                     370, 88,  2,   1,   0,   0.5),
    # Caséine micellaire : protéine lente du lait.
    (-3,  'Caséine micellaire, poudre',                              355, 78,  6,   1.5, 0,   0.6),
    # Protéine végétale (mélange pois et riz).
    (-4,  'Protéine végétale (pois et riz), poudre',                 380, 75,  5,   7,   3,   1.5),
    # Clear whey : isolat hydrolysé, se boit comme un jus.
    (-5,  'Clear whey (isolat hydrolysé), poudre',                   360, 85,  3,   0.5, 0,   0.3),
    # Skyr nature 0 % : valeurs d'étiquettes des skyrs du rayon frais.
    (-6,  'Skyr nature',                                             63,  11,  4,   0.2, 0,   0.1),
    # Gel énergétique : sachets de 30 à 40 g, ramenés à 100 g.
    (-7,  'Gel énergétique',                                         270, 0,   67,  0,   0,   0.2),
    # Boisson isotonique prête à boire (100 ml ≈ 100 g).
    (-8,  'Boisson isotonique, prête à boire',                       25,  0,   6,   0,   0,   0.1),
    # Barre protéinée : moyenne de barres à ~30 % de protéines.
    (-9,  'Barre protéinée',                                         360, 33,  35,  11,  5,   0.6),
    # Maltodextrine : glucide pur en poudre.
    (-10, 'Maltodextrine, poudre',                                   380, 0,   95,  0,   0,   0),
    # Crème de riz : farine de riz précuite.
    (-11, 'Crème de riz, poudre',                                    360, 7,   80,  1,   1,   0),
]

def generiques():
    out = []
    for (i, nom, k, p, c, l, f, e) in GENERIQUES:
        out.append({'id': i, 'n': nom, 'g': GROUPE_SPORT, 's': normalize(nom),
                    'k': float(k), 'p': float(p), 'c': float(c), 'l': float(l),
                    'f': float(f), 'e': float(e), 'src': 'repcore'})
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

def poser_alias(out):
    par_id = lire_alias()
    ids = {e['id'] for e in out}
    orphelins = sorted(i for i in par_id if i not in ids)
    if orphelins:
        print(f'  ✗ Alias vers des ids absents de la table : {orphelins}')
        sys.exit(1)
    n = 0
    for e in out:
        e.pop('a', None)
        if e['id'] in par_id:
            e['a'] = sorted(set(par_id[e['id']]))
            n += len(e['a'])
    print(f'  Alias de recherche : {n} sur {sum(1 for e in out if "a" in e)} fiches')
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
    g = generiques()
    print(f'  Aliments génériques RepCore : {len(g)}')
    return poser_alias(base + g)

def ecrire(out):
    os.makedirs(os.path.dirname(DST), exist_ok=True)
    with open(DST, 'w', encoding='utf-8') as fp:
        json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))
    print(f'  Écrit : {DST} ({os.path.getsize(DST)/1024:.0f} KB)')

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
