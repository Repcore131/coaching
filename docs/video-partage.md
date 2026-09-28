# La vidéo d’un visuel : test manuel

Ce que la suite automatique ne peut pas prouver : qu’un vrai téléphone
enregistre la vidéo, qu’il la partage, et qu’Instagram la publie. À refaire
à chaque modification de `exporterVideoVisuel`, des scènes (`videoScene`) ou
de l’écran vidéo, et à chaque nouvelle version majeure d’iOS.

Ce qui est déjà vérifié par `app/tests.js` (bloc « Vidéo : ») : le choix du
type (MP4 puis WebM VP9), le débit (≤ 4 Mbit/s, jamais plus de 8 Mo), les
durées, le dessin de chaque image avec des données extrêmes, la bascule
absente sans MediaRecorder, l’écran (progression, aperçu, boutons) et un
vrai enregistrement dans Chromium.

## Préparer

- Un compte de test avec au moins **deux séances** sur un exercice, la
  seconde plus lourde (un record), et assez de volts pour un **nouveau rang**
  (ou un rang forcé depuis la console : `_rangEcran(3)`).
- Pour Wrapped : un mois terminé avec des séances (`ouvrirWrapped()`).
- Son **activé** sur le téléphone : la vidéo est muette, on vérifie juste
  qu’Instagram ne s’en plaint pas.

## Durées attendues

| Scène  | Animation | Fin figée | Total  | Poids attendu (4 Mbit/s) |
|--------|-----------|-----------|--------|--------------------------|
| Record | 2,6 s     | 1 s       | 3,6 s  | ~1,8 Mo                  |
| Rang   | 2,7 s     | 1 s       | 3,7 s  | ~1,9 Mo                  |
| Wrapped| 5 × 1,5 s | 1 s       | 8,5 s  | ~4,3 Mo                  |

Le poids s’affiche sous l’aperçu. Au-dessus de 8 Mo, l’écran le signale :
c’est un défaut à remonter.

## 1. iPhone, app installée (écran d’accueil), iOS 15 ou plus

MediaRecorder n’existe qu’à partir d’iOS 14.5 ; le partage de fichiers
vidéo, à partir d’iOS 15.

1. Ouvrir RepCore **depuis l’icône** (pas depuis Safari).
2. Fin de séance avec record → bloc « Mes records » : la bascule
   **Image / Vidéo** est visible. Choisir **Vidéo**.
3. Toucher **Partager ce record**. Attendu : la feuille « Ta vidéo se
   prépare… », la barre qui avance pendant ~3,6 s, **Annuler** qui ferme
   tout.
4. Une fois prête : l’aperçu joue en boucle, sans son, **dans** la page (pas
   en plein écran). Sous l’aperçu : « … Mo · MP4 ».
5. **Partager la vidéo** → la feuille iOS s’ouvre avec la vidéo. Vérifier :
   - « Enregistrer la vidéo » la met dans Photos, lisible ;
   - le toast « Lien copié » apparaît (sticker Lien).
6. **Télécharger** → Safari propose le fichier (Fichiers) ; il se lit.
7. Refaire 2–6 pour le **rang** (écran « Nouveau rang ») et pour **Wrapped**
   (dernière slide, « Partager mon résumé »).
8. Revenir à **Image** : le partage redevient une image, comme avant.

À regarder dans la vidéo : la foudre frappe **le chiffre** (record), **l’emblème**
(rang), **le nom du profil** (Wrapped) ; le chiffre compte depuis l’ancienne
valeur et finit sur la vraie ; la dernière seconde est **immobile**.

## 2. Android (Chrome à jour), app installée

1. Mêmes étapes 2–8 qu’iPhone.
2. Sous l’aperçu : « … Mo · WEBM » (Chrome n’écrit pas le MP4 sur toutes les
   versions : c’est attendu).
3. **Partager la vidéo** → la feuille Android ; « Instagram » doit y figurer.
4. **Télécharger** → le fichier arrive dans Téléchargements et se lit dans la
   galerie.

## 3. Publier en story

Sur chaque téléphone, avec la vidéo du record puis celle de Wrapped :

1. **Partager la vidéo** → **Instagram** → **Story**.
2. La vidéo occupe tout l’écran (9:16), rien n’est rogné : ni la signature
   en bas, ni l’en-tête en haut.
3. Ajouter le **sticker Lien** → coller : le lien copié par RepCore.
4. Publier, puis revoir la story : l’animation joue, la fin figée tient.

Si Instagram n’apparaît pas dans la feuille : **Télécharger**, puis depuis
Instagram, choisir la vidéo dans la galerie.

## 4. Publier en Reel

1. Depuis Instagram → **+** → **Reel** → choisir la vidéo téléchargée (ou
   partagée vers Instagram → Reel quand le téléphone le propose).
2. Vérifier : durée affichée (3,6 s / 8,5 s), pas de bandes noires, lecture
   fluide.
3. En légende : coller la légende (« Voir la légende » l’affiche ; elle part
   aussi dans le texte du partage quand le téléphone l’accepte).
4. Publier en brouillon ou sur un compte de test, puis supprimer.

## 5. Navigateur sans MediaRecorder

Sur un iPhone en iOS 14.4 ou moins (ou en forçant
`window.MediaRecorder=undefined` dans la console) : la bascule **Image /
Vidéo** n’apparaît **pas** ; les boutons de partage donnent l’image, comme
avant.

## Compte rendu

Noter, pour chaque téléphone : modèle, version d’OS, type (MP4/WEBM), poids
affiché, story OK / Reel OK, et toute image sautée ou déformée.
