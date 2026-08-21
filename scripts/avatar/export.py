# -*- coding: utf-8 -*-
"""Ecrit la constante JS des zones musculaires, prete a coller dans index.html.

  python export.py > zones.js
"""
import sys, io
from build import build

EPS = 0.7   # tolerance de simplification, en centiemes de vignette


def js(d):
    out = []
    out.append('const WO_ZONES = {')
    for g in ('h', 'f'):
        out.append('"%s":{' % g)
        for v in ('face', 'dos'):
            out.append('"%s":{' % v)
            for n in range(1, 8):
                ms = d[g][v][str(n)]
                cor = []
                for m in sorted(ms):
                    polys = ['"%s"' % ' '.join(
                        ('%g,%g' % (x, y)) for (x, y) in p) for p in ms[m]]
                    cor.append('%s:[%s]' % (m, ','.join(polys)))
                out.append('%d:{%s}%s' % (n, ','.join(cor), ',' if n < 7 else ''))
            out.append('}%s' % (',' if v == 'face' else ''))
        out.append('}%s' % (',' if g == 'h' else ''))
    out.append('};')
    return '\n'.join(out)


if __name__ == '__main__':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', newline='\n')
    s = js(build(EPS))
    sys.stdout.write(s)
    sys.stderr.write('octets : %d\n' % len(s))
