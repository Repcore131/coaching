#!/usr/bin/env python3
"""L'histoire de Léna, épisode 1 : montage du reel TikTok vertical.

    python build.py --apercu     une capture par scène dans output/apercus/
    python build.py              export final des deux versions

Il faut ffmpeg dans le PATH, et Pillow et numpy (pip install Pillow numpy).
Si video/09_final.mp4 existe, elle sert de scène finale ; sinon l'image
08_miroir_abdos.jpg est montrée avec un zoom lent de 5 s.
"""
import argparse
import math
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30
DUREE = 19.0

# Zone sûre TikTok : rien dans les 150 px du haut, les 250 du bas, les 120 de droite.
SUR_HAUT, SUR_BAS, SUR_DROITE = 150, 250, 120
TEXTE_LARGEUR_MAX = 2 * (W // 2 - SUR_DROITE) - 40   # centré sur l'écran, sans toucher la marge droite
TEXTE_Y = 1180                                       # centre vertical des textes

ICI = os.path.dirname(os.path.abspath(__file__))
POLICE = os.path.join(ICI, "assets", "Montserrat-Bold.otf")
EMOJI = os.path.join(ICI, "assets", "emoji_rire.png")

NBSP = " "
# Cinq photos : 03_fastfood, 05_epaules, 06_banc et 07_hipthrust manquent. Le flash reste
# à 7,0 s (le drop du son) et les trois coupes rythmées sont trois cadrages de la même photo.
# cadre = (centre x, centre y en fraction de la photo, zoom de départ)
SCENES = [
    dict(nom="01_bar", debut=0.0, fin=3.5, src="01_bar.jpg", look="avant",
         texte=f"Ils m'appelaient «{NBSP}la{NBSP}grosse{NBSP}»", texte_y=1480),
    dict(nom="02_resto", debut=3.5, fin=7.0, src="02_resto.jpg", look="avant", perso=True),
    dict(nom="flash", debut=7.0, fin=7.4),
    dict(nom="04_piscine", debut=7.4, fin=9.9, src="04_piscine.jpg", look="apres",
         texte="2 ans plus tard.", texte_y=1520),
    dict(nom="05_salle_large", debut=9.9, fin=11.25, src="05_souleve_de_terre.jpg", look="apres",
         rapide=True, cadre=(0.50, 0.50, 1.0)),
    dict(nom="06_salle_buste", debut=11.25, fin=12.6, src="05_souleve_de_terre.jpg", look="apres",
         rapide=True, cadre=(0.45, 0.36, 1.45)),
    dict(nom="07_salle_visage", debut=12.6, fin=13.9, src="05_souleve_de_terre.jpg", look="apres",
         rapide=True, cadre=(0.33, 0.24, 1.8)),
    dict(nom="09_final", debut=13.9, fin=19.0, src="08_miroir_abdos.jpg", video="09_final.mp4",
         look="apres", texte="Qui rigole maintenant ?", texte_debut=15.0, texte_y=340),
]
# Instant de la capture d'aperçu, quand il ne tombe pas au milieu de la scène.
APERCU_T = {"02_resto": 6.0, "flash": 7.2, "09_final": 16.5}


# ---------- Étalonnage ----------

def _saturation(a, s):
    gris = (a @ np.array([0.299, 0.587, 0.114], dtype=np.float32))[..., None]
    return gris + s * (a - gris)


def etalonne(img, look):
    a = np.asarray(img, dtype=np.float32)
    if look == "avant":            # terne : légère désaturation, contraste un peu écrasé
        a = _saturation(a, 0.55)
        a = (a - 128) * 0.93 + 128 + 4
    else:                          # chaud et contrasté
        a = a * np.array([1.07, 1.01, 0.90], dtype=np.float32) + np.array([6, 2, -4], dtype=np.float32)
        a = (a - 128) * 1.15 + 128
        a = _saturation(a, 1.12)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


class Grain:
    def __init__(self, n=8, force=11):
        rng = np.random.default_rng(7)
        self.tuiles = []
        for _ in range(n):
            g = rng.normal(0, force, (H // 2, W // 2)).astype(np.float32)
            g = np.asarray(Image.fromarray(g, mode="F").resize((W, H), Image.BILINEAR))
            self.tuiles.append(g[..., None])

    def applique(self, img, i):
        a = np.asarray(img, dtype=np.float32) + self.tuiles[i % len(self.tuiles)]
        return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


# ---------- Plans ----------

def adoucit(p):
    return p * p * (3 - 2 * p)


class PlanPhoto:
    """Photo recadrée pour remplir le 9:16, avec un Ken Burns."""
    MARGE = 1.14

    def __init__(self, chemin, look, rapide=False, sens=1, lent=False, cadre=(0.5, 0.5, 1.0)):
        src = Image.open(chemin).convert("RGB")
        e = max(W * self.MARGE / src.width, H * self.MARGE / src.height)
        self.img = etalonne(src.resize((round(src.width * e), round(src.height * e)), Image.LANCZOS), look)
        self.rapide, self.sens, self.lent, self.cadre = rapide, sens, lent, cadre

    def image(self, p):
        if self.rapide:            # coupes rythmées : recul nerveux au début du plan
            z = 1.0 + 0.11 * (1 - p) ** 3
        elif self.lent:
            z = 1.0 + 0.10 * adoucit(p)
        else:
            z = 1.0 + 0.07 * adoucit(p)
        fx, fy, z0 = self.cadre
        iw, ih = self.img.size
        k = min(iw / W, ih / H) / (z * z0)               # plus grand cadre 9:16 dans la photo, puis zoom
        bw, bh = W * k, H * k
        glisse = (iw - bw) * 0.35 * self.sens * (adoucit(p) - 0.5)
        cx = min(max(iw * fx + glisse, bw / 2), iw - bw / 2)
        cy = min(max(ih * fy, bh / 2), ih - bh / 2)
        return self.img.transform((W, H), Image.EXTENT,
                                  (cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2), Image.BICUBIC)


class PlanVideo:
    def __init__(self, chemin, look, n):
        brut = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", chemin, "-vf",
             f"fps={FPS},scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
            check=True, capture_output=True).stdout
        k = len(brut) // (W * H * 3)
        if k == 0:
            sys.exit(f"Aucune image lisible dans {chemin}")
        self.images = [np.frombuffer(brut, np.uint8, W * H * 3, i * W * H * 3).reshape(H, W, 3) for i in range(k)]
        self.look, self.n = look, n

    def image(self, p):
        i = min(int(p * self.n), len(self.images) - 1)   # la dernière image tient si la vidéo est courte
        return etalonne(Image.fromarray(self.images[i]), self.look)


# ---------- Textes et incrustations ----------

def police(taille):
    return ImageFont.truetype(POLICE, taille)


def coupe_lignes(texte, f, largeur):
    lignes, cour = [], ""
    for mot in texte.split(" "):
        essai = f"{cour} {mot}".strip()
        if f.getlength(essai) <= largeur or not cour:
            cour = essai
        else:
            lignes.append(cour)
            cour = mot
    return lignes + [cour]


def calque_texte(texte, taille=82, contour=4):
    f = police(taille)
    lignes = coupe_lignes(texte, f, TEXTE_LARGEUR_MAX)
    inter = int(taille * 1.18)
    haut = inter * len(lignes) + contour * 2 + 10
    im = Image.new("RGBA", (W, haut))
    d = ImageDraw.Draw(im)
    for k, l in enumerate(lignes):
        d.text((W / 2, contour + 5 + k * inter), l, font=f, fill="white", anchor="ma",
               stroke_width=contour, stroke_fill="black")
    return im


def mention():
    im = Image.new("RGBA", (W, H))
    d = ImageDraw.Draw(im)
    f = police(28)
    txt = "Personnage virtuel IA · Image virtuelle"
    d.text((42, SUR_HAUT + 14), txt, font=f, fill=(0, 0, 0, 70))       # ombre discrète pour les fonds clairs
    d.text((40, SUR_HAUT + 12), txt, font=f, fill=(255, 255, 255, 153))
    return im


def pop(calque, age, duree=0.22):
    """Apparition : fondu et léger rebond d'échelle."""
    if age >= duree:
        return calque, 1.0
    p = age / duree
    e = 0.82 + 0.18 * (1 - (1 - p) ** 3) + 0.06 * math.sin(p * math.pi)
    c = calque.resize((max(1, round(calque.width * e)), max(1, round(calque.height * e))), Image.BICUBIC)
    return c, p


def colle(fond, calque, cx, cy, alpha=1.0):
    if alpha < 1:
        calque = calque.copy()
        calque.putalpha(calque.getchannel("A").point(lambda v: int(v * alpha)))
    fond.alpha_composite(calque, (round(cx - calque.width / 2), round(cy - calque.height / 2)))


# ---------- Le petit bonhomme ----------

def dessine_bonhomme():
    s = 2                                  # dessiné en double taille puis réduit, pour l'anticrénelage
    im = Image.new("RGBA", (260 * s, 330 * s))
    d = ImageDraw.Draw(im)
    n, ep = (20, 20, 20, 255), 7 * s

    def trait(*pts):
        d.line([(x * s, y * s) for x, y in pts], fill=n, width=ep, joint="curve")
        for x, y in (pts[0], pts[-1]):
            d.ellipse((x * s - ep / 2, y * s - ep / 2, x * s + ep / 2, y * s + ep / 2), fill=n)

    trait((140, 190), (140, 262))                        # corps
    trait((140, 262), (112, 318)); trait((140, 262), (170, 318))   # jambes
    trait((140, 212), (60, 186), (22, 176))              # bras qui pointe vers Léna
    trait((140, 212), (178, 244), (150, 258))            # main sur le ventre
    d.ellipse((70 * s, 30 * s, 210 * s, 170 * s), fill=(255, 214, 90, 255), outline=n, width=ep)   # tête
    for x in (112, 168):                                 # yeux plissés de rire ^ ^
        d.arc(((x - 16) * s, 72 * s, (x + 16) * s, 104 * s), 200, 340, fill=n, width=6 * s)
    d.chord((102 * s, 100 * s, 178 * s, 160 * s), 0, 180, fill=(120, 20, 30, 255), outline=n, width=6 * s)  # bouche
    d.chord((122 * s, 136 * s, 158 * s, 164 * s), 180, 360, fill=(240, 100, 110, 255))                      # langue
    for x in (84, 196):                                  # larmes de rire
        d.ellipse(((x - 8) * s, 100 * s, (x + 8) * s, 122 * s), fill=(90, 180, 255, 255), outline=n, width=3 * s)
    return im.resize((260, 330), Image.LANCZOS)


def dessine_bulle():
    f = police(40)
    emoji = Image.open(EMOJI).convert("RGBA")
    emoji = emoji.resize((round(emoji.width * 44 / emoji.height), 44), Image.LANCZOS)
    l1, l2 = "Oh regardez,", "c'est la grosse "
    larg = max(f.getlength(l1), f.getlength(l2) + emoji.width) + 64
    haut = 2 * 52 + 44
    im = Image.new("RGBA", (int(larg) + 10, int(haut) + 60))
    d = ImageDraw.Draw(im)
    n = (20, 20, 20, 255)
    d.polygon([(larg - 150, haut - 4), (larg - 70, haut - 4), (larg - 40, haut + 52)], fill="white", outline=n, width=5)
    d.rounded_rectangle((3, 3, larg, haut), radius=34, fill="white", outline=n, width=5)
    d.polygon([(larg - 146, haut - 8), (larg - 74, haut - 8), (larg - 44, haut + 44)], fill="white")   # raccord bulle / pointe
    d.text((32, 22), l1, font=f, fill=n)
    d.text((32, 22 + 52), l2, font=f, fill=n)
    im.alpha_composite(emoji, (int(32 + f.getlength(l2)), 22 + 52))
    return im


class Perso:
    PIEDS_Y = H - SUR_BAS - 4             # les pieds restent au-dessus de la zone du bas
    DROITE_X = W - SUR_DROITE - 10

    def __init__(self):
        self.corps = dessine_bonhomme()
        self.bulle = dessine_bulle()

    def pose(self, fond, age):
        phase = age * 2.4                 # 2,4 sauts par seconde
        saut = abs(math.sin(math.pi * phase))
        ecrase = max(0.0, 1 - saut * 4)   # tassé au contact du sol
        c = self.corps.resize((round(self.corps.width * (1 + 0.08 * ecrase)),
                               round(self.corps.height * (1 - 0.08 * ecrase))), Image.BICUBIC)
        c = c.rotate(5 * math.sin(math.pi * phase * 2), resample=Image.BICUBIC, expand=True)
        x = self.DROITE_X - c.width
        y = self.PIEDS_Y - c.height - 46 * saut
        fond.alpha_composite(c, (round(x), round(y)))
        if age > 0.3:                     # la bulle arrive juste après lui
            b, a = pop(self.bulle, age - 0.3)
            bx = self.DROITE_X - 90 - self.bulle.width / 2
            by = self.PIEDS_Y - self.corps.height - 70 - self.bulle.height / 2
            colle(fond, b, bx, by, a)


# ---------- Montage ----------

class Montage:
    def __init__(self, dossier):
        self.dossier = dossier
        self.grain = Grain()
        self.mention = mention()
        self.perso = Perso()
        self.plans, self.textes = {}, {}
        video = os.path.join(dossier, "video", "09_final.mp4")
        sens = 1
        for sc in SCENES:
            if "src" not in sc:
                continue
            n = round((sc["fin"] - sc["debut"]) * FPS)
            if sc.get("video") and os.path.exists(video):
                print(f"  {sc['nom']} : vidéo {video}")
                self.plans[sc["nom"]] = PlanVideo(video, sc["look"], n)
            else:
                chemin = os.path.join(dossier, "images", sc["src"])
                if not os.path.exists(chemin):
                    sys.exit(f"Image manquante : {chemin}")
                if sc.get("video"):
                    print(f"  {sc['nom']} : pas de video/09_final.mp4, zoom lent sur {sc['src']}")
                self.plans[sc["nom"]] = PlanPhoto(chemin, sc["look"], sc.get("rapide", False), sens,
                                                  lent=bool(sc.get("video")),
                                                  cadre=sc.get("cadre", (0.5, 0.5, 1.0)))
                sens = -sens
            if sc.get("texte"):
                self.textes[sc["nom"]] = calque_texte(sc["texte"])

    def scene(self, nom):
        return next(s for s in SCENES if s["nom"] == nom)

    def fond(self, sc, t, i):
        p = min(max((t - sc["debut"]) / (sc["fin"] - sc["debut"]), 0.0), 1.0)
        im = self.plans[sc["nom"]].image(p)
        if sc["look"] == "avant":
            im = self.grain.applique(im, i)
        return im.convert("RGBA")

    def image(self, t, i, avec_perso=True):
        """Renvoie l'image de l'instant t (sans et avec le bonhomme si demandé)."""
        sc = next(s for s in SCENES if s["debut"] <= t < s["fin"]) if t < DUREE else SCENES[-1]
        if sc["nom"] == "flash":          # fondu vers le blanc, puis du blanc vers la piscine
            mi = (sc["debut"] + sc["fin"]) / 2
            if t < mi:
                im, a = self.fond(self.scene("02_resto"), sc["debut"], i), (t - sc["debut"]) / (mi - sc["debut"])
            else:
                im, a = self.fond(self.scene("04_piscine"), sc["fin"], i), 1 - (t - mi) / (sc["fin"] - mi)
            im = Image.blend(im, Image.new("RGBA", (W, H), "white"), min(1.0, a * 1.15))
        else:
            im = self.fond(sc, t, i)
            if sc["nom"] in self.textes:
                age = t - sc.get("texte_debut", sc["debut"])
                if age >= 0:
                    c, a = pop(self.textes[sc["nom"]], age)
                    colle(im, c, W / 2, sc.get("texte_y", TEXTE_Y), a)
        im.alpha_composite(self.mention)
        sans = im
        if avec_perso and sc.get("perso"):
            im = im.copy()
            self.perso.pose(im, t - sc["debut"])
        return sans.convert("RGB"), im.convert("RGB")


def ffmpeg_sortie(chemin):
    return subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
         "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-maxrate", "10M", "-bufsize", "20M",
         "-profile:v", "high", "-pix_fmt", "yuv420p", "-r", str(FPS), "-movflags", "+faststart", chemin],
        stdin=subprocess.PIPE)


def apercus(m, sortie):
    dos = os.path.join(sortie, "apercus")
    os.makedirs(dos, exist_ok=True)
    vignettes = []
    for k, sc in enumerate(SCENES):
        t = APERCU_T.get(sc["nom"], (sc["debut"] + sc["fin"]) / 2)
        _, im = m.image(t, round(t * FPS))
        chemin = os.path.join(dos, f"{k + 1:02d}_{sc['nom']}.png")
        im.save(chemin)
        print(f"  {chemin}  (t = {t:.1f} s)")
        v = im.resize((360, 640), Image.LANCZOS)
        ImageDraw.Draw(v).text((10, 604), f"{sc['nom']}  {t:.1f} s", font=police(22), fill="yellow",
                               stroke_width=2, stroke_fill="black")
        vignettes.append(v)
    planche = Image.new("RGB", (3 * 360 + 40, 3 * 640 + 40), (30, 30, 30))
    for k, v in enumerate(vignettes):
        planche.paste(v, (10 + (k % 3) * 370, 10 + (k // 3) * 650))
    planche.save(os.path.join(dos, "planche.jpg"), quality=88)
    print(f"  {os.path.join(dos, 'planche.jpg')}")


def export(m, sortie):
    a = os.path.join(sortie, "lena_ep1.mp4")
    b = os.path.join(sortie, "lena_ep1_sans_perso.mp4")
    pa, pb = ffmpeg_sortie(a), ffmpeg_sortie(b)
    n = round(DUREE * FPS)
    for i in range(n):
        sans, avec = m.image(i / FPS, i)
        pa.stdin.write(avec.tobytes())
        pb.stdin.write(sans.tobytes())
        if i % FPS == 0:
            print(f"\r  {i / FPS:4.0f} / {DUREE:.0f} s", end="", flush=True)
    for p in (pa, pb):
        p.stdin.close()
        if p.wait():
            sys.exit("ffmpeg a échoué")
    print(f"\r  {a}\n  {b}")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--apercu", action="store_true", help="une capture par scène, sans export vidéo")
    ap.add_argument("--dossier", default=ICI, help="dossier qui contient images/ et video/ (par défaut : celui du script)")
    args = ap.parse_args()
    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg est introuvable : installe-le et ajoute-le au PATH.")
    sortie = os.path.join(args.dossier, "output")
    os.makedirs(sortie, exist_ok=True)
    print("Préparation des plans…")
    m = Montage(args.dossier)
    if args.apercu:
        apercus(m, sortie)
    else:
        export(m, sortie)


if __name__ == "__main__":
    main()
