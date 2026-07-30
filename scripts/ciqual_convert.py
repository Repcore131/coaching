"""
Ciqual 2025 → ciqual.json
Converts the Anses Ciqual 2025 xlsx to a lightweight JSON for RepCore.
Usage: python scripts/ciqual_convert.py
Output: data/ciqual.json (~850 KB)

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
import pandas as pd

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

os.makedirs(os.path.dirname(DST), exist_ok=True)
with open(DST, 'w', encoding='utf-8') as fp:
    json.dump(out, fp, ensure_ascii=False, separators=(',', ':'))

size_kb = os.path.getsize(DST) / 1024
print(f'  Écrit : {DST}')
print(f'  Taille : {size_kb:.0f} KB')
print('Done.')
print()
print('Source : Anses. 2025. Table de composition nutritionnelle des aliments Ciqual')
