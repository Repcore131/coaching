#!/usr/bin/env python3
"""Les titres de l'app, relevés pour les ramener à l'échelle (série 4, lot 1).

    python3 scripts/titres.py --rapport          # fichier:ligne:texte
    python3 scripts/titres.py --rapport --compte # le seul nombre par fichier

Relève, dans app/index.html et app/rc-core.<build>.js :
- les <h1>…<h4> ;
- les <span>/<div> dont le style en ligne combine text-transform:uppercase ET
  letter-spacing, ou qui emploient var(--pile-titre).
Les éléments qui portent déjà une classe de l'échelle (t-page, t-section,
t-carte, topbar-title) sont comptés à part : ils sont rangés.

L'ÉCHELLE (app/rc-style.<build>.css, « ÉCHELLE DES TITRES ») :
  T0 .topbar-title · T1 .t-page · T2 .t-section (.is-action) · T3 .t-carte
"""
import glob, os, re, sys

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RANGES = re.compile(r'class="[^"]*\b(t-page|t-section|t-carte|topbar-title)\b')
BALISE = re.compile(r'<(h[1-4]|span|div)\b([^>]*)>([^<]{0,80})', re.I)

def fichiers():
    core = sorted(glob.glob(os.path.join(RACINE, 'app', 'rc-core.*.js')))
    return [os.path.join(RACINE, 'app', 'index.html')] + core[-1:]

def releve():
    out, ranges = [], 0
    for f in fichiers():
        for i, ligne in enumerate(open(f, encoding='utf-8'), 1):
            for m in BALISE.finditer(ligne):
                tag, attrs, texte = m.group(1).lower(), m.group(2), m.group(3).strip()
                if RANGES.search(attrs):
                    ranges += 1; continue
                st = re.search(r'style="([^"]*)"', attrs)
                st = st.group(1) if st else ''
                titre = tag.startswith('h') or ('pile-titre' in st) or \
                    ('text-transform:uppercase' in st.replace(' ', '') and 'letter-spacing' in st)
                if titre:
                    out.append((os.path.relpath(f, RACINE), i, tag, texte or '…'))
    return out, ranges

if __name__ == '__main__':
    if '--rapport' not in sys.argv:
        print(__doc__); sys.exit(0)
    l, ranges = releve()
    if '--compte' in sys.argv:
        par = {}
        for f, *_ in l: par[f] = par.get(f, 0) + 1
        for f, n in par.items(): print(f, n)
        print('rangés dans l’échelle :', ranges)
        sys.exit(0)
    for f, i, tag, t in l:
        print('%s:%d:<%s> %s' % (f, i, tag, t))
    print('— %d titre(s) hors échelle, %d rangé(s)' % (len(l), ranges), file=sys.stderr)
