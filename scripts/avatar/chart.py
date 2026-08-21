# -*- coding: utf-8 -*-
"""Releve geometrique des 28 planches d'avatar.

Pour chaque image, ligne par ligne :
  bras gauche | torse | bras droit        au-dessus de l'entrejambe
  jambe gauche | jambe droite            en dessous
Les bords exterieurs sortent de l'alpha (exacts). Le bord bras/torse est
mesure la ou les bras se detachent, et remonte en droite de l'aisselle vers
le haut de l'epaule au-dessus : c'est le sillon delto-pectoral.

L'anatomie VERTICALE est la meme aux sept niveaux (verifie : genou, mollet et
cheville tombent aux memes lignes du niveau 1 au niveau 7). Elle est donc
figee par famille, et seules les largeurs sont relevees image par image.
"""
import numpy as np, os
from PIL import Image

DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app', 'icons', 'avatar')
FAM = ('h-face','h-dos','f-face','f-dos')

# Echelle anatomique par famille : sommet du crane, haut d'epaule, entrejambe,
# genou, cheville, bas de l'image.
LADDER = {
  'h-face': [0, 57, 180, 248, 306, 340],
  'h-dos' : [0, 56, 178, 248, 306, 340],
  'f-face': [0, 70, 183, 248, 306, 340],
  'f-dos' : [0, 68, 182, 248, 306, 340],
}

def files():
    out=[]
    for g in ('h','f'):
        for v in ('face','dos'):
            for n in range(1,8):
                out.append((g,v,n,'n%d-%s%s.png'%(n,g,'-dos' if v=='dos' else '')))
    return out

def famof(g,v): return g+'-'+v

def load(f):
    a=np.array(Image.open(os.path.join(DIR,f)).convert('RGBA')).astype(float)
    return (a[...,3]>100), a[...,:3].mean(2), a

def runs(row):
    r=[];s=None
    for i,v in enumerate(row):
        if v and s is None: s=i
        elif not v and s is not None: r.append([s,i-1]); s=None
    if s is not None: r.append([s,len(row)-1])
    return r

def med(v,k=4):
    v=np.asarray(v,dtype=float); o=v.copy()
    for i in range(len(v)):
        w=v[max(0,i-k):i+k+1]; w=w[~np.isnan(w)]
        if len(w): o[i]=np.median(w)
    return o

def fill(v):
    """Bouche les trous par interpolation lineaire, prolonge aux bords."""
    v=np.asarray(v,dtype=float).copy()
    idx=np.where(~np.isnan(v))[0]
    if not len(idx): return v
    v[:idx[0]]=v[idx[0]]; v[idx[-1]+1:]=v[idx[-1]]
    allx=np.arange(len(v))
    v=np.interp(allx, idx, v[idx])
    return v

def chart(g,v,n,f):
    fam=famof(g,v)
    b,lum,_=load(f); H,W=b.shape
    L=LADDER[fam]; ySh, yCr = L[1], L[2]
    R=[runs(b[y]) for y in range(H)]
    cx=W/2.0
    mids=[]
    for y in range(int(yCr*0.72), yCr-4):
        c=[r for r in R[y] if r[0]-1<=cx<=r[1]+1 and r[1]-r[0]>W*0.15]
        if c: mids.append((c[0][0]+c[0][1])/2.0)
    mid=float(np.median(mids)) if mids else cx

    xL=np.full(H,np.nan); xR=np.full(H,np.nan)     # silhouette exterieure
    tL=np.full(H,np.nan); tR=np.full(H,np.nan)     # bords du torse
    aLo=np.full(H,np.nan); aLi=np.full(H,np.nan)   # bras gauche ext/int
    aRi=np.full(H,np.nan); aRo=np.full(H,np.nan)   # bras droit int/ext
    gL=np.full(H,np.nan); gLi=np.full(H,np.nan)    # jambe gauche ext/int
    gRi=np.full(H,np.nan); gR=np.full(H,np.nan)    # jambe droite int/ext

    for y in range(H):
        rr=[r for r in R[y] if r[1]-r[0]>=1]
        if not rr: continue
        xL[y]=rr[0][0]; xR[y]=rr[-1][1]
        if y<yCr:
            # Pas de run sur la midline : les jambes se sont deja separees au-
            # dessus de l'entrejambe de reference. Se rabattre sur le run le
            # plus large donnerait une CUISSE pour un torse.
            c=[r for r in rr if r[0]<=mid<=r[1]]
            if not c: continue
            c=c[0]
            # Le chignon feminin fait deux runs en haut du crane : on n'accepte
            # une mesure du torse qu'en dessous de l'epaule, et avec de vrais
            # bras de part et d'autre.
            if y>ySh+8 and len(rr)>=3 and c is not rr[0] and c is not rr[-1]                and (c[1]-c[0])>W*0.2:
                tL[y]=c[0]; tR[y]=c[1]
                le=[r for r in rr if r[1]<c[0]]; ri=[r for r in rr if r[0]>c[1]]
                if le: aLo[y]=min(r[0] for r in le); aLi[y]=max(r[1] for r in le)
                if ri: aRi[y]=min(r[0] for r in ri); aRo[y]=max(r[1] for r in ri)
        else:
            # jambes : les runs les plus proches de la midline (les mains pendent
            # a l exterieur). Cuisses jointes = un seul run, coupe a la midline.
            cov=[r for r in rr if r[0]<=mid<=r[1]]
            if cov:
                c=cov[0]; gL[y]=c[0]; gLi[y]=mid; gRi[y]=mid; gR[y]=c[1]
            else:
                le=[r for r in rr if r[1]<mid]; ri=[r for r in rr if r[0]>mid]
                if le and ri:
                    a=max(le,key=lambda r:r[1]); c=min(ri,key=lambda r:r[0])
                    gL[y]=a[0]; gLi[y]=a[1]; gRi[y]=c[0]; gR[y]=c[1]
            # ce qui pend en dehors des jambes, c'est la main / l'avant-bras
            if not np.isnan(gL[y]):
                le=[r for r in rr if r[1]<gL[y]-1]; ri=[r for r in rr if r[0]>gR[y]+1]
                if le: aLo[y]=min(r[0] for r in le); aLi[y]=max(r[1] for r in le)
                if ri: aRi[y]=min(r[0] for r in ri); aRo[y]=max(r[1] for r in ri)

    tL=med(tL,3); tR=med(tR,3)
    # premiere ligne fiable du torse mesure (juste sous l aisselle)
    ok=np.where(~np.isnan(tL[:yCr]))[0]
    yA=int(ok[0]) if len(ok) else ySh+40
    # au-dessus : droite du creux de l aisselle vers le haut de l epaule
    xLs=fill(med(xL,2)); xRs=fill(med(xR,2))
    tA_L, tA_R = tL[yA], tR[yA]
    for y in range(0,yA):
        if y<ySh:
            tL[y]=xLs[y]; tR[y]=xRs[y]; continue
        # Le sillon file vite vers l'exterieur sous la clavicule puis se
        # redresse : une droite de l'epaule a l'aisselle passe trop dedans au
        # tiers superieur, et le pectoral s'y trouvait ampute. D'ou l'exposant.
        u=((y-ySh)/max(1.0,(yA-ySh)))**0.6
        topL=mid-0.42*(mid-xLs[y]); topR=mid+0.42*(xRs[y]-mid)
        tL[y]=topL*(1-u)+tA_L*u
        tR[y]=topR*(1-u)+tA_R*u
    # Derniere ligne ou l'on voit encore un bras (le bout des doigts) : au-dela
    # les tableaux ne valent plus rien et ne doivent pas etre prolonges.
    # On suit le bras SANS TROU depuis l'aisselle : les talons du bas de l'image
    # forment eux aussi des runs a l'exterieur des jambes, et les prendre pour
    # une main ferait descendre l'avant-bras jusqu'au sol.
    yArmBot=yA; trou=0
    for y in range(yA, min(H, yCr+40)):
        if np.isnan(aLo[y]) and np.isnan(aRo[y]):
            trou+=1
            if trou>8: break
        else:
            trou=0; yArmBot=y
    # Meme traitement que pour les jambes : au ras du bassin, la main frole la
    # cuisse et une ligne sur vingt confond les deux.
    for arr in (aLo, aLi, aRi, aRo):
        m=med(arr,7)
        bad=~np.isnan(arr)&(np.abs(arr-m)>5)
        arr[bad]=m[bad]
    aLo=med(aLo,2); aLi=med(aLi,2); aRi=med(aRi,2); aRo=med(aRo,2)
    # zone fondue (epaule -> aisselle) : le bras va de la silhouette au torse,
    # bord commun avec le torse — impose APRES lissage sinon les deux se croisent
    for y in range(0,yA):
        aLo[y]=xLs[y]; aLi[y]=tL[y]; aRi[y]=tR[y]; aRo[y]=xRs[y]
    # Les cuisses commencent au-dessus de l'entrejambe : au bassin, la jambe va
    # du bord du torse a la midline. Sans cela le quadriceps naitrait au genou.
    # Les mains pendent au ras des cuisses : une ligne sur vingt, le releve
    # confond la main et la jambe. Mediane large, puis rejet de ce qui s'en
    # ecarte de plus de six pixels — sinon le contour part en zigzag.
    for arr in (gL, gLi, gRi, gR):
        for k in (15, 7):
            m=med(arr,k)
            bad=~np.isnan(arr)&(np.abs(arr-m)>4)
            arr[bad]=m[bad]
    gL=med(gL,3); gLi=med(gLi,3); gRi=med(gRi,3); gR=med(gR,3)
    for y in range(0,yCr):
        gL[y]=tL[y]; gLi[y]=mid; gRi[y]=mid; gR[y]=tR[y]

    out=dict(f=f,fam=fam,g=g,v=v,n=n,W=W,H=H,mid=mid,ySh=ySh,yCr=yCr,yA=yA,
             yArmBot=yArmBot,
             xL=xLs,xR=xRs,tL=fill(tL),tR=fill(tR),
             aLo=fill(aLo),aLi=fill(aLi),aRi=fill(aRi),aRo=fill(aRo),
             gLo=fill(gL),gLi=fill(gLi),gRi=fill(gRi),gRo=fill(gR),
             body=b,lum=lum,ladder=L)
    return out

# ---- passage echelle anatomique -> pixels -----------------------------------
def ytop(c, v):
    """v sur l'echelle 0..5 (crane, epaule, entrejambe, genou, cheville, bas)."""
    L=c['ladder']
    v=max(0.0,min(5.0,float(v)))
    i=int(v); i=min(i,4); fr=v-i
    return L[i]+(L[i+1]-L[i])*fr

SEG=('AL','TO','AR','JL','JR')
def xseg(c, y, seg, t):
    y=int(round(max(0,min(c['H']-1,y))))
    if seg=='AL': a,b=c['aLo'][y], c['aLi'][y]
    elif seg=='TO': a,b=c['tL'][y], c['tR'][y]
    elif seg=='AR': a,b=c['aRi'][y], c['aRo'][y]
    elif seg=='JL': a,b=c['gLo'][y], c['gLi'][y]
    elif seg=='JR': a,b=c['gRi'][y], c['gRo'][y]
    else: a,b=c['xL'][y], c['xR'][y]
    return a+(b-a)*t

if __name__=='__main__':
    for g,v,n,f in files():
        c=chart(g,v,n,f)
        print('%-14s W=%3d mid=%5.1f yA=%3d'%(f,c['W'],c['mid'],c['yA']))
