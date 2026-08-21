# -*- coding: utf-8 -*-
import numpy as np, os, sys
from PIL import Image, ImageDraw
from chart import DIR
S=6
OUT=r'C:\Users\kevin\AppData\Local\Temp\claude\C--Users-kevin-Downloads\0ea2b4bc-f20a-4555-87b6-67ce6efdaf5a\scratchpad'
names=sys.argv[1:] or ['n4-h.png']
ims=[]
for f in names:
    im=Image.open(os.path.join(DIR,f)).convert('RGBA')
    bg=Image.new('RGBA',im.size,(0,0,0,255)); bg.alpha_composite(im)
    bg=bg.resize((im.width*S,im.height*S),Image.LANCZOS).convert('RGB')
    d=ImageDraw.Draw(bg)
    for y in range(0,im.height,10):
        col=(255,90,0) if y%50==0 else (0,110,160)
        d.line([(0,y*S),(bg.width,y*S)],fill=col,width=1)
        d.text((2,y*S+1),str(y),fill=(255,220,0))
    for x in range(0,im.width,10):
        d.line([(x*S,0),(x*S,bg.height)],fill=(0,110,160),width=1)
        d.text((x*S+2,2),str(x),fill=(0,255,180))
    ims.append(bg)
W=sum(i.width for i in ims)+16*len(ims); H=max(i.height for i in ims)
sh=Image.new('RGB',(W,H),(0,0,0)); x=0
for i in ims: sh.paste(i,(x,0)); x+=i.width+16
sh.save(os.path.join(OUT,'grid.png')); print(sh.size)
