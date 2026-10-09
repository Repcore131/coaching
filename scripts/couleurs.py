#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LES COULEURS GOUVERNEES PAR DES JETONS (01/10/2026), sur le modele de
scripts/espacements.py : une palette fermee, et un plafond qui ne fait que
baisser.

LA PALETTE est le :root d'app/rc-style.<build>.css (PALETTE, plus bas) : cinq
rouges, les gris neutres, cinq couleurs d'etat. Une couleur ecrite en dur
(#hex, rgb(), rgba()) dans une propriete de couleur est un LITTERAL.

CE QUI EST LU : app/rc-style.<build>.css, les morceaux de rc-core
(src/core/NNN-*.js, src/core/LISEZMOI.md — sinon app/rc-core.<build>.js) et
app/index.html. Hors commentaires, et HORS :
  · le :root lui-meme (c'est la definition des jetons) ;
  · toute regle dont le selecteur porte data-theme (les regles propres au
    theme clair : un jeton s'y resoudrait a sa valeur claire) ;
  · la fiche alimentaire (.fa-, #s-fiche-alim) : un document a imprimer, que
    theme_clair.py laisse tel quel dans les deux themes ;
  · ce qui vit sur une banniere rouge (theme_clair.SUR_BANNIERE), pour la meme
    raison ;
  · les documents AUTONOMES fabriques par rc-core (exports A4 en srcdoc, @page) :
    ils n'ont pas la feuille, un var(--…) n'y vaudrait rien.
Le bloc genere du theme clair (entre « THEME CLAIR — GENERE » et « FIN DU THEME
CLAIR GENERE ») n'est jamais lu ; il vit d'ailleurs dans rc-theme depuis le
lot 19.

LE JETON LE PLUS PROCHE, DANS SON ROLE. La distance est le deltaE CIE76 (Lab,
D65). Mais un gris de TEXTE ne devient jamais un jeton de SURFACE, meme a
distance nulle : #111 ecrit en color (un texte sombre sur un bouton clair) et
var(--surface-1) n'ont pas le meme sens, et le theme clair les retourne
differemment. Les jetons admis :
  texte  (color, fill, stroke, caret…) : rouges de texte, gris de texte, etats ;
  fond   (background…)                 : rouges, surfaces, etats ;
  bordure (border…, outline…)          : --border, --border-strong, rouges, etats ;
  une propriete personnalisee (--x)    : rouges et etats seulement (pas de gris :
                                         son role n'est pas connu ici).
JAMAIS : les ombres (box-shadow, text-shadow, filter : leur noir est une ombre,
pas un --bg), le blanc pur et le noir pur (un blanc sur un bouton rouge n'est
pas var(--text), qui passe au noir en theme clair).

LES GRIS TEINTES (la famille zinc #a1a1aa, #26262b… : un gris a peine bleute)
sont RABATTUS sur le gris neutre de meme clarte, puis sur un jeton s'il y en a
un a moins de SEUIL.

Usage :
  python3 scripts/couleurs.py --rapport    par famille : occurrences, jeton le plus proche
  python3 scripts/couleurs.py --appliquer  remplace (deltaE < 6) ; alpha -> color-mix(…)
  python3 scripts/couleurs.py --verifier   sort en 1 si les litteraux depassent
                                           scripts/couleurs-plafond.txt
  python3 scripts/couleurs.py --baisser-plafond   ecrit le compte actuel s'il est plus bas
Relancer scripts/theme_clair.py apres --appliquer.
"""
import glob, math, os, re, subprocess, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RACINE, 'scripts'))
import theme_clair as T  # lire(), RE_COUL, SUR_BANNIERE, RE_FICHE

PLAFOND_F = os.path.join(RACINE, 'scripts', 'couleurs-plafond.txt')
SEUIL = 6.0
# LA MARGE (01/10/2026). A 5,9 de distance, #1a0000 -> --red-bg donnait 7,8 a
# l'ecran sur les coins arrondis, ou la couleur se melange a sa bordure : la
# tolerance des captures (deltaE < 6) n'etait pas tenue. On remplace donc sous
# SEUIL_APPLIQUE, et une couleur translucide se juge a son RENDU : posee sur les
# fonds sombres de l'app (FONDS_SOMBRES), pas a sa teinte seule — un blanc a 5 %
# dont la teinte bouge de 5,6 ne bouge pas a l'ecran.
SEUIL_APPLIQUE = 5.0
FONDS_SOMBRES = [(8, 8, 8), (17, 17, 17), (24, 24, 24)]

# LA PALETTE FERMEE (noms) ; les valeurs sont lues dans le :root de rc-style.
ROUGES = ['--red', '--red-deep', '--red-bg', '--red-bg-2', '--red-text']
NEUTRES_FOND = ['--bg', '--surface-0', '--surface-1', '--surface-2', '--surface-3']
NEUTRES_BORD = ['--border', '--border-strong']
NEUTRES_TEXTE = ['--text', '--text-strong', '--text-mid', '--sub', '--text-faint']
ETATS = ['--green', '--orange', '--amber', '--info', '--link']
PALETTE = ROUGES + NEUTRES_FOND + NEUTRES_BORD + NEUTRES_TEXTE + ETATS

ADMIS = {
    'texte': ['--red', '--red-text'] + NEUTRES_TEXTE + ETATS,
    'fond': ['--red', '--red-deep', '--red-bg', '--red-bg-2'] + NEUTRES_FOND + ETATS,
    'bordure': ['--red', '--red-deep', '--red-bg-2'] + NEUTRES_BORD + ETATS,
    'perso': ROUGES + ETATS,
    # Une lueur rouge (box-shadow: 0 0 18px rgba(224,32,32,.35)) reste rouge
    # dans les deux themes : les jetons de couleur franche y sont admis. Jamais
    # un gris : le noir d'une ombre n'est pas --bg (il passerait au blanc en clair).
    'ombre': ['--red', '--red-deep', '--green', '--orange', '--amber', '--info'],
}

PROPS = r'(?:color|background(?:-color|-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-start|-end)?)?(?:-color)?|outline(?:-color)?|column-rule(?:-color)?|text-decoration(?:-color)?|caret-color|accent-color|fill|stroke|stop-color|-webkit-text-fill-color|box-shadow|text-shadow|filter|--[\w-]+)'
RE_DECL = re.compile(r'(?<![\w-])(' + PROPS + r')(\s*:\s*)([^;"\'`<>{}]*)')
# Les couleurs : #hex et rgb()/rgba() a valeurs litterales (pas white/black,
# qui ne sont jamais remplaces et restent hors compte).
RE_LIT = re.compile(r'#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?(?:\s*[,/]\s*[\d.]+%?)?\s*\)')


def role(prop):
    p = prop.lower()
    if p in ('box-shadow', 'text-shadow', 'filter'):
        return 'ombre'
    if p.startswith('--'):
        return 'perso'
    if p.startswith('border') or p.startswith('outline') or p.startswith('column-rule'):
        return 'bordure'
    if p.startswith('background'):
        return 'fond'
    return 'texte'


# ── LA COULEUR, EN Lab ───────────────────────────────────────────────────────
def lab(rgb):
    def lin(c):
        c /= 255
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(x) for x in rgb[:3])
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 1.0
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def delta_e(a, b):
    return math.dist(lab(a), lab(b))


def delta_rendu(rgb, a, cible):
    """L'ecart A L'ECRAN : la couleur et sa cible, a la meme opacite, posees
    sur chacun des fonds sombres ; le pire des cas."""
    if a >= 0.999:
        return delta_e(rgb, cible)
    pose = lambda c, f: tuple(c[i] * a + f[i] * (1 - a) for i in range(3))
    return max(delta_e(pose(rgb, f), pose(cible, f)) for f in FONDS_SOMBRES)


def famille(rgb):
    L, A, B = lab(rgb)
    c = math.hypot(A, B)
    h = math.degrees(math.atan2(B, A)) % 360
    if c < 2.5:
        return 'gris neutres'
    # UN GRIS TEINTE est un gris VISIBLE a peine colore (la famille zinc :
    # #a1a1aa, #26262b). Un fond tres sombre a peine rouge (#1a0000) n'en est
    # pas un : c'est un fond rouge, et sa teinte compte.
    if c < 12 and L >= 12:
        return 'gris teintes'
    if h < 45 or h >= 345:
        return 'rouges'
    if h < 75:
        return 'oranges'
    if h < 105:
        return 'jaunes'
    if h < 200:
        return 'verts'
    if h < 290:
        return 'bleus'
    if h < 330:
        return 'violets'
    return 'roses'


def extreme(rgb):
    """Le blanc pur et le noir pur : jamais remplaces (voir l'en-tete)."""
    return all(x >= 254 for x in rgb[:3]) or all(x <= 1 for x in rgb[:3])


def neutre_de(rgb):
    """Le gris NEUTRE de meme clarte (L de Lab) qu'un gris teinte."""
    L = lab(rgb)[0]
    lo, hi = 0, 255
    while lo < hi:
        m = (lo + hi) // 2
        if lab((m, m, m))[0] < L:
            lo = m + 1
        else:
            hi = m
    return (lo, lo, lo)


# ── LES FICHIERS ────────────────────────────────────────────────────────────
def fichiers():
    css = glob.glob(os.path.join(RACINE, 'app', 'rc-style.*.css'))
    if len(css) != 1:
        sys.exit('un seul app/rc-style.*.css attendu')
    morceaux = sorted(glob.glob(os.path.join(RACINE, 'src', 'core', '[0-9][0-9][0-9]-*.js')))
    js = morceaux or glob.glob(os.path.join(RACINE, 'app', 'rc-core.*.js'))
    return css[0], js, os.path.join(RACINE, 'app', 'index.html'), bool(morceaux)


def masque_commentaires(s, js):
    """Le texte, commentaires remplaces par des espaces (memes positions)."""
    out = list(s)
    # « image/* » (un type MIME dans une chaine) n'ouvre pas de commentaire :
    # un /* colle a un mot ne compte pas, sinon tout jusqu'au */ suivant serait
    # masque (des centaines de lignes de src/core/054).
    for m in re.finditer(r'(?<![\w"\'])/\*[\s\S]*?\*/' if js else r'/\*[\s\S]*?\*/', s):
        for i in range(m.start(), m.end()):
            if out[i] != '\n':
                out[i] = ' '
    if js:
        # Une ligne qui n'est QU'un commentaire // ; un // en fin de ligne de
        # code peut etre dans une chaine (https://…) : on ne s'y risque pas.
        for m in re.finditer(r'(?m)^[ \t]*//[^\n]*', s):
            for i in range(m.start(), m.end()):
                out[i] = ' '
    else:
        for m in re.finditer(r'<!--[\s\S]*?-->', s):
            for i in range(m.start(), m.end()):
                if out[i] != '\n':
                    out[i] = ' '
    return ''.join(out)


def jetons(css):
    """Les valeurs litterales de la palette, lues dans :root."""
    m = re.search(r'(?m)^:root\{([\s\S]*?)\n\}', css)
    corps = masque_commentaires(m.group(1), False) if m else ''
    out = {}
    for n, v in re.findall(r'(--[\w-]+)\s*:\s*([^;]+)', corps):
        if n in PALETTE and n not in out:
            c = T.lire(v.strip())
            if c and c[3] >= 0.999:
                out[n] = tuple(round(x) for x in c[:3])
    manque = [n for n in PALETTE if n not in out]
    return out, manque


# ── LES ZONES A NE PAS TOUCHER ───────────────────────────────────────────────
def zones_css(css, masque):
    """[(debut, fin)] des corps de regle exclus : :root, data-theme, fiche,
    banniere."""
    exclues = []
    pile = []
    debut_sel = 0
    for i, ch in enumerate(masque):
        if ch == '{':
            sel = masque[debut_sel:i].strip()
            pile.append((i, sel))
            debut_sel = i + 1
        elif ch == '}':
            if pile:
                j, sel = pile.pop()
                # @media print : les couleurs du PAPIER (gris fonce sur blanc),
                # que les jetons du theme sombre ne sauraient pas donner. Meme
                # exception que les documents d'impression du JS (DOC_AUTONOME).
                if (sel == ':root' or 'data-theme' in sel or T.RE_FICHE.search(sel)
                        or T.SUR_BANNIERE.search(sel) or sel.lstrip().startswith('@media print')):
                    exclues.append((j, i))
            debut_sel = i + 1
        elif ch == ';' and not pile:
            debut_sel = i + 1
    return exclues


DOC_AUTONOME = re.compile(r'srcdoc|@page|print-color-adjust|<!doctype', re.I)


def zones_js(s):
    """[(debut, fin)] des declarations de premier niveau qui fabriquent un
    document autonome (export A4 en srcdoc, impression) : on n'y touche pas."""
    exclues = []
    pos = [m.start() for m in re.finditer(r'(?m)^(?:async\s+)?function\b|^(?:const|let|var)\s', s)] + [len(s)]
    for a, b in zip(pos, pos[1:]):
        if DOC_AUTONOME.search(s[a:b]):
            exclues.append((a, b))
    return exclues


def dedans(i, zones):
    return any(a <= i < b for a, b in zones)


# ── L'INVENTAIRE ET LE REMPLACEMENT ─────────────────────────────────────────
def remplacement(lit, r, pal):
    """(nouvelle valeur ou None, famille, jeton le plus proche, deltaE)."""
    c = T.lire(lit)
    if not c:
        return None, None, None, None
    rgb, a = tuple(round(x) for x in c[:3]), c[3]
    fam = famille(rgb)
    cible = rgb
    if fam == 'gris teintes':
        cible = neutre_de(rgb)
    admis = [n for n in ADMIS.get(r, []) if n in pal]
    if not admis:
        proche, d = None, None
    else:
        proche = min(admis, key=lambda n: delta_e(cible, pal[n]))
        d = delta_e(cible, pal[proche])
    # Le blanc pur et le noir pur ne sont jamais remplaces, SAUF un blanc
    # translucide de fond ou de bordure (un reflet : rgba(255,255,255,.05)), qui
    # se retourne en clair exactement comme le faisait le litteral.
    reflet = all(x >= 254 for x in rgb[:3]) and a < 0.999 and r in ('fond', 'bordure')
    if (extreme(rgb) and not reflet) or (r == 'ombre' and fam == 'gris neutres'):
        return None, fam, proche, d
    if reflet:
        if delta_rendu(rgb, a, pal['--text']) >= SEUIL_APPLIQUE:
            return None, fam, '--text', delta_e(rgb, pal['--text'])
        return 'color-mix(in srgb,var(--text) %s%%,transparent)' % ('%g' % round(a * 100, 1)), fam, '--text', delta_e(rgb, pal['--text'])
    if proche is not None and delta_rendu(cible, a, pal[proche]) < SEUIL_APPLIQUE and d < SEUIL:
        if a >= 0.999:
            return 'var(%s)' % proche, fam, proche, d
        return 'color-mix(in srgb,var(%s) %s%%,transparent)' % (proche, ('%g' % round(a * 100, 1))), fam, proche, d
    if fam == 'gris teintes':
        # Pas de jeton assez proche : le gris neutre de meme clarte.
        n = cible[0]
        if a >= 0.999:
            return '#%02x%02x%02x' % (n, n, n), fam, proche, d
        return 'rgba(%d,%d,%d,%s)' % (n, n, n, '%g' % round(a, 3)), fam, proche, d
    return None, fam, proche, d


def traiter(s, est_js, est_css, pal, appliquer, inventaire):
    masque = masque_commentaires(s, est_js)
    zones = zones_css(s, masque) if est_css else []
    if est_js:
        zones = zones_js(s)
    elif not est_css:
        # index.html : ses <style> sont du CSS ; on y exclut les memes regles.
        for m in re.finditer(r'<style\b[^>]*>([\s\S]*?)</style>', masque):
            base = m.start(1)
            zones += [(base + a, base + b) for a, b in zones_css(m.group(1), m.group(1))]
        for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>', masque):
            base = m.start(1)
            zones += [(base + a, base + b) for a, b in zones_js(m.group(1))]
    edits = []
    for d in RE_DECL.finditer(masque):
        if dedans(d.start(), zones):
            continue
        prop, val0 = d.group(1), d.start(3)
        r = role(prop)
        for m in RE_LIT.finditer(d.group(3)):
            lit = s[val0 + m.start():val0 + m.end()]
            nv, fam, proche, de = remplacement(lit, r, pal)
            if fam is None:
                continue
            inventaire.append((fam, lit.lower(), proche, de, nv is not None))
            if appliquer and nv:
                edits.append((val0 + m.start(), val0 + m.end(), nv))
    for a, b, nv in sorted(edits, reverse=True):
        s = s[:a] + nv + s[b:]
    return s, len(edits)


def compter(appliquer=False):
    css_f, js_f, html_f, morceaux = fichiers()
    css = open(css_f, encoding='utf-8', newline='').read()
    pal, manque = jetons(css)
    if manque:
        sys.exit('palette incomplete dans :root : ' + ', '.join(manque))
    inventaire, modifies = [], 0
    core_change = False
    for f in [css_f] + js_f + [html_f]:
        s = open(f, encoding='utf-8', newline='').read()
        n, k = traiter(s, f.endswith('.js'), f.endswith('.css'), pal, appliquer, inventaire)
        if appliquer and k:
            open(f, 'w', encoding='utf-8', newline='').write(n)
            modifies += k
            core_change = core_change or (morceaux and f in js_f)
    if core_change:
        subprocess.run(['node', os.path.join(RACINE, 'scripts', 'assembler_core.mjs')], check=True)
    return inventaire, pal, modifies


def rapport(inventaire, pal):
    fams = {}
    for fam, lit, proche, d, rempl in inventaire:
        f = fams.setdefault(fam, {})
        e = f.setdefault(lit, [0, proche, d, rempl])
        e[0] += 1
    ordre = ['rouges', 'gris neutres', 'gris teintes', 'verts', 'oranges', 'jaunes', 'bleus', 'violets', 'roses']
    for fam in ordre + sorted(set(fams) - set(ordre)):
        if fam not in fams:
            continue
        lits = fams[fam]
        tot = sum(v[0] for v in lits.values())
        print('\n%s : %d occurrence(s), %d couleur(s) distincte(s)' % (fam.upper(), tot, len(lits)))
        for lit, (n, proche, d, rempl) in sorted(lits.items(), key=lambda x: -x[1][0])[:25]:
            print('  %-28s %4d  %-16s %s%s' % (lit, n, proche or '-', ('dE %.1f' % d) if d is not None else '', '  -> remplacable' if rempl else ''))
        if len(lits) > 25:
            print('  … et %d autre(s)' % (len(lits) - 25))
    rempl = sum(1 for x in inventaire if x[4])
    print('\nTOTAL : %d litteraux, dont %d remplacables (deltaE < %g, ou gris teinte rabattu).' % (len(inventaire), rempl, SEUIL))


def main():
    a = sys.argv[1:]
    if '--appliquer' in a:
        inv, pal, k = compter(appliquer=True)
        print('%d litteral(aux) remplace(s). Relancer : python3 scripts/theme_clair.py' % k)
        inv, pal, _ = compter()
        print('restent : %d litteraux.' % len(inv))
        return
    inv, pal, _ = compter()
    n = len(inv)
    if '--verifier' in a or '--baisser-plafond' in a:
        try:
            plafond = int(open(PLAFOND_F).read().split()[0])
        except Exception:
            plafond = None
        if '--baisser-plafond' in a:
            if plafond is None or n < plafond:
                open(PLAFOND_F, 'w').write('%d\n' % n)
                print('plafond : %s -> %d' % (plafond, n))
            else:
                print('plafond inchange : %d (actuel %d)' % (plafond, n))
            return
        if plafond is None:
            sys.exit('scripts/couleurs-plafond.txt illisible')
        print('couleurs : %d litteraux (plafond %d)' % (n, plafond))
        if n > plafond:
            sys.exit('%d litteraux de couleur, au-dessus du plafond (%d) : utiliser les jetons de :root '
                     '(python3 scripts/couleurs.py --rapport).' % (n, plafond))
        return
    rapport(inv, pal)


if __name__ == '__main__':
    main()
