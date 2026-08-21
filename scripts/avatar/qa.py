# -*- coding: utf-8 -*-
"""Planches de controle : chaque muscle pose sur chacune des 28 vignettes.

  python qa.py muscle PECTORAUX      un muscle, les 28 planches
  python qa.py image  n4-h.png       une planche, tous ses muscles
  python qa.py vue    h face         les 7 niveaux, tous les muscles empiles
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw
from chart import chart, files
from build import formes

OUT = (r'C:\Users\kevin\AppData\Local\Temp\claude'
       r'\C--Users-kevin-Downloads\0ea2b4bc-f20a-4555-87b6-67ce6efdaf5a\scratchpad')
SS = 4     # sur-echantillonnage du trace
Z = 4      # agrandissement de la vignette rendue


def masque(c, poly):
    """Le polygone rasterise, puis rogne par la vignette : le muscle ne peut
    pas deborder de la chair, exactement comme le fera le mask CSS."""
    W, H = c['W'], c['H']
    im = Image.new('L', (W * SS, H * SS), 0)
    ImageDraw.Draw(im).polygon([(x * SS, y * SS) for (x, y) in poly], fill=255)
    a = np.array(im.resize((W, H), Image.LANCZOS)).astype(float) / 255.0
    return a * c['body']


def rendu(c, noms, couleurs=None):
    W, H = c['W'], c['H']
    base = np.zeros((H, W, 3), float)
    base[c['body']] = (255, 255, 255)
    base[(c['lum'] < 175) & c['body']] = (25, 25, 30)
    fs = formes(c)
    pal = couleurs or {}
    for i, nom in enumerate(noms):
        col = np.array(pal.get(nom, (255, 40, 40)), float)
        for poly in fs.get(nom, []):
            m = masque(c, poly)[..., None]
            base = base * (1 - m * 0.72) + col * (m * 0.72)
    img = Image.fromarray(base.clip(0, 255).astype(np.uint8))
    return img.resize((W * Z, H * Z), Image.LANCZOS)


def sheet(ims, titres, path, cols=None):
    cols = cols or len(ims)
    lignes = [ims[i:i + cols] for i in range(0, len(ims), cols)]
    lw = [sum(i.width for i in r) + 10 * len(r) for r in lignes]
    W = max(lw); H = sum(max(i.height for i in r) + 16 for r in lignes)
    sh = Image.new('RGB', (W, H), (12, 12, 14))
    d = ImageDraw.Draw(sh); y = 0
    k = 0
    for r in lignes:
        x = 0
        for i in r:
            sh.paste(i, (x, y + 14))
            d.text((x + 4, y + 2), titres[k], fill=(255, 210, 60)); k += 1
            x += i.width + 10
        y += max(i.height for i in r) + 16
    sh.save(path); print(path, sh.size)


PALETTE = [(255,60,60),(60,160,255),(70,230,120),(255,190,40),(200,110,255),
           (255,120,200),(90,235,235),(255,140,60),(160,220,60),(120,140,255),
           (240,90,140),(60,200,180),(220,220,90)]


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'image'
    if mode == 'muscle':
        nom = sys.argv[2]
        ims, tt = [], []
        for g, v, n, f in files():
            c = chart(g, v, n, f)
            if nom not in MUSCLES_DE(c): continue
            ims.append(rendu(c, [nom])); tt.append(f.replace('.png', ''))
        sheet(ims, tt, os.path.join(OUT, 'qa_%s.png' % nom), cols=7)
    elif mode == 'vue':
        g, v = sys.argv[2], sys.argv[3]
        ims, tt = [], []
        for gg, vv, n, f in files():
            if gg != g or vv != v: continue
            c = chart(gg, vv, n, f)
            noms = sorted(MUSCLES_DE(c))
            pal = {m: PALETTE[i % len(PALETTE)] for i, m in enumerate(noms)}
            ims.append(rendu(c, noms, pal)); tt.append(f.replace('.png', ''))
        sheet(ims, tt, os.path.join(OUT, 'qa_vue_%s_%s.png' % (g, v)), cols=7)
    elif mode == 'zoom':
        global Z
        Z = 8
        f = sys.argv[2]
        g = 'f' if '-f' in f else 'h'
        v = 'dos' if 'dos' in f else 'face'
        c = chart(g, v, int(f[1]), f)
        noms = sys.argv[3:]
        ims = [rendu(c, [m]) for m in noms]
        sheet(ims, noms, os.path.join(OUT, 'qa_zoom.png'), cols=len(noms))
    else:
        f = sys.argv[2]
        g = 'f' if '-f' in f else 'h'
        v = 'dos' if 'dos' in f else 'face'
        n = int(f[1])
        c = chart(g, v, n, f)
        noms = sorted(MUSCLES_DE(c))
        ims = [rendu(c, [m]) for m in noms]
        sheet(ims, noms, os.path.join(OUT, 'qa_img_%s.png' % f.replace('.png', '')),
              cols=7)


def MUSCLES_DE(c):
    import muscles as MU
    return list(MU.VUE[c['v']].keys())


if __name__ == '__main__':
    main()
