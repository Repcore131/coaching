# -*- coding: utf-8 -*-
"""Rejoue, hors navigateur, les assertions que tests.js porte sur les zones.

Le code n'est pas recopie : il est DECOUPE dans index.html et dans tests.js.
Si l'un des deux change, ce controle change avec, et on ne verifie plus une
maquette. Rien ici ne touche au DOM, donc node suffit.

  python verif.py
"""
import io, os, subprocess, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, '..', '..', 'app')


def coupe(s, deb, fin):
    i = s.index(deb)
    return s[i:s.index(fin, i)]


src = io.open(os.path.join(APP, 'index.html'), encoding='utf-8', newline='').read()
tst = io.open(os.path.join(APP, 'tests.js'), encoding='utf-8', newline='').read()

morceaux = [
    coupe(src, 'const WO_ZONES = {', '// Les six groupes'),
    coupe(src, 'const WO_MUSCLES_DOS', '// PURE. La vue à montrer'),
    coupe(src, 'function woVueAvatar(', '\r\n}') + '\r\n}',
    coupe(src, 'function woHtmlZones(', '\r\n}') + '\r\n}',
    'const WO_AVA_NIV=7;',
]
i = tst.index("    // ── L'AVATAR DE SÉANCE")
bloc = tst[i:tst.index('    })();', i) + len('    })();')]

prog = '\n'.join([
    '\n'.join(morceaux).replace('\r\n', '\n'),
    'const _R=[]; let _m="";',
    'function _echec(m){ _m=m; return false; }',
    'function ok(n,v){ _R.push({n:n,ok:!!v,d:v?"":_m}); _m=""; }',
    bloc.replace('\r\n', '\n'),
    '_R.forEach(r=>console.log((r.ok?"  ok    ":"  ECHEC ")+r.n+(r.d?"\\n           -> "+r.d:"")));',
    'const ko=_R.filter(r=>!r.ok).length;',
    'console.log("\\n"+ko+" echec(s) sur "+_R.length);',
    'process.exit(ko?1:0);',
])

p = os.path.join(tempfile.gettempdir(), '_verif_zones.js')
io.open(p, 'w', encoding='utf-8', newline='\n').write(prog)
r = subprocess.run(['node', p], capture_output=True, text=True, encoding='utf-8')
print(r.stdout or r.stderr)
raise SystemExit(r.returncode)
