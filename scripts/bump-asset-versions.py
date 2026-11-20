#!/usr/bin/env python3
"""Atualiza o parâmetro ?v= e o hash SRI (integrity) dos ficheiros alterados em index.html.

O service worker e o GitHub Pages guardam CSS/JS por URL; sem mudar ?v= o browser pode
continuar a servir a versão antiga. Os <script> com integrity="sha384-..." têm de ter o
hash recalculado sempre que o ficheiro muda, ou o browser recusa-o.

Uso:  python3 scripts/bump-asset-versions.py AAAAMMDD-N [ref-base]
      (ref-base por omissão: main; considera os ficheiros .js/.css alterados face a essa ref)
"""
import base64
import hashlib
import pathlib
import re
import subprocess
import sys

if len(sys.argv) < 2:
    sys.exit(__doc__)
version = sys.argv[1]
base = sys.argv[2] if len(sys.argv) > 2 else "main"
changed = [
    path for path in subprocess.check_output(["git", "diff", "--name-only", base], text=True).split()
    if path.endswith((".js", ".css")) and not path.startswith(("tests/", "worker/", "scripts/"))
]
html_path = pathlib.Path("index.html")
html = html_path.read_text()
for path in changed:
    pattern = re.compile(r'(src|href)="' + re.escape(path) + r'(\?v=[^"]*)?"(\s+integrity="[^"]*")?')
    match = pattern.search(html)
    if not match:
        print(f"não referenciado em index.html: {path}")
        continue
    integrity = ""
    if match.group(3):
        digest = base64.b64encode(hashlib.sha384(pathlib.Path(path).read_bytes()).digest()).decode()
        integrity = f' integrity="sha384-{digest}"'
    html = html[:match.start()] + f'{match.group(1)}="{path}?v={version}"{integrity}' + html[match.end():]
    print(f"{path} → v={version}{' (SRI atualizado)' if integrity else ''}")
html_path.write_text(html)
