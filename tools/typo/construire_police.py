# -*- coding: utf-8 -*-
"""Vectorise les glyphes FontApp et assemble deux vraies polices woff2.

Pourquoi une police et pas un rendu canvas : RepCore est un fichier unique
sans build, ses titres doivent rester selectionnables, lisibles par un lecteur
d'ecran et trouvables par la recherche du navigateur — et un banc du projet
relit les libelles dans le DOM. Une police repond a tout cela avec une seule
declaration CSS, et pese moins que les PNG qu'elle remplace.

Calage : capHeight 700/1000, ascender 900, descender -300 — exactement les
metriques de Bebas Neue, la police remplacee. Les 39 tailles de titre en place
dans l'application gardent donc leur rendu optique, sans retoucher un px.

L'interlettrage et la chasse d'espace reprennent les valeurs par defaut du
generateur FontApp (10 et 70 pour une capitale de 120), converties a l'echelle
de l'em.
"""
import os, re, sys, json
import numpy as np
from PIL import Image
import potrace
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.ttLib import TTFont

GLYPHES = sys.argv[1]
SORTIE = sys.argv[2]
MANIFEST = 'C:/Users/kevin/Downloads/FontApp/glyphs/manifest.js'

UPM, CAP, ASC, DESC = 1000, 700, 900, -300
LS = round(10 / 120 * CAP)        # interlettrage FontApp, a l'echelle de l'em
# La chasse d'espace par defaut du generateur (70 pour une capitale de 120,
# soit 0,58 cap) est reglee pour composer une affiche, pas une interface : a
# 42 px elle ouvrait 17 px entre deux mots. On la ramene a la largeur du I,
# la plus etroite des capitales — la regle typographique usuelle pour un
# caracteres-batons, et elle reste derivee du dessin lui-meme.
ESPACE = 268

STYLES = [('filled', 'Plein', 'RepCoreDisplay-Plein', 'RepCore Display Plein'),
          ('outline', 'Contour', 'RepCoreDisplay-Contour', 'RepCore Display Contour')]

def nom_vers_char(n):
    return chr(int(n[1:], 16)) if re.fullmatch(r'u[0-9a-f]{4}', n) else n

def metriques_manifest():
    src = open(MANIFEST, encoding='utf-8').read()
    i = src.index('window.GLYPH_STYLES')
    data = json.loads(src[src.index('[', i):src.rindex(']') + 1])
    return {s['id']: s['glyphs'] for s in data}

MAN = metriques_manifest()
SUP = json.load(open(os.path.join(GLYPHES, 'metriques.json'), encoding='utf-8'))

def tracer(chemin_png, hauteur_u, dy_u):
    """PNG -> contours, dans le repere de la police (y vers le haut).

    L'alpha EST la forme : les glyphes sont blancs, la couleur etant posee au
    rendu. On trace donc le canal alpha, jamais la luminance.
    """
    im = Image.open(chemin_png).convert('RGBA')
    a = np.array(im.split()[3]) > 128
    if not a.any():
        return [], 0
    h_px, w_px = a.shape
    ech = hauteur_u / h_px
    # Marge d'un pixel AVANT le trace. Le point, le tiret bas et la barre
    # verticale sont des rectangles pleins bord a bord : sans fond a
    # contourner, potrace ne rend aucune courbe et le glyphe sortait vide.
    a = np.pad(a, 1, constant_values=False)
    # Bitmap.__init__ appelle invert() sans condition : passer le masque tel
    # quel faisait tracer le FOND, et chaque glyphe sortait en negatif — plein
    # la ou il devait etre creux. On lui donne donc l'inverse.
    # turdsize : les mouchetures de moins de 2 px sont du bruit de decoupe.
    chemin = potrace.Bitmap(~a).trace(turdsize=2, alphamax=1.0, opttolerance=0.2)
    # potracer rend des objets Point (.x/.y), pas des couples ; on retire la
    # marge en repassant dans le repere du PNG d'origine.
    conv = lambda p: ((p.x - 1) * ech, (h_px - (p.y - 1)) * ech - dy_u)
    contours = []
    for courbe in chemin:
        pts = [('m', conv(courbe.start_point))]
        for seg in courbe:
            if seg.is_corner:
                pts.append(('l', conv(seg.c)))
                pts.append(('l', conv(seg.end_point)))
            else:
                pts.append(('c', conv(seg.c1), conv(seg.c2), conv(seg.end_point)))
        contours.append(pts)
    return orienter(contours), w_px * ech

def ancres(pts):
    """Points d'ancrage d'un contour — suffisants pour l'aire et l'inclusion."""
    return [s[-1] for s in pts]

def aire(pts):
    p = ancres(pts); s = 0.0
    for i in range(len(p)):
        x1, y1 = p[i]; x2, y2 = p[(i + 1) % len(p)]
        s += x1 * y2 - x2 * y1
    return s / 2

def dedans(pt, pts):
    """Point dans un contour, par lancer de rayon."""
    x, y = pt; p = ancres(pts); d = False
    for i in range(len(p)):
        x1, y1 = p[i]; x2, y2 = p[(i - 1) % len(p)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            d = not d
    return d

def inverser(pts):
    """Retourne le sens de parcours d'un contour, controles compris."""
    anc = ancres(pts)
    out = [('m', anc[-1])]
    for i in range(len(pts) - 1, 0, -1):
        s = pts[i]; cible = anc[i - 1]
        out.append(('l', cible) if s[0] == 'l' else ('c', s[2], s[1], cible))
    return out

def orienter(contours):
    """Impose le sens de parcours d'apres la PROFONDEUR D'IMBRICATION.

    potrace alterne les sens en descendant l'arbre, mais l'inversion du
    masque et le retournement de l'axe Y brouillent cette alternance des que
    la forme depasse deux niveaux. C'etait le cas de tout le style Contour :
    un O evide compte QUATRE bordures — deux anneaux emboites — et le second
    anneau sortait avec ses deux bordures dans le meme sens. La regle
    non-zero le remplissait alors au lieu de l'evider, et chaque lettre
    creuse s'affichait pleine.

    On ne se fie donc a rien : on compte, pour chaque contour, combien
    d'autres le contiennent. Profondeur paire = bord exterieur, impaire =
    trou. Convention alignee sur celle du style Plein, qui lui passait.
    """
    n = len(contours)
    for i in range(n):
        pt = ancres(contours[i])[0]
        prof = sum(1 for j in range(n) if j != i and dedans(pt, contours[j]))
        voulu = -1 if prof % 2 == 0 else 1
        a = aire(contours[i])
        if a != 0 and (a > 0) != (voulu > 0):
            contours[i] = inverser(contours[i])
    return contours

def dessiner(pen, contours):
    for c in contours:
        for i, s in enumerate(c):
            if s[0] == 'm':
                pen.moveTo(s[1])
            elif s[0] == 'l':
                pen.lineTo(s[1])
            else:
                pen.curveTo(s[1], s[2], s[3])
        pen.closePath()

# Les minuscules pointent sur les capitales : la typo n'a QUE des capitales,
# et un titre non passe en majuscules par le CSS s'afficherait sinon vide.
MINUSCULES = {chr(c): chr(c - 32) for c in range(ord('a'), ord('z') + 1)}
MINUSCULES.update({chr(c): chr(c - 32) for c in
                   [0xE0, 0xE2, 0xE3, 0xE4, 0xE7, 0xE8, 0xE9, 0xEA, 0xEB,
                    0xEE, 0xEF, 0xF4, 0xF6, 0xF9, 0xFB, 0xFC]})
MINUSCULES['ÿ'] = 'Ÿ'
# L'apostrophe droite et le guillemet droit du clavier prennent la forme
# typographique deja dessinee : sans cela, sept titres perdraient leur signe.
ALIAS = {"'": '\u2019', '"': '\u201d', '\u00a0': ' ', '\u202f': ' '}

os.makedirs(SORTIE, exist_ok=True)
for dossier, label, ps, plein in STYLES:
    src = os.path.join(GLYPHES, dossier)
    fichiers = sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png'))
    metriques = dict(MAN[dossier]); metriques.update(SUP[dossier])
    # Les signes evides depuis le Plein heritent de ses metriques verticales.
    for n in fichiers:
        c = nom_vers_char(n)
        if c not in metriques and c in MAN['filled']:
            metriques[c] = MAN['filled'][c]

    charstrings, hmtx, cmap = {}, {}, {}
    ordre = ['.notdef', 'space']
    pen = T2CharStringPen(ESPACE, None); charstrings['.notdef'] = pen.getCharString()
    pen = T2CharStringPen(ESPACE, None); charstrings['space'] = pen.getCharString()
    hmtx['.notdef'] = (ESPACE, 0); hmtx['space'] = (ESPACE, 0)
    cmap[0x20] = 'space'

    ignores = []
    for n in fichiers:
        c = nom_vers_char(n)
        m = metriques.get(c)
        if m is None:
            ignores.append(n); continue
        hu, dyu = m[0] * CAP, m[1] * CAP
        contours, largeur = tracer(os.path.join(src, n + '.png'), hu, dyu)
        if not contours:
            ignores.append(n); continue
        gname = 'g' + ('%04x' % ord(c))
        avance = int(round(largeur + LS))
        p = T2CharStringPen(avance, None)
        # Demi-interlettrage de chaque cote : le titre reste optiquement
        # centre, ce qu'une approche posee d'un seul cote casserait.
        decale = [[(s[0],) + tuple((x + LS / 2, y) for (x, y) in s[1:]) for s in ct]
                  for ct in contours]
        dessiner(p, decale)
        charstrings[gname] = p.getCharString()
        hmtx[gname] = (avance, int(round(LS / 2)))
        cmap[ord(c)] = gname
        ordre.append(gname)

    for bas, haut in MINUSCULES.items():
        if ord(haut) in cmap: cmap[ord(bas)] = cmap[ord(haut)]
    for a, b in ALIAS.items():
        if b == ' ': cmap[ord(a)] = 'space'
        elif ord(b) in cmap: cmap[ord(a)] = cmap[ord(b)]

    fb = FontBuilder(UPM, isTTF=False)
    fb.setupGlyphOrder(ordre)
    fb.setupCharacterMap(cmap)
    fb.setupCFF(ps, {'FullName': plein, 'FamilyName': plein, 'Weight': 'Regular'},
                charstrings, {})
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=ASC, descent=DESC, lineGap=0)
    fb.setupNameTable({'familyName': plein, 'styleName': 'Regular',
                       'fullName': plein, 'psName': ps,
                       'version': 'Version 1.000', 'copyright':
                       'Alphabet dessine par Kevin Guellec. Genere depuis Repcore131/FontApp.'})
    fb.setupOS2(sTypoAscender=ASC, sTypoDescender=DESC, sTypoLineGap=0,
                usWinAscent=ASC, usWinDescent=-DESC, sCapHeight=CAP,
                sxHeight=CAP, fsType=0, achVendID='RPCR')
    fb.setupPost(isFixedPitch=0)
    otf = os.path.join(SORTIE, ps + '.otf')
    fb.save(otf)
    f = TTFont(otf); f.flavor = 'woff2'
    w = os.path.join(SORTIE, ps.lower().replace('repcoredisplay-', 'repcore-') + '.woff2')
    f.save(w)
    print('  %-8s %3d glyphes, %4d points de code  ->  %s (%d octets)'
          % (label, len(ordre) - 2, len(cmap), os.path.basename(w), os.path.getsize(w)))
    if ignores:
        print('           ignores : ' + ' '.join(ignores))
