#!/usr/bin/env python3
"""La vignette Abducteurs (06/10/2026, build 1822).

L'ancienne abducteurs.webp teintait la face interne des cuisses : les
adducteurs. Celle-ci part de la planche fessiers.webp (même style, même
éclairage) : le grand fessier repasse au gris de planche, le moyen fessier et
le tenseur du fascia lata prennent la teinte des adducteurs, puis le cadre se
rapproche de la hanche droite et s'étire vers le bord latéral (trois quarts
arrière). 128 × 128, WebP qualité 60, comme les autres vignettes.

Usage : python3 scripts/vignette_abducteurs.py   (depuis la racine du dépôt)
"""
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
OUT=sys.argv[1] if len(sys.argv)>1 else "app/img/muscles/abducteurs.webp"
src=np.asarray(Image.open('app/img/muscles/fessiers.webp').convert('RGB')).astype(float)
R,G,B=src[...,0],src[...,1],src[...,2]
L=0.3*R+0.59*G+0.11*B
# 1) Grand fessier : le vert redevient gris de planche.
vert=np.clip((G-np.maximum(R,B)-12)/50,0,1)
m=Image.fromarray((vert*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(2))
zone=np.asarray(m).astype(float)/255
# le gris des planches : luminance comprimée vers les tons du reste
Lb=np.asarray(Image.fromarray(L.astype(np.uint8)).filter(ImageFilter.GaussianBlur(4))).astype(float)
gris=np.clip(22+L*0.30+(L-Lb)*1.6,0,255)
# le liseré brun-rouge autour du vert : désaturé lui aussi, à sa propre luminance
large=np.asarray(Image.fromarray((vert*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(21))).astype(float)/255
rouge=np.clip((R-G-4)/25,0,1)*large
src2=src.copy()
for c in range(3): src2[...,c]=src[...,c]*(1-rouge)+(L*0.8)*rouge
src=src2
out=src.copy()
for c in range(3):
    gc=gris*(1.0 if c<2 else 1.04)
    out[...,c]=src[...,c]*(1-zone)+gc*zone
# 2) Moyen fessier (sous la crête, au-dessus et en dehors du grand fessier) et TFL (bord latéral).
H=W=128
def masque(polys,flou):
    im=Image.new('L',(W,H),0); d=ImageDraw.Draw(im)
    for p in polys: d.polygon(p,fill=255)
    return np.asarray(im.filter(ImageFilter.GaussianBlur(flou))).astype(float)/255
def miroir(p): return [(W-1-x,y) for x,y in p]
moyen=[(78,22),(90,15),(106,12),(119,15),(127,24),(128,40),(127,58),(122,74),(114,70),(113,56),(109,44),(100,36),(88,30)]
tfl=[(122,30),(128,32),(128,72),(126,96),(120,100),(119,80),(121,60),(122,44)]
mm=masque([moyen,miroir(moyen),tfl,miroir(tfl)],1.2)
Lo=0.3*out[...,0]+0.59*out[...,1]+0.11*out[...,2]
teinte=np.array([128,200,28],float)
l=np.clip(0.30+Lo/150,0,1.35)
col=np.stack([teinte[c]*l for c in range(3)],-1)
col=np.clip(col+np.clip(Lo-200,0,None)[...,None]*0.4,0,255)
out=out*(1-mm[...,None])+col*mm[...,None]
img=Image.fromarray(np.clip(out,0,255).astype(np.uint8))
# 3) Trois quarts arrière : on se rapproche de la hanche droite, bord latéral à droite.
x0,y0,c=34,2,94
big=img.crop((x0,y0,x0+c,y0+c)).resize((512,512),Image.LANCZOS)
a=np.asarray(big).astype(float)
u=(np.arange(512)+0.5)/512
sx=np.clip((u**0.72)*512-0.5,0,511)
i0=np.floor(sx).astype(int); i1=np.minimum(i0+1,511); f=(sx-i0)[None,:,None]
a=a[:,i0,:]*(1-f)+a[:,i1,:]*f
img=Image.fromarray(np.clip(a,0,255).astype(np.uint8)).resize((128,128),Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2,60,2))
img.save(OUT,'WEBP',quality=60,method=6)
