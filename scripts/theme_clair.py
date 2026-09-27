#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LE THEME CLAIR, GENERE depuis la feuille sombre.

POURQUOI UN GENERATEUR. RepCore a ete dessine en sombre, et pas seulement par
ses jetons : environ 1 700 couleurs sont ecrites en dur dans la feuille, 1 100
dans les styles en ligne du code, 300 dans app/index.html. Les repeindre a la
main, c'est des semaines ; en oublier une, c'est un texte blanc sur fond blanc.
Ce script relit TOUTES les regles qui portent une couleur et en ecrit une
copie « claire », prefixee par :root[data-theme="clair"], a la fin de
app/rc-style.<build>.css, entre deux marqueurs. Il est IDEMPOTENT : il retire
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

CE QUI NE CHANGE PAS : les images, les <canvas> (les visuels partages restent
aux couleurs de la marque), les @keyframes.

Usage : python3 scripts/theme_clair.py      (apres versionner_actifs.py)
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
        return c
    r2, g2, b2 = colorsys.hls_to_rgb(h, l2, s)
    return ecrire(r2 * 255, g2 * 255, b2 * 255, a, forme)


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


FOND_VIF = re.compile(r'var\(--(red|green|danger|success|orange|amber|warning|gold|info|accent|pub-|cycle|arc-)|#(e02020|b81515|ff3345|22c55e|f97316|f59e0b|f5c518|ff3b30)', re.I)


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
    lignes = []
    for p, v in coul:
        role = role_de(p)
        if role == 'texte' and fond_vif:
            # Du blanc sur un bouton rouge reste blanc — y compris quand il est
            # ecrit var(--text), jeton qui, lui, passe au noir en clair.
            v = re.sub(r'var\((--[\w-]+)\)', lambda m: JETONS_SOMBRES.get(m.group(1), m.group(0)) if 'text' in m.group(1) else m.group(0), v)
            role = 'garder'
        lignes.append(p + ':' + transformer(v, role))
    return prefixer(sel) + '{' + ';'.join(lignes) + '}'


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
    return '\n'.join(out)


JETONS = """%s{color-scheme:light;--scrim:rgba(0,0,0,.45)}
%s img,%s video,%s canvas{color-scheme:normal}""" % (PREFIXE, PREFIXE, PREFIXE, PREFIXE)


def main():
    css_f = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-style.*.css')))
    js_f = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-core.*.js')))
    if len(css_f) != 1 or len(js_f) != 1:
        sys.exit('un seul rc-style.*.css et un seul rc-core.*.js attendus')
    css = open(css_f[0], encoding='utf-8').read()
    i = css.find(DEBUT)
    base = css[:i].rstrip('\n') + '\n' if i >= 0 else css
    lire_jetons(sans_commentaires(base))
    gen = generer_css(sans_commentaires(base))
    html = open(os.path.join(RACINE, 'app', 'index.html'), encoding='utf-8', newline='').read()
    # La feuille en ligne de index.html (polices) n'a pas de couleur a traiter ;
    # ses styles en ligne, si.
    lignes = styles_en_ligne([html, open(js_f[0], encoding='utf-8').read()])
    bloc = '\n'.join([DEBUT, gen, lignes, JETONS, FIN]) + '\n'
    open(css_f[0], 'w', encoding='utf-8').write(base + bloc)
    print('theme clair : %d regles de feuille, %d styles en ligne, %d Ko' % (
        gen.count('{') - gen.count('@'), lignes.count('!important'), len(bloc.encode('utf-8')) // 1024))


if __name__ == '__main__':
    main()
