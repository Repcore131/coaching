# L'histoire de Léna – épisode 1

Reel TikTok vertical (1080×1920, 30 fps, H.264, sans son), monté par `build.py`.

## Préparer

1. Installer ffmpeg (et l'avoir dans le PATH), puis : `pip install Pillow numpy`
2. Déposer les photos dans `images/` : `01_bar.jpg`, `02_resto.jpg`, `03_fastfood.jpg`,
   `04_piscine.jpg`, `05_epaules.jpg`, `06_banc.jpg`, `07_hipthrust.jpg`, `08_miroir_abdos.jpg`.
3. Facultatif : `video/09_final.mp4` (l'image 08 animée, 5 s, 9:16). Sans elle, la scène
   finale est l'image 08 avec un zoom lent de 5 s.

## Lancer

    python build.py --apercu    # une capture par scène + planche : output/apercus/
    python build.py             # output/lena_ep1.mp4 et output/lena_ep1_sans_perso.mp4

La description à coller sur TikTok est dans `output/description_tiktok.txt`.

## Réglages

En haut de `build.py` : le storyboard (`SCENES` : minutages, textes), la hauteur des
textes (`TEXTE_Y`) et la zone sûre TikTok. Les coupes 05 → 07 → 06 durent 1,5 s chacune
et commencent par un recul rapide, pour caler sur le drop du son ajouté dans TikTok.

Polices : Montserrat Bold ; emoji 😂 tiré de Noto Color Emoji (licence OFL, `assets/`).
