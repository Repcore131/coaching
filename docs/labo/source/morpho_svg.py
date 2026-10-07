# Schémas morpho-anatomiques originaux RepCore (SVG calculés géométriquement)
import math

INK = '#141416'; RED = '#E02020'; GRY = '#B8B8C0'; LG = '#F2F2F4'

def _pt(p): return f'{p[0]:.1f},{p[1]:.1f}'

def limb(a, b, w, col=INK):
    return f'<line x1="{a[0]:.1f}" y1="{a[1]:.1f}" x2="{b[0]:.1f}" y2="{b[1]:.1f}" stroke="{col}" stroke-width="{w}" stroke-linecap="round"/>'

def arc(c, r, a0, a1, col=RED):
    # angles en degrés, 0 = vers la droite, sens horaire (repère SVG)
    x0, y0 = c[0] + r*math.cos(math.radians(a0)), c[1] + r*math.sin(math.radians(a0))
    x1, y1 = c[0] + r*math.cos(math.radians(a1)), c[1] + r*math.sin(math.radians(a1))
    large = 1 if abs(a1-a0) > 180 else 0
    sweep = 1 if a1 > a0 else 0
    return f'<path d="M{x0:.1f},{y0:.1f} A{r},{r} 0 {large} {sweep} {x1:.1f},{y1:.1f}" fill="none" stroke="{col}" stroke-width="3"/>'

def txt(x, y, s, size=15, col=INK, w=700, anchor='middle'):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-family="Montserrat" font-size="{size}" font-weight="{w}" fill="{col}" text-anchor="{anchor}">{s}</text>'

def squat_fig(ox, oy, tib, fem, torso, hl='fem', label=''):
    """Squat à la parallèle, vue de profil. Cheville en (ox,oy). La barre (épaules) reste au-dessus du milieu du pied.
    Retourne (svg, angle_buste_depuis_verticale)."""
    dorsi = 30  # flexion de cheville (degrés depuis la verticale)
    ankle = (ox, oy)
    knee = (ox + tib*math.sin(math.radians(dorsi)), oy - tib*math.cos(math.radians(dorsi)))
    hip = (knee[0] - fem, knee[1])  # cuisse parallèle au sol
    mid = ox + 10  # milieu du pied
    dx = mid - hip[0]
    dx = min(dx, torso*.98)
    lean = math.degrees(math.asin(dx/torso))  # inclinaison depuis la verticale
    sh = (hip[0] + torso*math.sin(math.radians(lean)), hip[1] - torso*math.cos(math.radians(lean)))
    head = (sh[0] - 6*math.sin(math.radians(lean)) + 4, sh[1] - 30)
    o = []
    o.append(f'<line x1="{ox-60}" y1="{oy+14}" x2="{ox+90}" y2="{oy+14}" stroke="{GRY}" stroke-width="2"/>')
    o.append(f'<line x1="{mid}" y1="{oy+14}" x2="{mid}" y2="{sh[1]-50}" stroke="{RED}" stroke-width="2" stroke-dasharray="6 6" opacity=".6"/>')
    o.append(limb((ox-14, oy+10), (ox+44, oy+10), 14))  # pied
    o.append(limb(ankle, knee, 22, RED if hl == 'tib' else INK))
    o.append(limb(knee, hip, 30, RED if hl == 'fem' else INK))
    o.append(limb(hip, sh, 40, RED if hl == 'torso' else INK))
    o.append(f'<circle cx="{head[0]:.1f}" cy="{head[1]:.1f}" r="19" fill="{INK}"/>')
    # barre
    o.append(f'<circle cx="{sh[0]:.1f}" cy="{sh[1]+4:.1f}" r="13" fill="#fff" stroke="{INK}" stroke-width="5"/>')
    # angle buste
    o.append(f'<line x1="{hip[0]:.1f}" y1="{hip[1]:.1f}" x2="{hip[0]:.1f}" y2="{hip[1]-95:.1f}" stroke="{GRY}" stroke-width="2" stroke-dasharray="4 4"/>')
    o.append(arc(hip, 62, -90, -90 + lean))
    o.append(txt(hip[0] - 28, hip[1] - 70, f'{lean:.0f}°', 20, RED, 800))
    if label:
        o.append(txt(ox + 10, oy + 46, label, 17, INK, 800))
    return ''.join(o), lean

def svg_squat():
    a, la = squat_fig(170, 290, 120, 105, 150, 'fem', 'Fémur court')
    b, lb = squat_fig(520, 290, 120, 160, 150, 'fem', 'Fémur long')
    return (f'<svg viewBox="0 0 700 380" width="100%"><rect width="700" height="380" rx="16" fill="{LG}"/>{a}{b}'
            + txt(180, 362, 'buste plutôt droit · quadriceps', 14, '#6B6B73', 600)
            + txt(530, 362, 'buste penché · fessiers + lombaires', 14, '#6B6B73', 600) + '</svg>'), (la, lb)

def bench_fig(ox, oy, cage, arm, fore, label, verdict, good):
    """Développé couché vu depuis les pieds : barre sur le torse, avant-bras verticaux.
    La profondeur du coude sous l'épaule = l'étirement des pectoraux."""
    o = []
    o.append(f'<rect x="{ox-120}" y="{oy}" width="240" height="14" rx="6" fill="{GRY}"/>')
    cy = oy - cage/2
    o.append(f'<ellipse cx="{ox}" cy="{cy}" rx="62" ry="{cage/2}" fill="{INK}"/>')
    bar_y = oy - cage - 10
    sy = cy - cage*.12
    ey = bar_y + fore
    dy = ey - sy
    dx = math.sqrt(max(arm**2 - dy**2, 0))
    for sgn in (-1, 1):
        sh = (ox + sgn*58, sy)
        el = (sh[0] + sgn*dx, ey)
        o.append(limb(sh, el, 20))
        o.append(limb(el, (el[0], bar_y), 16, RED))
    hx = ox + 58 + dx
    o.append(f'<line x1="{ox-hx+ox-30:.1f}" y1="{bar_y}" x2="{hx+30:.1f}" y2="{bar_y}" stroke="{INK}" stroke-width="8" stroke-linecap="round"/>')
    o.append(f'<line x1="{ox-150}" y1="{sy:.1f}" x2="{ox+150}" y2="{sy:.1f}" stroke="{GRY}" stroke-width="2" stroke-dasharray="5 5"/>')
    o.append(txt(ox + 150, sy - 6, 'épaules', 12, '#6B6B73', 600, 'end'))
    o.append(f'<line x1="{hx+44:.1f}" y1="{sy:.1f}" x2="{hx+44:.1f}" y2="{ey:.1f}" stroke="{RED}" stroke-width="3"/>')
    o.append(txt(ox, oy + 46, label, 17, INK, 800))
    o.append(txt(ox, oy + 70, verdict, 14, '#1F8A4C' if good else RED, 700))
    return ''.join(o)

def svg_bench():
    return (f'<svg viewBox="0 0 700 330" width="100%"><rect width="700" height="330" rx="16" fill="{LG}"/>'
            + bench_fig(180, 215, 62, 92, 92, 'Cage fine · bras longs', 'coudes très bas : épaules exposées', False) + bench_fig(495, 215, 130, 72, 76, 'Cage épaisse · bras courts', 'coudes hauts : peu d’étirement', False)
            + '</svg>')

def pull_fig(ox, oy, hum, fore, label, ok):
    o = []
    o.append(f'<line x1="{ox-110}" y1="{oy}" x2="{ox+110}" y2="{oy}" stroke="{INK}" stroke-width="9" stroke-linecap="round"/>')
    hands = [(ox-55, oy), (ox+55, oy)]
    # menton visé : position haute avec angle de coude ~ 40°
    sh_y = oy + fore*.55 + hum*.35
    shs = [(ox-42, sh_y), (ox+42, sh_y)]
    for h, s in zip(hands, shs):
        el = ((h[0]+s[0])/2 + (-30 if h[0] < ox else 30), (h[1]+s[1])/2 + 6)
        o.append(limb(s, el, 20, RED))
        o.append(limb(el, h, 16))
    o.append(f'<rect x="{ox-44}" y="{sh_y-6}" width="88" height="110" rx="20" fill="{INK}"/>')
    chin = sh_y - 22
    o.append(f'<circle cx="{ox}" cy="{chin-14}" r="20" fill="{INK}"/>')
    o.append(f'<line x1="{ox-80}" y1="{chin}" x2="{ox+80}" y2="{chin}" stroke="{RED}" stroke-width="2" stroke-dasharray="5 5"/>')
    o.append(txt(ox, oy + 210, label, 17, INK, 800))
    o.append(txt(ox, oy + 234, 'menton au-dessus : facile' if ok else 'menton sous la barre : normal', 14, '#1F8A4C' if ok else RED, 700))
    return ''.join(o)

def svg_pull():
    return (f'<svg viewBox="0 0 700 300" width="100%"><rect width="700" height="300" rx="16" fill="{LG}"/>'
            + pull_fig(190, 40, 70, 70, 'Humérus long + mobile', True) + pull_fig(510, 40, 120, 95, 'Humérus court + raide', False) + '</svg>')

def svg_segments():
    """Silhouette de face avec les mesures à saisir (repères anatomiques)."""
    o = [f'<svg viewBox="0 0 700 560" width="100%"><rect width="700" height="560" rx="16" fill="{LG}"/>']
    cx = 205
    # corps simplifié
    o.append(f'<circle cx="{cx}" cy="70" r="30" fill="{INK}"/>')
    o.append(f'<path d="M{cx-70},120 L{cx+70},120 L{cx+50},290 L{cx-50},290 Z" fill="{INK}"/>')
    for s in (-1, 1):
        o.append(limb((cx+s*70, 128), (cx+s*92, 220), 24))
        o.append(limb((cx+s*92, 220), (cx+s*104, 305), 19))
        o.append(limb((cx+s*28, 300), (cx+s*36, 420), 32))
        o.append(limb((cx+s*36, 420), (cx+s*38, 520), 24))
    def meas(x1, y1, x2, y2, lab, tx, ty, anchor='start', col=RED):
        return (f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="3"/>'
                f'<circle cx="{x1}" cy="{y1}" r="5" fill="{col}"/><circle cx="{x2}" cy="{y2}" r="5" fill="{col}"/>'
                + txt(tx, ty, lab, 15, INK, 700, anchor))
    o.append(meas(cx-70, 112, cx+70, 112, 'A · Clavicules (acromions)', 360, 112))
    o.append(meas(cx-50, 298, cx+50, 298, 'B · Bassin (crêtes iliaques)', 360, 312))
    o.append(meas(cx+108, 128, cx+130, 220, 'C · Bras (acromion → coude)', 360, 175))
    o.append(meas(cx+130, 222, cx+142, 305, 'D · Avant-bras (coude → poignet)', 360, 248))
    o.append(meas(cx+70, 300, cx+78, 420, 'E · Fémur (trochanter → genou)', 360, 360))
    o.append(meas(cx+78, 422, cx+80, 520, 'F · Tibia (genou → malléole)', 360, 470))
    o.append(meas(cx-110, 112, cx-110, 298, 'G · Buste', cx-122, 210, 'end'))
    o.append(txt(360, 520, 'Ratios calculés : E/G · E/F · C/D · A/B', 15, RED, 800, 'start'))
    o.append('</svg>')
    return ''.join(o)

def svg_deadlift():
    o = [f'<svg viewBox="0 0 700 320" width="100%"><rect width="700" height="320" rx="16" fill="{LG}"/>']
    for ox, arm, lab in ((190, 150, 'Bras longs : hanches hautes, dos plus droit'), (510, 110, 'Bras courts : hanches basses, buste penché')):
        oy = 250
        bar = (ox + 20, oy - 10)
        sh = (bar[0] - 10, bar[1] - arm)
        tib, fem, torso = 95, 105, 135
        knee = (ox + 40, oy - tib)
        # hanche : à distance torso de l'épaule et fem du genou (intersection, côté gauche)
        d = math.dist(sh, knee); a = (torso**2 - fem**2 + d**2)/(2*d); h = math.sqrt(max(torso**2 - a**2, 0))
        px = sh[0] + a*(knee[0]-sh[0])/d; py = sh[1] + a*(knee[1]-sh[1])/d
        c1 = (px - h*(knee[1]-sh[1])/d, py + h*(knee[0]-sh[0])/d)
        c2 = (px + h*(knee[1]-sh[1])/d, py - h*(knee[0]-sh[0])/d)
        hip = min((c1, c2), key=lambda c: c[0])
        o.append(f'<line x1="{ox-80}" y1="{oy+12}" x2="{ox+110}" y2="{oy+12}" stroke="{GRY}" stroke-width="2"/>')
        o.append(limb((ox+10, oy), knee, 22)); o.append(limb(knee, hip, 30)); o.append(limb(hip, sh, 40)); o.append(limb(sh, bar, 18, RED))
        o.append(f'<circle cx="{sh[0]+26:.1f}" cy="{sh[1]-14:.1f}" r="18" fill="{INK}"/>')
        o.append(f'<circle cx="{bar[0]}" cy="{bar[1]}" r="34" fill="none" stroke="{INK}" stroke-width="8"/>')
        lean = math.degrees(math.atan2(sh[0]-hip[0], hip[1]-sh[1]))
        o.append(txt(ox, 300, lab, 14, INK, 700))
        o.append(txt(hip[0]-34, hip[1]+6, f'buste {90-abs(lean):.0f}°', 15, RED, 800, 'end'))
    o.append('</svg>')
    return ''.join(o)

def svg_camera():
    """Test vidéo : l'app mesure l'angle du buste au point bas."""
    o = [f'<svg viewBox="0 0 700 330" width="100%"><rect width="700" height="330" rx="16" fill="#0B0B0C"/>']
    o.append('<rect x="40" y="40" width="380" height="250" rx="18" fill="#1C1C20" stroke="#3A3A40" stroke-width="3"/>')
    pts = {'cheville': (200, 250), 'genou': (250, 180), 'hanche': (150, 180), 'epaule': (205, 85), 'tete': (220, 60)}
    for a, b in (('cheville', 'genou'), ('genou', 'hanche'), ('hanche', 'epaule')):
        o.append(limb(pts[a], pts[b], 5, '#fff'))
    for k, p in pts.items():
        if k != 'tete':
            o.append(f'<circle cx="{p[0]}" cy="{p[1]}" r="9" fill="{RED}" stroke="#fff" stroke-width="3"/>')
    o.append(f'<line x1="150" y1="180" x2="150" y2="80" stroke="#fff" stroke-width="2" stroke-dasharray="5 5" opacity=".6"/>')
    lean = math.degrees(math.atan2(205-150, 180-85))
    o.append(arc((150, 180), 50, -90, -90+lean))
    o.append(txt(130, 120, f'{lean:.0f}°', 18, RED, 800))
    o.append(txt(450, 90, 'Buste au point bas', 18, '#fff', 800, 'start'))
    o.append(txt(460, 120, '≤ 45° : squat classique OK', 15, '#7CD992', 700, 'start'))
    o.append(txt(460, 146, '> 45° : proposer front squat,', 15, '#FF8A8A', 700, 'start'))
    o.append(txt(460, 168, 'hack, belt squat, presse', 15, '#FF8A8A', 700, 'start'))
    o.append(txt(460, 210, 'Points MediaPipe utilisés :', 14, '#A0A0A8', 600, 'start'))
    o.append(txt(460, 232, 'épaule 12 · hanche 24', 14, '#A0A0A8', 600, 'start'))
    o.append(txt(460, 254, 'genou 26 · cheville 28', 14, '#A0A0A8', 600, 'start'))
    o.append('</svg>')
    return ''.join(o)

if __name__ == '__main__':
    import os
    os.makedirs('morpho', exist_ok=True)
    s, l = svg_squat(); print('squat lean', l)
    for n, c in (('squat', s), ('bench', svg_bench()), ('pull', svg_pull()), ('segments', svg_segments()), ('deadlift', svg_deadlift()), ('camera', svg_camera())):
        open(f'morpho/{n}.svg', 'w').write(c.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1))

def svg_joints():
    """Valgus du coude (aligné / valgus) et genoux (valgum / varum), vue de face."""
    o = [f'<svg viewBox="0 0 700 330" width="100%"><rect width="700" height="330" rx="16" fill="{LG}"/>']
    # bras alignés / valgus
    for ox, ang, lab, ok in ((90, 0, 'Coude aligné', True), (230, 22, 'Valgus du coude', False)):
        sh = (ox, 50); el = (ox + 4, 150)
        hand = (el[0] + 110*math.sin(math.radians(ang)), el[1] + 110*math.cos(math.radians(ang)))
        o.append(limb(sh, el, 24)); o.append(limb(el, hand, 19, INK if ok else RED))
        o.append(f'<line x1="{sh[0]}" y1="{sh[1]-10}" x2="{sh[0]+6}" y2="{hand[1]+14:.0f}" stroke="{RED}" stroke-width="2" stroke-dasharray="5 5"/>')
        o.append(txt(ox + 20, 300, lab, 15, INK, 800))
    o.append(txt(160, 322, 'valgus marqué : barre EZ ou haltères', 13, RED, 700))
    # genoux
    for ox, kind, lab in ((440, 'x', 'Valgum (en X)'), (600, 'o', 'Varum (en O)')):
        dk = -18 if kind == 'x' else 18
        for s in (-1, 1):
            hip = (ox + s*30, 60); knee = (ox + s*(30 + dk), 165); ank = (ox + s*30, 270)
            o.append(limb(hip, knee, 26, RED)); o.append(limb(knee, ank, 22))
        o.append(txt(ox, 300, lab, 15, INK, 800))
    o.append(txt(520, 322, 'valgum : éviter les pieds parallèles', 13, RED, 700))
    o.append('</svg>')
    return ''.join(o)

def svg_tree():
    """Arbre de compétences tractions."""
    nodes = ['Dead hang', 'Scapulaires', 'Australiennes', 'Isométries ×3', 'Excentriques 5 s', 'Assistées', 'Traction propre', 'Lestée', 'Traction haute', 'Muscle-up']
    o = [f'<svg viewBox="0 0 700 300" width="100%"><rect width="700" height="300" rx="16" fill="#0B0B0C"/>']
    pos = []
    for i, n in enumerate(nodes):
        row = i // 5; col = i % 5 if row == 0 else 4 - (i % 5)
        pos.append((80 + col*135, 85 + row*130))
    for a, b in zip(pos, pos[1:]):
        o.append(f'<line x1="{a[0]}" y1="{a[1]}" x2="{b[0]}" y2="{b[1]}" stroke="#3A3A40" stroke-width="5"/>')
    for i, (p, n) in enumerate(zip(pos, nodes)):
        done = i < 6
        o.append(f'<circle cx="{p[0]}" cy="{p[1]}" r="28" fill="{RED if done else "#1C1C20"}" stroke="{RED}" stroke-width="3"/>')
        o.append(txt(p[0], p[1] + 7, str(i + 1), 20, '#fff', 800))
        o.append(txt(p[0], p[1] + 52, n, 13, '#fff', 700))
    o.append('</svg>')
    return ''.join(o)

if __name__ == '__main__':
    open('morpho/joints.svg', 'w').write(svg_joints().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1))
    open('morpho/tree.svg', 'w').write(svg_tree().replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ', 1))
