#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LES RAYONS SUR UNE ECHELLE, LES OMBRES SUR TROIS ELEVATIONS (01/10/2026),
sur le modele de scripts/espacements.py.

L'ECHELLE DES RAYONS (le :root d'app/rc-style.<build>.css) :
  --r-1   4px   pastilles, badges
  --r-2   8px   champs, petits boutons
  --r-3  12px   cartes, boutons
  --r-4  18px   feuilles modales
  --r-full      cercles (50 %)
Chaque border-radius ecrit en px est cale : 1-5 px -> --r-1, 6-9 -> --r-2,
10-15 -> --r-3, 16-24 -> --r-4 ; 50 % et 99 px ou plus (l'ancienne pilule)
-> --r-full. 0 reste 0. Une valeur COMPOSEE de plusieurs coins n'est calee que
si tous ses coins sont egaux ; asymetrique (« 12px 12px 0 0 »), elle n'est pas
touchee : le rapport la liste. Les valeurs relatives (24 %, 1.8cqw,
calc(… * var(--u)), celles des visuels mis a l'echelle) restent, et sont
listees. Les anciens alias deviennent l'echelle : --r-sm -> --r-2, --r-lg,
--r-md et --r-card -> --r-3, --r-pill -> --r-1 (leurs declarations sont retirees
de :root : un seul nom par rayon).

LES ELEVATIONS : une seule famille, --e0..--e3, plus --e-inset et --glow-red.
Les anciennes (--elev-0..3, --el-1/2, --e4, --e-flottant) sont rabattues sur la
plus proche : --elev-1 -> --e1 ; --elev-2, --el-1 -> --e2 ; --elev-3, --el-2,
--e4, --e-flottant -> --e3.

LES OMBRES : une ombre noire SIMPLE ecrite en dur (« 0 Npx Mpx rgba(0,0,0,a) »)
est calee sur une elevation selon son flou M : M <= 3 px -> var(--e1),
M <= 10 px -> var(--e2), au-dela -> var(--e3). Les ombres composees, colorees
ou en retrait sont listees, pas touchees.

CE QUI EST LU : app/rc-style.<build>.css (hors :root, qui DEFINIT l'echelle),
les morceaux src/core/NNN-*.js (puis rc-core est reassemble) et app/index.html,
hors commentaires et hors documents autonomes (exports A4 en srcdoc : ils n'ont
pas la feuille, un var(--r-3) n'y vaudrait rien). Le bloc clair genere vit dans
rc-theme : il n'est pas lu. Relancer scripts/theme_clair.py ensuite.

Usage : python3 scripts/rayons.py              applique
        python3 scripts/rayons.py --rapport    liste sans rien changer
        python3 scripts/rayons.py --verifier   sort en 1 s'il reste un rayon en px
                                               calable ou une ombre noire simple en dur
"""
import collections, glob, os, re, subprocess, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RACINE, 'scripts'))
import couleurs as C  # masque_commentaires, zones_js, fichiers

RE_RAYON = re.compile(r'(?<![\w-])(border(?:-(?:top|bottom|start|end)-(?:left|right|start|end))?-radius)(\s*:\s*)([^;"\'`<>{}]*)')
RE_OMBRE = re.compile(r'(?<![\w-])(box-shadow)(\s*:\s*)([^;"\'`<>{}]*)')
RE_ALIAS = re.compile(r'var\(--r-(sm|lg|md|card|pill)\)')
ALIAS = {'sm': 'var(--r-2)', 'lg': 'var(--r-3)', 'md': 'var(--r-3)', 'card': 'var(--r-3)', 'pill': 'var(--r-1)'}
# LES ANCIENNES FAMILLES D'ELEVATION, rabattues sur --e0..--e3 (01/10/2026) :
# --elev-* (module nutrition), --el-* (cartes athlete), --e4 et --e-flottant.
RE_ELEV = re.compile(r'var\(--(elev-[0-3]|el-[12]|e4|e-flottant)\)')
ELEV = {'elev-0': 'var(--e0)', 'elev-1': 'var(--e1)', 'elev-2': 'var(--e2)', 'el-1': 'var(--e2)',
        'elev-3': 'var(--e3)', 'el-2': 'var(--e3)', 'e4': 'var(--e3)', 'e-flottant': 'var(--e3)'}
RE_PX = re.compile(r'^(\d+(?:\.\d+)?)px$')
SIMPLE = re.compile(r'^0(?:px)?\s+(\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)$')


def jeton(v):
    """Le jeton d'un rayon en px, ou None s'il est hors des plages."""
    if v == 0:
        return '0'
    if v <= 5:
        return 'var(--r-1)'
    if v <= 9:
        return 'var(--r-2)'
    if v <= 15:
        return 'var(--r-3)'
    if v <= 24:
        return 'var(--r-4)'
    if v >= 99:
        return 'var(--r-full)'
    return None


def parts(valeur):
    """Les coins d'une valeur, au premier niveau (var(), calc() entiers)."""
    out, cur, prof = [], '', 0
    for ch in valeur:
        if ch == '(':
            prof += 1
        elif ch == ')':
            prof -= 1
        if ch.isspace() and prof == 0:
            if cur:
                out.append(cur)
            cur = ''
        else:
            cur += ch
    if cur:
        out.append(cur)
    return out


def caler_rayon(val, notes):
    """(nouvelle valeur ou None). notes : liste ou l'on range ce qu'on laisse."""
    imp = ''
    v = val.strip()
    if v.endswith('!important'):
        imp, v = '!important', v[:-len('!important')].strip()
    if not v or '$' in v or v in ('inherit', 'initial', 'unset'):
        return None
    if '/' in v:
        notes.append(('elliptique', v))
        return None
    ps = parts(v)
    def un(p):
        if p == '50%':
            return 'var(--r-full)'
        m = RE_PX.match(p)
        return jeton(round(float(m.group(1)))) if m else None
    if len(ps) == 1:
        p = ps[0]
        if p.startswith('var(') or p == '0':
            return None
        j = un(p)
        if j is None:
            notes.append(('hors plages' if RE_PX.match(p) else 'relatif', p))
            return None
        return j + imp
    # Plusieurs coins : cale seulement s'ils sont tous egaux.
    if len(set(ps)) == 1 and un(ps[0]):
        return un(ps[0]) + imp
    if any(RE_PX.match(p) or p == '50%' for p in ps):
        notes.append(('asymetrique', v))
    return None


def caler_ombre(val, notes):
    imp = ''
    v = val.strip()
    if v.endswith('!important'):
        imp, v = '!important', v[:-len('!important')].strip()
    m = SIMPLE.match(v)
    if m:
        flou = float(m.group(2))
        return ('var(--e1)' if flou <= 3 else 'var(--e2)' if flou <= 10 else 'var(--e3)') + imp
    if re.search(r'rgba?\(|#[0-9a-fA-F]{3}', v) and not v.startswith('var('):
        notes.append(('ombre composee ou coloree', v[:90]))
    return None


def zones_root(masque):
    """Les corps des blocs :root (la definition des echelles) : on n'y touche pas."""
    z = []
    for m in re.finditer(r':root[^{};]*\{', masque):
        fin = masque.find('}', m.end())
        z.append((m.end(), fin if fin >= 0 else len(masque)))
    return z


def traiter(s, est_js, notes_r, notes_o, compte):
    masque = C.masque_commentaires(s, est_js)
    zones = C.zones_js(s) if est_js else zones_root(masque)
    if not est_js and not s.lstrip().startswith(':root') and '<html' in s[:2000].lower():
        # index.html : les <script> en ligne peuvent fabriquer des documents autonomes.
        for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>', masque):
            zones += [(m.start(1) + a, m.start(1) + b) for a, b in C.zones_js(m.group(1))]
    edits = []
    for rx, caler, notes, cle in ((RE_RAYON, caler_rayon, notes_r, 'rayons'), (RE_OMBRE, caler_ombre, notes_o, 'ombres')):
        for d in rx.finditer(masque):
            if C.dedans(d.start(), zones):
                continue
            a, b = d.start(3), d.end(3)
            brut = s[a:b]
            fin = len(brut) - len(brut.rstrip())
            nv = caler(brut, notes)
            if nv is not None and nv != brut.strip():
                edits.append((a, b - fin, nv))
                compte[cle] += 1
    # Les anciens alias, partout hors :root.
    for m in RE_ALIAS.finditer(masque):
        if not C.dedans(m.start(), zones):
            edits.append((m.start(), m.end(), ALIAS[m.group(1)]))
            compte['alias'] += 1
    for m in RE_ELEV.finditer(masque):
        if not C.dedans(m.start(), zones):
            edits.append((m.start(), m.end(), ELEV[m.group(1)]))
            compte['elevations'] += 1
    for a, b, nv in sorted(edits, reverse=True):
        s = s[:a] + nv + s[b:]
    return s


def main():
    mode = 'rapport' if '--rapport' in sys.argv else 'verifier' if '--verifier' in sys.argv else 'appliquer'
    css_f, js_f, html_f, morceaux = C.fichiers()
    notes_r, notes_o = [], []
    compte = collections.Counter()
    core_change = False
    for f in [css_f] + js_f + [html_f]:
        s = open(f, encoding='utf-8', newline='').read()
        avant = sum(compte.values())
        n = traiter(s, f.endswith('.js'), notes_r, notes_o, compte)
        if mode == 'appliquer' and n != s:
            open(f, 'w', encoding='utf-8', newline='').write(n)
            core_change = core_change or (morceaux and f in js_f)
        if sum(compte.values()) != avant and mode != 'appliquer':
            print('%s : %d a caler' % (os.path.basename(f), sum(compte.values()) - avant))
    if core_change:
        subprocess.run(['node', os.path.join(RACINE, 'scripts', 'assembler_core.mjs')], check=True)
    if mode == 'rapport':
        for titre, notes in (('RAYONS LAISSES', notes_r), ('OMBRES LAISSEES', notes_o)):
            c = collections.Counter(notes)
            print('\n%s : %d' % (titre, sum(c.values())))
            for (genre, v), n in sorted(c.items(), key=lambda x: (x[0][0], -x[1])):
                print('  %-26s %3d  %s' % (genre, n, v))
    total = compte['rayons'] + compte['ombres'] + compte['alias'] + compte['elevations']
    print('rayons : %d a caler, ombres : %d, anciens alias : %d, anciennes elevations : %d' % (compte['rayons'], compte['ombres'], compte['alias'], compte['elevations'])
          + (' (appliques)' if mode == 'appliquer' else ''))
    if mode == 'verifier' and total:
        sys.exit('%d rayon(s) ou ombre(s) hors echelle : python3 scripts/rayons.py' % total)


if __name__ == '__main__':
    main()
