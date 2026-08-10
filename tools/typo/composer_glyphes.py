# -*- coding: utf-8 -*-
"""Complete le jeu FontApp avant vectorisation. On ne dessine RIEN.

Deux manques empechaient d'habiller RepCore :
  1. Aucune capitale accentuee, alors que le source en compte 22 600
     occurrences et qu'un banc du projet interdit tout libelle desaccentue.
  2. Le jeu Contour a 28 signes de moins que le Plein, dont le tiret
     cadratin qui sert de valeur « vide » dans toute l'application.

Les accentuees sont COMPOSEES depuis les marques deja tracees a la main sur
les planches : aigu, grave, circonflexe, trema, tilde. La cedille n'existe
pas — on emploie la VIRGULE, forme dont la cedille derive historiquement, et
qui est du meme trait que le reste. Ce qui manque au Contour est EVIDE depuis
le Plein a l'epaisseur mesuree du trait Contour (6 px).

Ecrit aussi metriques.json : hauteur et decalage vertical de chaque glyphe
compose, dans la meme convention que glyphs/manifest.js — [hauteur relative a
la capitale, decalage sous la ligne de base].
"""
import os, sys, json, numpy as np
from PIL import Image, ImageFilter

SRC = 'C:/Users/kevin/Downloads/FontApp/glyphs'
OUT = sys.argv[1]
TRAIT = 6            # epaisseur du trait Contour, mesuree sur E H I L T F Z
CAP = 257.0          # hauteur de capitale de reference, en pixels
ECART = 9            # air entre le haut de la capitale et le bas de l'accent
HAUT_ACCENT = 0.15   # hauteur de l'accent, en fraction de la capitale
LARG_MAX = 0.45      # ... plafonnee a cette fraction de la largeur de la lettre
LARG_CEDILLE = 0.26
CHEVAUCHE = 13       # la cedille mord sur la lettre : elle y est attachee

def charge(style, nom):
    p = os.path.join(SRC, style, nom + '.png')
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def depuis_alpha(a):
    """Un glyphe est blanc + alpha : la couleur est posee au rendu."""
    im = Image.new('RGBA', (a.shape[1], a.shape[0]), (255, 255, 255, 0))
    im.putalpha(Image.fromarray(a))
    px = np.array(im); px[..., :3] = 255
    return Image.fromarray(px, 'RGBA')

def evider(im, trait=TRAIT):
    """Rend une forme pleine creuse en gardant un liseré d'epaisseur `trait`.

    Erosion puis soustraction : ce que l'erosion retire EST le contour. Plus
    fidele qu'un trace d'axe median, et la silhouette exterieure du dessin
    d'origine est preservee au pixel pres.
    """
    a = np.array(im.split()[3])
    m = Image.fromarray((a > 128).astype(np.uint8) * 255)
    e = m.filter(ImageFilter.MinFilter(trait * 2 + 1))
    ring = np.array(m).astype(np.int16) - np.array(e).astype(np.int16)
    return depuis_alpha(np.clip(ring, 0, 255).astype(np.uint8))

def redim(im, largeur):
    r = largeur / im.size[0]
    return im.resize((max(1, largeur), max(1, int(round(im.size[1] * r)))), Image.LANCZOS)

def au_dessus(base, marque):
    """Accent pose au-dessus, centre sur l'encre de la lettre.

    Hauteur CONSTANTE d'un accent a l'autre — c'est ce qui les fait lire comme
    une meme famille de signes. Mais le trema (40x15) et le tilde (60x26) sont
    larges et plats : a hauteur egale ils deborderaient la lettre. D'ou le
    plafond de largeur, qui les remet a leur place sans toucher aux autres.
    """
    bw, bh = base.size
    larg = int(round(marque.size[0] * (CAP * HAUT_ACCENT) / marque.size[1]))
    acc = redim(marque, min(larg, int(round(bw * LARG_MAX))))
    H = bh + ECART + acc.size[1]
    t = Image.new('RGBA', (bw, H), (255, 255, 255, 0))
    t.alpha_composite(acc, ((bw - acc.size[0]) // 2, 0))
    t.alpha_composite(base, (0, H - bh))
    return t, H / CAP, 0.0

def en_dessous(base, marque):
    """Cedille : attachee SOUS la lettre, elle descend sous la ligne de base."""
    bw, bh = base.size
    ced = redim(marque, int(round(bw * LARG_CEDILLE)))
    profondeur = ced.size[1] - CHEVAUCHE
    H = bh + profondeur
    t = Image.new('RGBA', (bw, H), (255, 255, 255, 0))
    t.alpha_composite(base, (0, 0))
    t.alpha_composite(ced, ((bw - ced.size[0]) // 2, bh - CHEVAUCHE))
    return t, H / CAP, profondeur / CAP

#  lettre, marque, codepoint, position
COMPOSITIONS = [
    ('E', 'u00b4', 0x00C9, au_dessus), ('E', 'u0060', 0x00C8, au_dessus),
    ('E', 'u005e', 0x00CA, au_dessus), ('E', 'u00a8', 0x00CB, au_dessus),
    ('A', 'u0060', 0x00C0, au_dessus), ('A', 'u005e', 0x00C2, au_dessus),
    ('A', 'u00a8', 0x00C4, au_dessus), ('A', 'u007e', 0x00C3, au_dessus),
    ('O', 'u005e', 0x00D4, au_dessus), ('O', 'u00a8', 0x00D6, au_dessus),
    ('I', 'u005e', 0x00CE, au_dessus), ('I', 'u00a8', 0x00CF, au_dessus),
    ('U', 'u0060', 0x00D9, au_dessus), ('U', 'u005e', 0x00DB, au_dessus),
    ('U', 'u00a8', 0x00DC, au_dessus), ('Y', 'u00a8', 0x0178, au_dessus),
    ('C', 'u002c', 0x00C7, en_dessous),
]

metriques = {'filled': {}, 'outline': {}}
for style in ('filled', 'outline'):
    d = os.path.join(OUT, style); os.makedirs(d, exist_ok=True)
    n = 0
    for f in os.listdir(os.path.join(SRC, style)):
        if f.endswith('.png'):
            charge(style, f[:-4]).save(os.path.join(d, f)); n += 1
    print('  %-8s %3d glyphes repris tels quels' % (style, n))

noms = {s: {f[:-4] for f in os.listdir(os.path.join(SRC, s)) if f.endswith('.png')}
        for s in ('filled', 'outline')}
absents = sorted(noms['filled'] - noms['outline'])
for nom in absents:
    evider(charge('filled', nom)).save(os.path.join(OUT, 'outline', nom + '.png'))
print('\n  %d signes du Plein absents du Contour : evides a %d px' % (len(absents), TRAIT))

print('\n  capitales accentuees composees :')
for style in ('filled', 'outline'):
    for lettre, marque_nom, cp, pose in COMPOSITIONS:
        base = charge(style, lettre)
        marque = charge(style, marque_nom)
        origine = style
        if marque is None:                       # absent du Contour : evide du Plein
            marque = evider(charge('filled', marque_nom)); origine = 'plein evide'
        im, h, dy = pose(base, marque)
        nom = 'u%04x' % cp
        im.save(os.path.join(OUT, style, nom + '.png'))
        metriques[style][chr(cp)] = [round(h, 4), round(dy, 4)]
        if style == 'filled':
            print('    %s = %s + %-6s  hauteur %.2f cap  descente %.3f  (%s)'
                  % (chr(cp), lettre, marque_nom, h, dy, origine))

json.dump(metriques, open(os.path.join(OUT, 'metriques.json'), 'w', encoding='utf-8'),
          ensure_ascii=False)
print('\n  jeu complet : Plein %d, Contour %d'
      % (len(os.listdir(os.path.join(OUT, 'filled'))),
         len(os.listdir(os.path.join(OUT, 'outline')))))
