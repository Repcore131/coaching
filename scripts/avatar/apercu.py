# -*- coding: utf-8 -*-
"""Ce que l'athlete voit : la vignette a sa taille d'affichage, teintee comme
dans l'app — masque = alpha de la planche, fusion « multiply », flou 0,4 px.

On ne redessine pas les zones : on relit LA TABLE LIVREE dans index.html, et on
la fait analyser par node — le seul analyseur qui lise exactement ce que lira
le navigateur. La page de controle vaut donc aussi controle de syntaxe.
"""
import io, os, json, subprocess, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', '..', 'app')
OUT = (r'C:\Users\kevin\AppData\Local\Temp\claude'
       r'\C--Users-kevin-Downloads\0ea2b4bc-f20a-4555-87b6-67ce6efdaf5a\scratchpad')

W, H = 56, 118          # .wo-ava-img : hauteur 118 px, largeur au plus 56
K = 3                   # loupe pour le controle
FILL = np.array([255, 35, 35], float)
BLUR = 0.4

src = io.open(os.path.join(APP, 'index.html'), encoding='utf-8', newline='').read()
i = src.index('const WO_ZONES = {')
j = src.index('// Les six groupes', i)
bloc = src[i:j].strip().replace('\r\n', '\n')
tmp = os.path.join(tempfile.gettempdir(), '_zones_tmp.js')
io.open(tmp, 'w', encoding='utf-8', newline='\n').write(
    bloc.replace('const WO_ZONES', 'globalThis.WO_ZONES', 1)
    + '\nprocess.stdout.write(JSON.stringify(globalThis.WO_ZONES));\n')
Z = json.loads(subprocess.run(['node', tmp], capture_output=True,
                              text=True, check=True).stdout)

MUSC = {'face': ['TRAPEZES', 'DELT_ANT', 'DELT_LAT', 'PECTORAUX', 'DORSAUX',
                 'ABDOS', 'BICEPS', 'TRICEPS', 'AVANT_BRAS', 'QUADRICEPS',
                 'ABDUCTEURS', 'ADDUCTEURS', 'MOLLETS'],
        'dos': ['TRAPEZES', 'DELT_POST', 'DELT_LAT', 'DORSAUX', 'LOMBAIRES',
                'TRICEPS', 'BICEPS', 'AVANT_BRAS', 'FESSIERS', 'ISCHIOS',
                'ABDUCTEURS', 'ADDUCTEURS', 'MOLLETS']}


def vignette(g, v, n, muscles):
    f = 'n%d-%s%s.png' % (n, g, '-dos' if v == 'dos' else '')
    im = Image.open(os.path.join(APP, 'icons', 'avatar', f)).convert('RGBA')
    im = im.resize((W * K, H * K), Image.LANCZOS)
    a = np.array(im).astype(float)
    alpha = a[..., 3:4] / 255.0
    fond = np.zeros((H * K, W * K, 3), float) + 18.0
    dessin = fond * (1 - alpha) + a[..., :3] * alpha

    lay = Image.new('L', (W * K, H * K), 0)
    d = ImageDraw.Draw(lay)
    for m in muscles:
        for p in Z[g][v][str(n)].get(m, []):
            pts = [(float(c.split(',')[0]) / 100 * W * K,
                    float(c.split(',')[1]) / 100 * H * K) for c in p.split(' ')]
            d.polygon(pts, fill=255)
    lay = lay.filter(ImageFilter.GaussianBlur(BLUR * K))
    cov = (np.array(lay).astype(float) / 255.0)[..., None] * alpha   # mask-image
    res = dessin * (1 - cov) + dessin * (FILL / 255.0) * cov         # multiply
    return Image.fromarray(res.clip(0, 255).astype(np.uint8))


def planche(g, v):
    ms = MUSC[v]
    tw, th = W * K + 6, H * K + 16
    sh = Image.new('RGB', (tw * len(ms) + 30, th * 7 + 4), (12, 12, 14))
    d = ImageDraw.Draw(sh)
    for r, n in enumerate(range(1, 8)):
        for c, m in enumerate(ms):
            sh.paste(vignette(g, v, n, [m]), (4 + c * tw, 16 + r * th))
            if r == 0:
                d.text((4 + c * tw, 3), m[:13], fill=(255, 180, 40))
        d.text((sh.width - 24, 16 + r * th), 'n%d' % n, fill=(150, 150, 170))
    p = os.path.join(OUT, 'apercu_%s_%s.png' % (g, v))
    sh.save(p)
    print(p, sh.size)


if __name__ == '__main__':
    for g in ('h', 'f'):
        for v in ('face', 'dos'):
            planche(g, v)
