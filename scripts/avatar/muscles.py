# -*- coding: utf-8 -*-
"""Le dessin des muscles, un gabarit par vue.

Un point vaut (y, segment, t) :
  y   ligne de l'image, LUE SUR LA PLANCHE MASCULINE de reference (n4-h /
      n4-h-dos) ; elle est reportee sur l'echelle anatomique de la famille,
      ce qui suffit a passer du corps masculin au feminin — epaules plus
      basses, entrejambe plus bas, meme decoupage.
  seg 'TO' torse, 'AL'/'AR' bras (0 = dehors, 1 = dedans), 'JL'/'JR' jambes.
      t peut sortir de [0,1] : la forme deborde alors sur le segment voisin,
      ce qui est voulu la ou le muscle chevauche la limite (le trapeze monte
      sur l'epaule). Le masque de la vignette rattrape le reste.
  mir  la forme est dessinee a gauche et refletee a droite.

Les valeurs t sont relevees sur les planches de reference. Le passage d'un
niveau a l'autre est automatique : t est une fraction du membre, pas une
distance — un biceps a t=0.5 est au milieu du bras, fin ou epais.
"""

# Reperes des planches d'auteur (masculines) : epaule, entrejambe, genou, cheville, bas
REF = {'face': (57, 180, 248, 306, 340), 'dos': (56, 178, 248, 306, 340)}


def _v(vue, y):
    """Ligne de la planche de reference -> echelle anatomique 0..5."""
    L = (0,) + REF[vue]
    for i in range(5):
        if y <= L[i + 1] or i == 4:
            return i + (y - L[i]) / float(L[i + 1] - L[i])
    return 5.0


def F(pts):
    return [(_v('face', y), s, t) for (y, s, t) in pts]


def D(pts):
    return [(_v('dos', y), s, t) for (y, s, t) in pts]


# -- VUE DE FACE -------------------------------------------------------------
FACE = {
 'TRAPEZES': dict(mir=True, pts=F([
   (54, 'TO', 0.25), (57, 'TO', 0.08), (62, 'TO', -0.11), (68, 'TO', -0.31),
   (73, 'TO', -0.19), (69, 'TO', -0.02), (64, 'TO', 0.12), (59, 'TO', 0.27)])),
 'DELT_LAT': dict(mir=True, pts=F([
   (62, 'AL', 0.62), (59, 'AL', 0.40), (60, 'AL', 0.16), (68, 'AL', 0.02),
   (78, 'AL', 0.02), (86, 'AL', 0.12), (89, 'AL', 0.34), (86, 'AL', 0.55),
   (76, 'AL', 0.62), (68, 'AL', 0.64)])),
 'DELT_ANT': dict(mir=True, pts=F([
   (61, 'AL', 0.98), (60, 'AL', 0.66), (66, 'AL', 0.50), (76, 'AL', 0.46),
   (85, 'AL', 0.52), (92, 'AL', 0.70), (93, 'AL', 0.92), (86, 'AL', 1.02),
   (72, 'AL', 1.03)])),
 'PECTORAUX': dict(mir=True, pts=F([
   (63, 'TO', 0.44), (66, 'TO', 0.26), (70, 'TO', 0.08), (74, 'TO', -0.06),
   (83, 'TO', -0.07), (92, 'TO', -0.02), (98, 'TO', 0.09), (100, 'TO', 0.26),
   (99, 'TO', 0.40), (95, 'TO', 0.46), (80, 'TO', 0.47), (69, 'TO', 0.46)])),
 'ABDOS': dict(mir=False, pts=F([
   (99, 'TO', 0.23), (99, 'TO', 0.50), (99, 'TO', 0.77), (112, 'TO', 0.81),
   (126, 'TO', 0.79), (138, 'TO', 0.72), (146, 'TO', 0.61), (149, 'TO', 0.50),
   (146, 'TO', 0.39), (138, 'TO', 0.28), (126, 'TO', 0.21), (112, 'TO', 0.19)])),
 'DORSAUX': dict(mir=True, pts=F([
   (100, 'TO', 0.03), (105, 'TO', -0.02), (118, 'TO', 0.00), (132, 'TO', 0.06),
   (143, 'TO', 0.13), (141, 'TO', 0.21), (127, 'TO', 0.17), (113, 'TO', 0.13),
   (103, 'TO', 0.11)])),
 'BICEPS': dict(mir=True, pts=F([
   (90, 'AL', 0.98), (89, 'AL', 0.70), (99, 'AL', 0.55), (112, 'AL', 0.49),
   (126, 'AL', 0.52), (136, 'AL', 0.64), (140, 'AL', 0.82), (136, 'AL', 1.00),
   (118, 'AL', 1.02), (102, 'AL', 1.02)])),
 'TRICEPS': dict(mir=True, pts=F([
   (86, 'AL', 0.30), (88, 'AL', 0.10), (98, 'AL', 0.00), (112, 'AL', -0.01),
   (126, 'AL', 0.04), (136, 'AL', 0.16), (138, 'AL', 0.36), (128, 'AL', 0.42),
   (112, 'AL', 0.38), (98, 'AL', 0.34)])),
 'AVANT_BRAS': dict(mir=True, pts=F([
   (141, 'AL', 0.06), (141, 'AL', 0.94), (158, 'AL', 0.98), (175, 'AL', 0.95),
   (188, 'AL', 0.80), (192, 'AL', 0.50), (188, 'AL', 0.20), (172, 'AL', 0.06),
   (156, 'AL', 0.02)])),
 'QUADRICEPS': dict(mir=True, pts=F([
   (163, 'JL', 0.30), (163, 'JL', 0.72), (175, 'JL', 0.80), (195, 'JL', 0.82),
   (215, 'JL', 0.80), (232, 'JL', 0.74), (244, 'JL', 0.62), (246, 'JL', 0.44),
   (238, 'JL', 0.26), (220, 'JL', 0.16), (200, 'JL', 0.12), (182, 'JL', 0.14),
   (170, 'JL', 0.20)])),
 'ADDUCTEURS': dict(mir=True, pts=F([
   (186, 'JL', 0.64), (187, 'JL', 0.99), (204, 'JL', 1.00), (222, 'JL', 0.99),
   (238, 'JL', 0.96), (244, 'JL', 0.82), (236, 'JL', 0.68), (216, 'JL', 0.64),
   (200, 'JL', 0.63)])),
 'ABDUCTEURS': dict(mir=True, pts=F([
   (152, 'JL', 0.08), (152, 'JL', 0.32), (162, 'JL', 0.28), (174, 'JL', 0.20),
   (186, 'JL', 0.13), (196, 'JL', 0.07), (199, 'JL', -0.01), (186, 'JL', -0.02),
   (170, 'JL', 0.00), (158, 'JL', 0.02)])),
 'MOLLETS': dict(mir=True, pts=F([
   (252, 'JL', 0.20), (252, 'JL', 0.78), (262, 'JL', 0.92), (275, 'JL', 0.96),
   (288, 'JL', 0.88), (300, 'JL', 0.72), (306, 'JL', 0.52), (300, 'JL', 0.32),
   (288, 'JL', 0.16), (272, 'JL', 0.06), (260, 'JL', 0.08)])),
}

# -- VUE DE DOS --------------------------------------------------------------
DOS = {
 'TRAPEZES': dict(mir=False, pts=D([
   (49, 'TO', 0.38), (49, 'TO', 0.62), (57, 'TO', 0.86), (63, 'TO', 1.10),
   (69, 'TO', 1.24), (75, 'TO', 1.02), (84, 'TO', 0.80), (100, 'TO', 0.67),
   (114, 'TO', 0.57), (121, 'TO', 0.50), (114, 'TO', 0.43), (100, 'TO', 0.33),
   (84, 'TO', 0.20), (75, 'TO', -0.02), (69, 'TO', -0.24), (63, 'TO', -0.10),
   (57, 'TO', 0.14)])),
 'DELT_POST': dict(mir=True, pts=D([
   (60, 'AL', 0.85), (58, 'AL', 0.55), (60, 'AL', 0.24), (68, 'AL', 0.05),
   (79, 'AL', 0.04), (88, 'AL', 0.16), (92, 'AL', 0.42), (90, 'AL', 0.72),
   (82, 'AL', 0.90), (70, 'AL', 0.94)])),
 'DELT_LAT': dict(mir=True, pts=D([
   (60, 'AL', 0.42), (60, 'AL', 0.16), (68, 'AL', 0.02), (78, 'AL', 0.00),
   (86, 'AL', 0.08), (89, 'AL', 0.28), (84, 'AL', 0.44), (72, 'AL', 0.48)])),
 'DORSAUX': dict(mir=True, pts=D([
   (80, 'TO', 0.26), (82, 'TO', 0.04), (88, 'TO', -0.06), (100, 'TO', -0.06),
   (114, 'TO', 0.03), (130, 'TO', 0.16), (143, 'TO', 0.33), (147, 'TO', 0.45),
   (139, 'TO', 0.46), (124, 'TO', 0.42), (106, 'TO', 0.38), (92, 'TO', 0.34)])),
 'LOMBAIRES': dict(mir=False, pts=D([
   (122, 'TO', 0.28), (120, 'TO', 0.50), (122, 'TO', 0.72), (132, 'TO', 0.78),
   (143, 'TO', 0.76), (151, 'TO', 0.66), (153, 'TO', 0.50), (151, 'TO', 0.34),
   (143, 'TO', 0.24), (132, 'TO', 0.22)])),
 'TRICEPS': dict(mir=True, pts=D([
   (88, 'AL', 0.95), (86, 'AL', 0.55), (94, 'AL', 0.32), (108, 'AL', 0.24),
   (122, 'AL', 0.28), (134, 'AL', 0.44), (139, 'AL', 0.72), (136, 'AL', 0.98),
   (118, 'AL', 1.02), (100, 'AL', 1.02)])),
 'BICEPS': dict(mir=True, pts=D([
   (88, 'AL', 0.28), (90, 'AL', 0.06), (104, 'AL', 0.00), (120, 'AL', 0.04),
   (132, 'AL', 0.16), (136, 'AL', 0.32), (126, 'AL', 0.34), (110, 'AL', 0.30),
   (96, 'AL', 0.30)])),
 'AVANT_BRAS': dict(mir=True, pts=D([
   (141, 'AL', 0.06), (141, 'AL', 0.94), (158, 'AL', 0.98), (175, 'AL', 0.95),
   (188, 'AL', 0.80), (192, 'AL', 0.50), (188, 'AL', 0.20), (172, 'AL', 0.06),
   (156, 'AL', 0.02)])),
 'FESSIERS': dict(mir=True, pts=D([
   (150, 'JL', 0.02), (144, 'JL', 0.30), (139, 'JL', 0.60), (140, 'JL', 0.90),
   (150, 'JL', 1.00), (166, 'JL', 1.00), (180, 'JL', 0.94), (188, 'JL', 0.74),
   (190, 'JL', 0.48), (186, 'JL', 0.24), (174, 'JL', 0.08), (160, 'JL', 0.00)])),
 'ISCHIOS': dict(mir=True, pts=D([
   (191, 'JL', 0.16), (191, 'JL', 0.84), (204, 'JL', 0.92), (220, 'JL', 0.93),
   (234, 'JL', 0.92), (243, 'JL', 0.86), (245, 'JL', 0.50), (243, 'JL', 0.14),
   (232, 'JL', 0.08), (216, 'JL', 0.07), (202, 'JL', 0.09)])),
 'ADDUCTEURS': dict(mir=True, pts=D([
   (186, 'JL', 0.64), (187, 'JL', 0.99), (204, 'JL', 1.00), (222, 'JL', 0.99),
   (238, 'JL', 0.96), (244, 'JL', 0.82), (236, 'JL', 0.68), (216, 'JL', 0.64),
   (200, 'JL', 0.63)])),
 'ABDUCTEURS': dict(mir=True, pts=D([
   (150, 'JL', 0.10), (150, 'JL', 0.30), (162, 'JL', 0.24), (176, 'JL', 0.16),
   (190, 'JL', 0.10), (200, 'JL', 0.04), (202, 'JL', -0.02), (186, 'JL', 0.00),
   (168, 'JL', 0.02), (155, 'JL', 0.04)])),
 'MOLLETS': dict(mir=True, pts=D([
   (252, 'JL', 0.20), (252, 'JL', 0.78), (262, 'JL', 0.92), (275, 'JL', 0.96),
   (288, 'JL', 0.88), (300, 'JL', 0.72), (306, 'JL', 0.52), (300, 'JL', 0.32),
   (288, 'JL', 0.16), (272, 'JL', 0.06), (260, 'JL', 0.08)])),
}

VUE = {'face': FACE, 'dos': DOS}
MIROIR = {'AL': 'AR', 'AR': 'AL', 'JL': 'JR', 'JR': 'JL', 'TO': 'TO'}
