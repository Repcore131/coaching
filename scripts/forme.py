#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""LA FORME, RENDUE MÉCANIQUE (build 1900, série 4) — sur le modèle de
scripts/espacements.py. Aucune taille de texte ne change.

    python3 scripts/forme.py --rapport     liste, ne change rien
    python3 scripts/forme.py --appliquer   cale et réécrit
    python3 scripts/forme.py --verifier    sort en 1 s'il reste quelque chose à caler

Traite app/rc-style.<build>.css (hors :root, qui DÉFINIT les échelles ; le
thème clair généré vit dans rc-theme et n'est pas lu), les morceaux
src/core/NNN-*.js (puis rc-core est réassemblé) et app/index.html, hors
commentaires et hors documents autonomes (exports A4 : ils n'ont pas la
feuille). Relancer scripts/theme_clair.py ensuite.

1. LES RAYONS, LES ALIAS, LES ÉLÉVATIONS ET LES OMBRES : la logique est celle
   de scripts/rayons.py (lot 27), reprise telle quelle :
     border-radius en px : 1-5 → var(--r-1) · 6-9 → var(--r-2) ·
     10-15 → var(--r-3) · 16-24 → var(--r-4) · 50 % / ≥ 99 px → var(--r-full) ;
     composés asymétriques : listés, pas modifiés ;
     --r-sm → --r-2 · --r-md, --r-card, --r-lg → --r-3 (déclarations retirées) ;
     --elev-* et --el-* → --e1/--e2/--e3 ;
     ombre noire simple « 0 Npx Mpx rgba(0,0,0,a) » → --e1 (flou ≤ 3),
     --e2 (≤ 10), --e3 (au-delà). Les ombres vers le haut (feuilles du bas),
     en retrait, colorées ou composées sont listées : les caler inverserait
     leur sens ou effacerait une lueur voulue.
2. LES INTERLETTRES : letter-spacing en px est ramené à l'échelle
   {0, .5, 1, 1.5, 2, 2.5} px, AU CRAN INFÉRIEUR quand il tombe entre deux
   (on ne grossit jamais) ; au-delà de 2,5 px → 2,5 px. Restent tels quels :
   les valeurs dans un clamp(), en em, « normal », les négatives (les ramener
   à 0 élargirait le texte) — listées.
"""
import collections, os, re, subprocess, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(RACINE, 'scripts'))
import couleurs as C   # masque_commentaires, zones_js, fichiers, dedans
import rayons as R     # traiter, zones_root (rayons, alias, élévations, ombres)

ECHELLE_LS = [0, .5, 1, 1.5, 2, 2.5]
RE_LS = re.compile(r'(?<![\w-])(letter-spacing)(\s*:\s*)([^;"\'`<>{}]*)')
RE_PX = re.compile(r'^(-?\d*\.?\d+)px(\s*!important)?$')


def fmt(v):
    if v == 0:
        return '0'
    t = ('%g' % v)
    return (t[1:] if t.startswith('0.') else t) + 'px'


def caler_ls(brut, notes):
    v = brut.strip()
    m = RE_PX.match(v)
    if not m:
        if v and v not in ('0', 'normal', 'inherit', 'initial') and not v.startswith('var('):
            notes.append(('interlettre laissée', v[:60]))
        return None
    x = float(m.group(1)); imp = m.group(2) or ''
    if x < 0:
        notes.append(('interlettre négative', v)); return None
    cran = max(e for e in ECHELLE_LS if e <= x + 1e-9) if x <= 2.5 else 2.5
    nv = fmt(cran) + imp
    return nv if nv.replace(' ', '') != v.replace(' ', '') else None


def traiter_ls(s, est_js, notes, compte):
    masque = C.masque_commentaires(s, est_js)
    zones = C.zones_js(s) if est_js else R.zones_root(masque)
    if not est_js and '<html' in s[:2000].lower():
        for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>', masque):
            zones += [(m.start(1) + a, m.start(1) + b) for a, b in C.zones_js(m.group(1))]
    edits = []
    for d in RE_LS.finditer(masque):
        if C.dedans(d.start(), zones):
            continue
        a, b = d.start(3), d.end(3)
        brut = s[a:b]
        if 'clamp(' in brut or 'em' in brut.replace('emp', ''):
            if 'clamp(' in brut: notes.append(('interlettre en clamp()', brut.strip()[:60]))
            continue
        fin = len(brut) - len(brut.rstrip())
        nv = caler_ls(brut, notes)
        if nv is not None:
            edits.append((a, b - fin, nv)); compte['interlettres'] += 1
    for a, b, nv in sorted(edits, reverse=True):
        s = s[:a] + nv + s[b:]
    return s


def main():
    mode = 'rapport' if '--rapport' in sys.argv else 'verifier' if '--verifier' in sys.argv else \
        'appliquer' if '--appliquer' in sys.argv else None
    if not mode:
        print(__doc__); sys.exit(0)
    css_f, js_f, html_f, morceaux = C.fichiers()
    notes_r, notes_o, notes_l = [], [], []
    compte = collections.Counter()
    core_change = False
    for f in [css_f] + js_f + [html_f]:
        s = open(f, encoding='utf-8', newline='').read()
        avant = sum(compte.values())
        n = R.traiter(s, f.endswith('.js'), notes_r, notes_o, compte)
        n = traiter_ls(n, f.endswith('.js'), notes_l, compte)
        if mode == 'appliquer' and n != s:
            open(f, 'w', encoding='utf-8', newline='').write(n)
            core_change = core_change or (morceaux and f in js_f)
        if sum(compte.values()) != avant and mode != 'appliquer':
            print('%s : %d à caler' % (os.path.basename(f), sum(compte.values()) - avant))
    if core_change:
        subprocess.run(['node', os.path.join(RACINE, 'scripts', 'assembler_core.mjs')], check=True)
    if mode == 'rapport':
        for titre, notes in (('RAYONS LAISSÉS', notes_r), ('OMBRES LAISSÉES', notes_o), ('INTERLETTRES LAISSÉES', notes_l)):
            c = collections.Counter(notes)
            print('\n%s : %d' % (titre, sum(c.values())))
            for (genre, v), k in sorted(c.items(), key=lambda x: (x[0][0], -x[1]))[:60]:
                print('  %-26s %3d  %s' % (genre, k, v))
    total = sum(compte[k] for k in ('rayons', 'ombres', 'alias', 'elevations', 'interlettres'))
    print('rayons : %d, ombres : %d, alias : %d, élévations : %d, interlettres : %d'
          % (compte['rayons'], compte['ombres'], compte['alias'], compte['elevations'], compte['interlettres'])
          + (' (appliqués)' if mode == 'appliquer' else ' à caler'))
    if mode == 'verifier' and total:
        sys.exit('%d valeur(s) hors échelle : python3 scripts/forme.py --appliquer' % total)


if __name__ == '__main__':
    main()
