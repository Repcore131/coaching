#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LE THEME CLAIR, GENERE depuis la feuille sombre.

POURQUOI UN GENERATEUR. RepCore a ete dessine en sombre, et pas seulement par
ses jetons : environ 1 700 couleurs sont ecrites en dur dans la feuille, 1 100
dans les styles en ligne du code, 300 dans app/index.html. Les repeindre a la
main, c'est des semaines ; en oublier une, c'est un texte blanc sur fond blanc.
Ce script relit TOUTES les regles qui portent une couleur et en ecrit une
copie « claire », prefixee par :root[data-theme="clair"], entre deux
marqueurs, dans app/rc-theme.<build>.css depuis le 01/10/2026 (avant : a la
fin de app/rc-style.<build>.css ; voir scripts/extraire_theme_clair.py). Il est IDEMPOTENT : il retire
d'abord le bloc qu'il avait genere.

LA TRANSFORMATION (voir `clair`) : la luminosite est RETOURNEE, la teinte et la
saturation gardees — #080808 devient #f4f4f4, #efefef devient #181818, le fond
rouge tres sombre #0d0000 devient un rose pale. Les couleurs vives de milieu de
gamme (le rouge de la marque, le vert) restent telles quelles en fond ; en
TEXTE elles sont assombries pour rester lisibles sur du blanc. Les ombres
noires restent noires, en plus leger ; les reflets blancs restent blancs.

L'ORDRE DE LA CASCADE EST GARDE : dans une regle qui porte une couleur, TOUTES
ses declarations de couleur sont recopiees, meme inchangees. Sans cela, une
regle plus specifique qui ne porte qu'un var(--red) (et n'aurait donc rien a
changer) perdrait contre la copie claire d'une regle plus generale.

LES STYLES EN LIGNE (style="background:#111" ecrit par le code) : un selecteur
d'attribut [style*="background:#111"] les rattrape, en !important.

LE CONTRASTE EST GARANTI (01/10/2026). Retourner la luminosite ne suffisait
pas : --sub et --text-dim tombaient sur #787878 (4,0:1 sur #f4f4f4, 3,5:1 sur
#e4e4e4), --text-faint sur #808080 (3,5:1), pour des textes de 10 a 12 px.
Chaque couleur au role 'texte' (dont chaque jeton texte de :root) est donc
ASSOMBRIE, meme teinte, par pas de 0,01 de luminosite, jusqu'a 4,5:1 (WCAG 2.1,
AA) contre CHACUN des fonds clairs (FONDS_CLAIRS : #f4f4f4, #ebebeb, et les
surfaces --bg, --surface-0 a --surface-3 et --dark telles qu'elles sortent en
clair). Les couleurs de marque (--green, --orange, --info, --warning-*,
--amber, --gluc, --pub-*) gardent leur eclat en fond et en bordure : elles
recoivent une VARIANTE TEXTE (--green-text, --orange-text…), et
color:var(--green) devient color:var(--green-text) dans les regles copiees et
dans les styles en ligne. Un texte clair sur un fond franc (bouton rouge) passe
au blanc pur s'il n'atteint pas 4,5:1.

LES VOILES NOIRS — un fond dont tous les arrets sont rgba(0,0,0,a) ou
transparent, sur un calque position:absolute;inset:0 — deviennent transparents
en clair : sur fond clair, ils ne faisaient que salir (.vignette-entree des
ecrans d'entree).

CE QUI NE CHANGE PAS : les images, les <canvas> (les visuels partages restent
aux couleurs de la marque), les @keyframes.

Usage : python3 scripts/theme_clair.py              (apres versionner_actifs.py)
        python3 scripts/theme_clair.py --verifier   ne modifie rien. Calcule le
            contraste de chaque jeton texte (et variante) contre chaque fond
            clair, et de chaque paire (color, background) resolue des regles
            generees ; sort en 1 s'il reste un texte sous 4,5:1.
"""
import colorsys, glob, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEBUT = '/* ═══ THEME CLAIR — GENERE PAR scripts/theme_clair.py, NE PAS MODIFIER A LA MAIN ═══ */'
FIN = '/* ═══ FIN DU THEME CLAIR GENERE ═══ */'
PREFIXE = ':root[data-theme="clair"]'

PROPS_COULEUR = re.compile(r'^(color|background(-color|-image)?|border(-(top|right|bottom|left|block|inline)(-start|-end)?)?(-color)?|outline(-color)?|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|column-rule(-color)?|text-decoration(-color)?|--[\w-]+|stop-color|scrollbar-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?|filter)$')
PROPS_TEXTE = re.compile(r'^(color|caret-color|-webkit-text-fill-color|text-decoration(-color)?|fill|stroke)$')
PROPS_OMBRE = re.compile(r'^(box-shadow|text-shadow|filter)$')

NOMMEES = {'white': (255, 255, 255, 1.0), 'black': (0, 0, 0, 1.0)}
RE_COUL = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^()]*\)|(?<![\w-])(?:white|black)(?![\w-])')


def lire(c):
    c = c.strip()
    if c in NOMMEES:
        return NOMMEES[c]
    if c.startswith('#'):
        h = c[1:]
        if len(h) in (3, 4):
            h = ''.join(x * 2 for x in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (r, g, b, a)
    m = re.match(r'rgba?\(([^()]*)\)', c)
    if not m:
        return None
    p = [x for x in re.split(r'[\s,/]+', m.group(1).strip()) if x]
    if len(p) < 3 or any('var' in x for x in p):
        return None
    try:
        v = [float(x[:-1]) * 2.55 if x.endswith('%') else float(x) for x in p[:3]]
        a = p[3] if len(p) > 3 else '1'
        a = float(a[:-1]) / 100 if a.endswith('%') else float(a)
    except ValueError:
        return None
    return (v[0], v[1], v[2], a)


def ecrire(r, g, b, a, forme):
    r, g, b = (max(0, min(255, round(x))) for x in (r, g, b))
    if forme == 'rgb' or a < 0.999:
        a = round(a, 3)
        return 'rgba(%d,%d,%d,%s)' % (r, g, b, ('%g' % a))
    return '#%02x%02x%02x' % (r, g, b)


def role_de(prop):
    if PROPS_OMBRE.match(prop):
        return 'ombre'
    if PROPS_TEXTE.match(prop):
        return 'texte'
    if prop.startswith('--'):
        n = prop.lower()
        if n in ('--scrim',):
            return 'garder'
        if 'shadow' in n or 'glow' in n or 'halo' in n or n.startswith('--e') and re.match(r'^--e(\d|-)', n) or n.startswith('--elev') or n.startswith('--el-'):
            return 'ombre'
        if any(k in n for k in ('text', 'link', 'sub', 'faint', 'dim', 'mid', 'strong')):
            return 'texte'
    return 'fond'


def clair(c, role):
    v = lire(c)
    if v is None:
        return c
    r, g, b, a = v
    forme = 'rgb' if c.startswith('rgb') else 'hex'
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if role == 'garder':
        return c
    if role == 'ombre':
        if l < 0.35:                      # une ombre reste une ombre, plus legere
            return ecrire(r, g, b, a * 0.35, 'rgb')
        return c                          # reflets et lueurs : tels quels
    neutre = s < 0.25 or l < 0.12 or l > 0.9
    if neutre:
        l2 = 0.985 - l * 0.95
    elif role == 'texte':
        l2 = min(l, 0.4)
    else:
        l2 = l
    if abs(l2 - l) < 1e-6:
        out = c
    else:
        r2, g2, b2 = colorsys.hls_to_rgb(h, l2, s)
        out = ecrire(r2 * 255, g2 * 255, b2 * 255, a, forme)
    # UN TEXTE TIENT 4,5:1 SUR TOUS LES FONDS CLAIRS (01/10/2026).
    return lisible(out) if role == 'texte' else out


# ── LE CONTRASTE, WCAG 2.1 ───────────────────────────────────────────────────
SEUIL = 4.5
# Les fonds clairs contre lesquels un texte doit tenir. Les deux premiers sont
# ceux du cahier des charges (--bg et --surface-1 en clair) ; preparer_fonds()
# y ajoute les autres surfaces, telles que ce script les produit.
FONDS_CLAIRS = [(244, 244, 244), (235, 235, 235)]


def _lin(c):
    c = c / 255
    return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4


def luminance(rgb):
    r, g, b = rgb[:3]
    return 0.2126 * _lin(r) + 0.7152 * _lin(g) + 0.0722 * _lin(b)


def _rgba(c):
    """Une couleur (chaine CSS ou tuple) en (r, g, b, a)."""
    if isinstance(c, str):
        return lire(c)
    return tuple(c) + ((1.0,) if len(c) == 3 else ())


def contraste(c1, c2):
    """Rapport de contraste WCAG 2.1 de c1 (texte) sur c2 (fond opaque). Un
    texte translucide est d'abord pose sur le fond."""
    a, b = _rgba(c1), _rgba(c2)
    if a is None or b is None:
        return None
    t = a[3]
    texte = tuple(a[i] * t + b[i] * (1 - t) for i in range(3))
    l1, l2 = luminance(texte), luminance(b)
    return (max(l1, l2) + 0.05) / (min(l1, l2) + 0.05)


def contraste_min(c, fonds=None):
    return min(contraste(c, f) for f in (fonds or FONDS_CLAIRS))


# Les fonds propres de la regle en cours (regle_claire), quand elle en porte un
# d'une seule couleur : le texte se juge alors contre LUI, pas contre les fonds
# clairs de l'application (une page « papier » retournee en sombre, un bandeau).
FONDS_REGLE = None


def lisible(c, fonds=None):
    """Ajuste c (meme teinte, meme saturation, luminosite par pas de 0,01)
    jusqu'a SEUIL contre chacun des fonds : FONDS_REGLE s'il est pose, sinon
    FONDS_CLAIRS. On ASSOMBRIT sur un fond clair, on ECLAIRCIT sur un fond
    sombre. Rend c tel quel s'il tient deja, ou si ce n'est pas une couleur que
    ce script sait lire."""
    fonds = fonds or FONDS_REGLE or FONDS_CLAIRS
    v = lire(c)
    if v is None or contraste_min(v, fonds) >= SEUIL:
        return c
    r, g, b, a = v
    forme = 'rgb' if c.startswith('rgb') or a < 0.999 else 'hex'
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    fond_clair = sum(luminance(f) for f in fonds) / len(fonds) > 0.18
    pas = -0.01 if fond_clair else 0.01
    out = c
    while 0 < l < 1:
        l = max(0.0, min(1.0, round(l + pas, 4)))
        r2, g2, b2 = colorsys.hls_to_rgb(h, l, s)
        out = ecrire(r2 * 255, g2 * 255, b2 * 255, a, forme)
        # On juge la couleur ECRITE (arrondie), pas la valeur calculee.
        if contraste_min(lire(out), fonds) >= SEUIL:
            break
    return out


def preparer_fonds():
    """Ajoute aux fonds de reference les surfaces que ce script produit en clair."""
    for n in ('--bg', '--surface-0', '--surface-1', '--surface-2', '--surface-3', '--dark'):
        v = JETONS_SOMBRES.get(n)
        c = lire(clair(v, 'fond')) if v else None
        if c and c[3] >= 0.999:
            t = tuple(round(x) for x in c[:3])
            if t not in FONDS_CLAIRS:
                FONDS_CLAIRS.append(t)


# ── LES VARIANTES TEXTE DES COULEURS DE MARQUE ─────────────────────────────
# Ces jetons sont des couleurs franches : en fond et en bordure, elles gardent
# leur eclat ; en TEXTE sur fond clair, --green #22c55e tombait a 1,8:1 (« Ton
# premier mois est complet », s-athlete-entry). Chacun recoit un jumeau
# --<nom>-text, assombri jusqu'a SEUIL, et les proprietes de texte des regles
# copiees (et des styles en ligne) y sont redirigees.
PREFIXES_VARIANTE = ('--green', '--orange', '--info', '--warning', '--amber', '--gluc', '--pub', '--success')
# Un jeton de fond, de bordure ou de lueur n'est pas une couleur de texte.
NON_TEXTE = re.compile(r'-(bg|border|glow|shadow|halo)(-|$)')
VARIANTES = {}          # nom -> valeur claire de sa variante (couleur, ou 'alias')
ALIAS = {}              # nom -> le jeton dont il est l'alias (var(--y))


def peut_varier(nom):
    return nom.startswith(PREFIXES_VARIANTE) and not NON_TEXTE.search(nom) and not nom.endswith('-text')


def preparer_variantes(css):
    """Les jetons de marque litteraux de :root, puis, jusqu'a stabilite, tout
    alias --x: var(--y) (dans :root ou dans une regle) dont --y a une variante."""
    for n, v in JETONS_SOMBRES.items():
        if peut_varier(n):
            VARIANTES[n] = lisible(clair(v, 'fond'))

    def parcourir(c):
        for tete, corps in blocs(c):
            if tete.startswith('@'):
                parcourir(corps)
                continue
            for p, v in declarations(corps):
                m = re.fullmatch(r'var\((--[\w-]+)\)', v.strip())
                if p.startswith('--') and m and not NON_TEXTE.search(p) and not p.endswith('-text'):
                    ALIAS.setdefault(p, set()).add(m.group(1))
    parcourir(css)
    change = True
    while change:
        change = False
        for p, cibles in ALIAS.items():
            if p not in VARIANTES and any(c in VARIANTES for c in cibles):
                VARIANTES[p] = 'alias'
                change = True


def vers_variante(valeur):
    """var(--green) -> var(--green-text), pour les jetons qui ont une variante."""
    return re.sub(r'var\((--[\w-]+)', lambda m: 'var(' + m.group(1) + '-text' if m.group(1) in VARIANTES else m.group(0), valeur)


def variante_de(p, v):
    """La declaration de la variante texte d'un jeton --p, ou None."""
    if p not in VARIANTES:
        return None
    m = re.fullmatch(r'var\((--[\w-]+)\)', v.strip())
    if m and m.group(1) in VARIANTES:
        return p + '-text:var(' + m.group(1) + '-text)'
    if VARIANTES[p] != 'alias' and RE_COUL.fullmatch(v.strip()):
        return p + '-text:' + lisible(clair(v.strip(), 'fond'))
    return None


# ── LES VOILES NOIRS ─────────────────────────────────────────────────────────
def voile_noir(decl):
    """Un calque position:absolute;inset:0 dont le fond n'est fait que de noir
    translucide (et de transparent) : en clair, il ne fait que salir."""
    d = {p: v.strip() for p, v in decl}
    if d.get('position') != 'absolute' or d.get('inset') not in ('0', '0px'):
        return False
    fond = d.get('background') or d.get('background-image') or ''
    if 'gradient' not in fond:
        return False
    arrets = RE_COUL.findall(fond)
    if not arrets:
        return False
    for a in arrets:
        v = lire(a)
        if v is None or v[:3] != (0, 0, 0) or v[3] >= 0.999:
            return False
    return True


def serialise(valeur):
    def un(m):
        c = m.group(0)
        if c in NOMMEES:
            return c
        v = lire(c)
        if v is None:
            return c
        r, g, b, a = (round(v[0]), round(v[1]), round(v[2]), v[3])
        if a >= 0.999:
            return 'rgb(%d, %d, %d)' % (r, g, b)
        return 'rgba(%d, %d, %d, %s)' % (r, g, b, ('%g' % round(a, 3)))
    return RE_COUL.sub(un, valeur)


def transformer(valeur, role):
    return RE_COUL.sub(lambda m: clair(m.group(0), role), valeur)


def a_couleur(valeur):
    return bool(RE_COUL.search(valeur)) or 'var(--' in valeur


# ── Un analyseur minimal : commentaires et chaines respectes ─────────────────
def sans_commentaires(css):
    out, i, n = [], 0, len(css)
    while i < n:
        if css.startswith('/*', i):
            j = css.find('*/', i + 2)
            i = n if j < 0 else j + 2
            continue
        ch = css[i]
        if ch in '"\'':
            j = i + 1
            while j < n and css[j] != ch:
                j += 2 if css[j] == '\\' else 1
            out.append(css[i:j + 1]); i = j + 1; continue
        out.append(ch); i += 1
    return ''.join(out)


def blocs(css):
    """Rend [(tete, corps)] au premier niveau ; corps = texte entre accolades."""
    res, i, n = [], 0, len(css)
    while i < n:
        j = i; prof = 0
        while j < n and css[j] != '{':
            if css[j] == ';' and prof == 0:
                i = j + 1
            j += 1
        if j >= n:
            break
        tete = css[i:j].strip()
        k = j + 1; prof = 1
        while k < n and prof:
            ch = css[k]
            if ch in '"\'':
                q = ch; k += 1
                while k < n and css[k] != q:
                    k += 2 if css[k] == '\\' else 1
            elif ch == '{':
                prof += 1
            elif ch == '}':
                prof -= 1
            k += 1
        res.append((tete, css[j + 1:k - 1]))
        i = k
    return res


def declarations(corps):
    out, cur, prof, q = [], '', 0, None
    for ch in corps:
        if q:
            cur += ch
            if ch == q:
                q = None
            continue
        if ch in '"\'':
            q = ch
        elif ch == '(':
            prof += 1
        elif ch == ')':
            prof -= 1
        if ch == ';' and prof == 0:
            out.append(cur); cur = ''
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    res = []
    for d in out:
        if ':' not in d:
            continue
        p, v = d.split(':', 1)
        res.append((p.strip(), v.strip()))
    return res


def prefixer(sel):
    parts, cur, prof = [], '', 0
    for ch in sel:
        if ch in '([':
            prof += 1
        elif ch in ')]':
            prof -= 1
        if ch == ',' and prof == 0:
            parts.append(cur); cur = ''
        else:
            cur += ch
    parts.append(cur)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if p.startswith(':root'):
            out.append(PREFIXE + p[5:])
        elif re.match(r'^html(?![\w-])', p):
            out.append('html[data-theme="clair"]' + p[4:])
        else:
            out.append(PREFIXE + ' ' + p)
    return ','.join(out)


# ⚠ var(--red-bg), var(--warning-bg)… NE SONT PAS des fonds francs (01/10/2026) :
#   en clair, ce sont des roses et des cremes tres pales. Les prendre pour du
#   rouge laissait du texte blanc dessus (1,00:1 : .pf-chip.active, .choice-opt.sel).
FOND_VIF = re.compile(r'var\(--(?:red|green|danger|success|orange|amber|warning|gold|info|accent|pub-|cycle|arc-)(?![\w-]*-(?:bg|border)\b)|#(e02020|b81515|ff3345|22c55e|f97316|f59e0b|f5c518|ff3b30)', re.I)


def vif(valeur):
    """Un fond de couleur franche (le rouge, le vert…) : le texte blanc y reste blanc."""
    if FOND_VIF.search(valeur):
        return True
    for m in RE_COUL.finditer(valeur):
        v = lire(m.group(0))
        if v and v[3] > 0.5:
            h, l, s = colorsys.rgb_to_hls(v[0] / 255, v[1] / 255, v[2] / 255)
            if s >= 0.4 and 0.25 < l < 0.75:
                return True
    return False


def regle_claire(sel, corps):
    decl = declarations(corps)
    coul = [(p, v) for p, v in decl if PROPS_COULEUR.match(p) and a_couleur(v)]
    if not coul:
        return None
    if not any(RE_COUL.search(v) for _, v in coul):
        # Rien a transformer : on ne recopie que si la regle doit garder son
        # rang face a une copie claire plus generale (var() de couleur).
        pass
    fond_vif = any(p.startswith('background') and vif(v) for p, v in coul)
    noir = voile_noir(decl)
    global FONDS_REGLE
    FONDS_REGLE = fond_propre(coul)
    lignes = []
    for p, v in coul:
        role = role_de(p)
        if noir and p in ('background', 'background-image'):
            lignes.append(p + ':none')
            continue
        if role == 'texte' and fond_vif:
            # Du blanc sur un bouton rouge reste blanc — y compris quand il est
            # ecrit var(--text), jeton qui, lui, passe au noir en clair.
            v = re.sub(r'var\((--[\w-]+)\)', lambda m: JETONS_SOMBRES.get(m.group(1), m.group(0)) if 'text' in m.group(1) else m.group(0), v)
            v = blanc_si_mieux(v, [vv for pp, vv in coul if pp.startswith('background')])
            role = 'garder'
        elif role == 'texte':
            v = vers_variante(v)
            v = jeton_sur_fond_propre(v)
        lignes.append(p + ':' + transformer(v, role))
        var = variante_de(p, v)
        if var:
            lignes.append(var)
    FONDS_REGLE = None
    return prefixer(sel) + '{' + ';'.join(lignes) + '}'


def jeton_sur_fond_propre(v):
    """Un texte ecrit var(--jeton) sur un fond que la regle pose elle-meme :
    le jeton tient 4,5:1 sur les fonds de l'application, pas forcement sur
    celui-ci (.sv-tuile-ico : --text-dim sur #dbdbe0, 4,49:1). Il est alors
    remplace, dans la copie claire de CETTE regle, par sa valeur ajustee."""
    global FONDS_REGLE
    m = re.fullmatch(r'var\((--[\w-]+)\)', v.strip())
    if not FONDS_REGLE or not m:
        return v
    nom = m.group(1)
    base = nom[:-5] if nom.endswith('-text') and nom[:-5] in VARIANTES else nom
    sombre = JETONS_SOMBRES.get(base)
    if not sombre:
        return v
    propre, FONDS_REGLE = FONDS_REGLE, None
    try:
        jeton = clair(sombre, 'fond') if base != nom else clair(sombre, role_de(nom))
        jeton = lisible(jeton)                       # sa valeur, sur les fonds de l'application
    finally:
        FONDS_REGLE = propre
    c = lire(jeton)
    if not c or contraste_min(c, propre) >= SEUIL:
        return v
    return lisible(jeton, propre)


def fond_propre(coul):
    """Le fond d'UNE couleur opaque que la regle pose elle-meme, tel qu'il sort
    en clair ; None s'il n'y en a pas (ou si c'est un degrade, une image, un
    melange : le texte se juge alors contre les fonds de l'application)."""
    for p, v in coul:
        if p not in ('background', 'background-color'):
            continue
        v = v.replace('!important', '').strip()
        if re.search(r'gradient|url\(|color-mix|\s', v):
            return None
        m = re.fullmatch(r'var\((--[\w-]+)(?:,[^()]*)?\)', v)
        if m:
            v = JETONS_SOMBRES.get(m.group(1), '')
        if not RE_COUL.fullmatch(v or ''):
            return None
        c = lire(clair(v, 'fond'))
        if c and c[3] >= 0.95:
            return [tuple(round(x) for x in c[:3])]
        return None
    return None


def couleurs_de_fond(valeurs):
    """Les couleurs opaques d'un fond (litterales, ou jetons resolus en sombre :
    les fonds francs ne changent pas en clair)."""
    out = []
    for v in valeurs:
        v = re.sub(r'var\((--[\w-]+)\)', lambda m: JETONS_SOMBRES.get(m.group(1), m.group(0)), v)
        for m in RE_COUL.finditer(v):
            c = lire(m.group(0))
            if c and c[3] >= 0.95:
                out.append(c[:3])
    return out


def blanc_si_mieux(v, fonds):
    """Un texte clair sur un fond franc qui n'atteint pas SEUIL : du blanc pur
    s'il y suffit (#efefef sur le rouge de la marque : 4,2:1 ; #fff : 4,8:1),
    sinon un quasi-noir s'il fait mieux (le blanc sur le vert #22c55e plafonne
    a 2,3:1, le noir y atteint 9:1). Les fonds francs ne changent pas en clair :
    on les lit tels que la feuille sombre les ecrit."""
    c = lire(v.strip()) if RE_COUL.fullmatch(v.strip()) else None
    fs = couleurs_de_fond(fonds)
    if not c or not fs or c[3] < 0.999 or luminance(c) < 0.5:
        return v
    k = lambda x: min(contraste(x, f) for f in fs)
    if k(c) >= SEUIL:
        return v
    for cand, val in (((255, 255, 255), '#ffffff'), ((10, 10, 10), '#0a0a0a')):
        if k(cand) >= SEUIL:
            return val
    return '#ffffff' if k((255, 255, 255)) >= k((10, 10, 10)) else '#0a0a0a'


JETONS_SOMBRES = {}


def lire_jetons(css):
    for tete, corps in blocs(css):
        if tete == ':root':
            for p, v in declarations(corps):
                if p.startswith('--') and RE_COUL.fullmatch(v.strip()) and p not in JETONS_SOMBRES:
                    JETONS_SOMBRES[p] = v.strip()


def generer_css(css):
    out = []
    for tete, corps in blocs(css):
        if tete.startswith('@'):
            nom = tete.split()[0].lower()
            # L'IMPRESSION N'A PAS DE THEME (01/10/2026) : les regles @media print
            # sont deja pensees pour le papier blanc ; leur copie « claire » les
            # retournait en page noire.
            if nom == '@media' and re.search(r'\bprint\b', tete) and not re.search(r'\bscreen\b', tete):
                continue
            if nom in ('@media', '@supports', '@container', '@layer'):
                inner = generer_css(corps)
                if inner:
                    out.append(tete + '{' + inner + '}')
            continue
        r = regle_claire(tete, corps)
        if r:
            out.append(r)
    return '\n'.join(out)


# ── Les styles en ligne ──────────────────────────────────────────────────────
RE_LIGNE = re.compile(r'(?<![\w-])(background-color|background|color|border(?:-(?:top|right|bottom|left))?(?:-color)?)\s*:\s*([^;"\'`<>{}]*?(?:#[0-9a-fA-F]{3,8}\b|rgba?\([\d\s.,%]+\)|(?<![\w-])(?:white|black)(?![\w-]))[^;"\'`<>{}]*?)\s*(?=[;"\'`]|$)')


def styles_en_ligne(textes):
    vus = {}
    for t in textes:
        for m in RE_LIGNE.finditer(t):
            p, v = m.group(1), m.group(2).strip()
            if '${' in v or '+' in v or '\\' in v or len(v) > 80:
                continue
            vus[(p, v)] = vus.get((p, v), 0) + 1
    out = []
    pas_vif = ''.join(':not([style*="%s"])' % x for x in (
        'background:var(--red', 'background:var(--green', 'background:var(--danger', 'background:var(--success',
        'background:#E02020', 'background:#e02020', 'background:linear-gradient', 'background:var(--orange',
        'background:var(--amber', 'background:#22c55e', 'background:var(--gold'))
    for (p, v), _ in sorted(vus.items()):
        role = role_de(p)
        nv = transformer(v, role)
        if nv == v:
            continue
        cles = [p + ':' + v, p + ': ' + v]
        # Le navigateur RE-ECRIT l'attribut des qu'un script touche a
        # element.style (un display, une visibility) : #080808 devient alors
        # « rgb(8, 8, 8) », apres « : ». Les deux formes sont rattrapees.
        ser = serialise(v)
        if ser != v:
            cles.append(p + ': ' + ser)
        if p == 'color':
            # « color: » est aussi la fin de « background-color: » : on exige un
            # debut de declaration.
            sels = []
            for c in cles:
                sels += ['[style^="%s"]' % c, '[style*=";%s"]' % c, '[style*="; %s"]' % c, '[style*=" %s"]' % c]
            sels = [PREFIXE + ' ' + s + pas_vif for s in sels]
        elif p == 'background':
            sels = []
            for c in cles:
                sels += ['[style^="%s"]' % c, '[style*=";%s"]' % c, '[style*="; %s"]' % c, '[style*=" %s"]' % c]
            sels = [PREFIXE + ' ' + s for s in sels]
        else:
            sels = [PREFIXE + ' [style*="%s"]' % c for c in cles]
        sels = [s.replace('\\', '\\\\') for s in sels]
        prop = 'background-color' if p == 'background' and not re.search(r'gradient|url\(', v) and len(v.split()) == 1 else p
        out.append(','.join(sels) + '{' + prop + ':' + nv + '!important}')
    # LES COULEURS DE MARQUE EN TEXTE, ECRITES EN LIGNE (01/10/2026) :
    # style="color:var(--green)" — « Ton premier mois est complet » a 1,8:1.
    # Elles passent a leur variante texte ; un fond franc sur le meme element
    # (pas_vif) les laisse telles quelles.
    jetons = set()
    for t in textes:
        for m in RE_LIGNE_VAR.finditer(t):
            if m.group(1) in VARIANTES:
                jetons.add(m.group(1))
    for j in sorted(jetons):
        cles = ['color:var(%s)' % j, 'color: var(%s)' % j]
        sels = []
        for c in cles:
            sels += ['[style^="%s"]' % c, '[style*=";%s"]' % c, '[style*="; %s"]' % c, '[style*=" %s"]' % c]
        out.append(','.join(PREFIXE + ' ' + s + pas_vif for s in sels) + '{color:var(%s-text)!important}' % j)
    return '\n'.join(out)


# « color:var(--green) » en ligne — et pas « background-color:var(--green) » :
# le nom de la propriete ne doit pas suivre un tiret ou une lettre.
RE_LIGNE_VAR = re.compile(r'(?<![\w-])color\s*:\s*var\((--[\w-]+)\)')


JETONS = """%s{color-scheme:light;--scrim:rgba(0,0,0,.45)}
%s img,%s video,%s canvas{color-scheme:normal}""" % (PREFIXE, PREFIXE, PREFIXE, PREFIXE)


def preparer(base):
    """Tout ce que la generation lit avant d'ecrire : les jetons sombres, les
    fonds clairs de reference, les variantes texte."""
    propre = sans_commentaires(base)
    lire_jetons(propre)
    preparer_fonds()
    preparer_variantes(propre)
    return propre


# ── --verifier : LE CONTRASTE DE CE QUI SERAIT GENERE ────────────────────────
def _jetons_clairs(gen):
    """Les jetons tels que le bloc genere les pose sur :root en clair."""
    out = {}
    for tete, corps in blocs(gen):
        if tete.strip() == PREFIXE:
            for p, v in declarations(corps):
                if p.startswith('--'):
                    out[p] = v.strip()
    return out


def _resoudre(v, jetons, prof=0):
    """Une valeur en couleur lisible, en suivant les var() (clair, puis sombre)."""
    v = v.strip().replace('!important', '').strip()
    m = re.fullmatch(r'var\((--[\w-]+)(?:\s*,\s*([^()]+))?\)', v)
    if m and prof < 8:
        cible = jetons.get(m.group(1)) or JETONS_SOMBRES.get(m.group(1)) or m.group(2)
        return _resoudre(cible, jetons, prof + 1) if cible else None
    return v if RE_COUL.fullmatch(v) and lire(v) else None


def verifier(gen, lignes):
    jetons = _jetons_clairs(gen)
    echecs, vus = [], 0
    # 1. Chaque jeton TEXTE (et chaque variante) contre chaque fond clair.
    for n, v in sorted(jetons.items()):
        if not (role_de(n) == 'texte' or (n.endswith('-text') and n[:-5] in VARIANTES)):
            continue
        c = _resoudre(v, jetons)
        if not c:
            continue
        vus += 1
        k = contraste_min(lire(c))
        if k < SEUIL:
            pire = min(FONDS_CLAIRS, key=lambda f: contraste(lire(c), f))
            echecs.append('jeton %s = %s : %.2f:1 sur rgb%s' % (n, c, k, pire))
    # 2. Chaque regle generee qui porte a la fois color et un fond opaque
    #    resolvables : le texte contre chacune des couleurs de ce fond.
    def regles(css):
        for tete, corps in blocs(css):
            if tete.startswith('@'):
                yield from regles(corps)
            else:
                yield tete, declarations(corps)
    paires = 0
    for tete, decl in regles(gen + '\n' + lignes):
        d = {}
        for p, v in decl:
            d[p] = v
        if 'color' not in d:
            continue
        coul = _resoudre(d['color'], jetons)
        fond = d.get('background-color') or d.get('background')
        if not coul or not fond:
            continue
        # UN FOND RESOLU, c'est une seule couleur opaque (litterale ou jeton) :
        # un degrade, une image ou un color-mix n'ont pas UNE couleur a opposer
        # au texte, et la regle n'est pas jugee ici.
        f1 = fond.replace('!important', '').strip()
        if re.search(r'gradient|url\(|color-mix', f1) or len(f1.split()) != 1:
            continue
        c = _resoudre(f1, jetons)
        c = lire(c) if c else None
        if not c or c[3] < 0.95:
            continue
        fonds = [c[:3]]
        paires += 1
        k = min(contraste(lire(coul), f) for f in fonds)
        if k < SEUIL:
            echecs.append('%s : color %s sur %s : %.2f:1' % (tete[:90], coul, fond.strip()[:60], k))
    print('verification du theme clair : %d jeton(s) texte, %d paire(s) color/fond resolues, fonds de reference %s'
          % (vus, paires, ', '.join('#%02x%02x%02x' % f for f in FONDS_CLAIRS)))
    for e in echecs:
        print('  SOUS 4,5:1  ' + e)
    print('%d texte(s) sous 4,5:1.' % len(echecs))
    return 1 if echecs else 0


def main():
    verif = '--verifier' in sys.argv
    css_f = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-style.*.css')))
    js_f = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-core.*.js')))
    if len(css_f) != 1 or len(js_f) != 1:
        sys.exit('un seul rc-style.*.css et un seul rc-core.*.js attendus')
    # ══ DEPUIS LE 01/10/2026, LE BLOC VIT DANS app/rc-theme.<build>.css ══
    # (scripts/extraire_theme_clair.py). La feuille sombre (rc-style) est lue,
    # suivie des regles claires ecrites a la main qui precedent le bloc dans
    # rc-theme — elles etaient lues avec la feuille sombre avant l'extraction
    # (d'ou six regles doublement prefixees qu'on reproduit a l'identique) — et
    # le bloc est reecrit A SA PLACE dans rc-theme.
    import extraire_theme_clair as X
    _, f_theme = X.fichiers()
    html = open(os.path.join(RACINE, 'app', 'index.html'), encoding='utf-8', newline='').read()
    js = open(js_f[0], encoding='utf-8').read()
    if os.path.exists(f_theme):
        css = open(css_f[0], encoding='utf-8').read()
        # Comme avant l'extraction : seulement ce qui precede la place du bloc.
        if X.REPERE in css:
            css = css[:css.index(X.REPERE)]
        t_avant, t_bloc, t_apres = X.morceaux_theme(open(f_theme, encoding='utf-8').read())
        base = (css.rstrip('\n') + '\n' + t_avant.strip('\n') + '\n') if t_avant.strip() else css
        gen = generer_css(preparer(base))
        lignes = styles_en_ligne([html, js])
        if verif:
            sys.exit(verifier(gen, lignes))
        bloc = '\n'.join([DEBUT, gen, lignes, JETONS, FIN])
        open(f_theme, 'w', encoding='utf-8').write(X.ENTETE + t_avant.strip('\n') + ('\n' if t_avant.strip() else '')
            + bloc + '\n' + t_apres.strip('\n') + ('\n' if t_apres.strip() else ''))
        print('theme clair : %d regles de feuille, %d styles en ligne, %d Ko (dans %s)' % (
            gen.count('{') - gen.count('@'), lignes.count('!important'), len(bloc.encode('utf-8')) // 1024, os.path.basename(f_theme)))
        # Une regle claire ecrite a la main dans rc-style depuis le dernier passage : deplacee.
        X.extraire(verbeux=False)
        return
    css = open(css_f[0], encoding='utf-8').read()
    i = css.find(DEBUT)
    base = css[:i].rstrip('\n') + '\n' if i >= 0 else css
    # ⚠ CE QUI SUIT LE BLOC GENERE EST GARDE (27/09/2026). Des styles poses
    #   APRES la fin du theme (maquettes Masse grasse et Volume) etaient
    #   effaces a chaque regeneration : le bloc allait jusqu'au bout du fichier.
    j = css.find(FIN, i) if i >= 0 else -1
    apres = css[j + len(FIN):].lstrip('\n') if j >= 0 else ''
    gen = generer_css(preparer(base))
    # La feuille en ligne de index.html (polices) n'a pas de couleur a traiter ;
    # ses styles en ligne, si.
    lignes = styles_en_ligne([html, js])
    if verif:
        sys.exit(verifier(gen, lignes))
    bloc = '\n'.join([DEBUT, gen, lignes, JETONS, FIN]) + '\n'
    open(css_f[0], 'w', encoding='utf-8').write(base + bloc + ('\n' + apres if apres else ''))
    print('theme clair : %d regles de feuille, %d styles en ligne, %d Ko' % (
        gen.count('{') - gen.count('@'), lignes.count('!important'), len(bloc.encode('utf-8')) // 1024))
    # Premier passage apres le 01/10/2026 : le bloc et les regles claires sortent dans rc-theme.
    X.extraire()


if __name__ == '__main__':
    main()
