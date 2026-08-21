# -*- coding: utf-8 -*-
"""Controle visuel du releve : bords torse / bras / jambes poses sur le dessin."""
import numpy as np, os, sys
from PIL import Image
from chart import chart, files
S=5
OUT=r'C:\Users\kevin\AppData\Local\Temp\claude\C--Users-kevin-Downloads\0ea2b4bc-f20a-4555-87b6-67ce6efdaf5a\scratchpad'
def draw(c):
    H,W=c['H'],c['W']
    img=np.zeros((H,W,3),np.uint8)
    img[c['body']]=(70,70,70)
    img[(c['lum']<170)&c['body']]=(180,180,180)
    def put(arr,col,y0,y1):
        for y in range(y0,y1):
            x=arr[y]
            if np.isnan(x): continue
            xi=int(round(x))
            if 0<=xi<W: img[y,xi]=col
    yb=c['H']
    put(c['aLo'],(0,200,0),c['ySh'],yb); put(c['aLi'],(0,200,0),c['ySh'],yb)
    put(c['aRi'],(0,200,0),c['ySh'],yb); put(c['aRo'],(0,200,0),c['ySh'],yb)
    put(c['tL'],(255,40,40),0,c['yCr']); put(c['tR'],(255,40,40),0,c['yCr'])
    put(c['gLo'],(60,120,255),c['yCr'],H); put(c['gLi'],(60,120,255),c['yCr'],H)
    put(c['gRi'],(60,120,255),c['yCr'],H); put(c['gRo'],(60,120,255),c['yCr'],H)
    for y in (c['ySh'],c['yCr']):
        img[y,:]= (255,255,0)
    return Image.fromarray(img).resize((W*S,H*S),Image.NEAREST)
sel=sys.argv[1] if len(sys.argv)>1 else 'all'
ims=[]
for g,v,n,f in files():
    if sel!='all' and sel not in f: continue
    ims.append(draw(chart(g,v,n,f)))
W=sum(i.width for i in ims)+12*len(ims); H=max(i.height for i in ims)
sh=Image.new('RGB',(W,H),(0,0,0)); x=0
for i in ims: sh.paste(i,(x,0)); x+=i.width+12
sh.save(os.path.join(OUT,'overlay.png')); print(sh.size)
