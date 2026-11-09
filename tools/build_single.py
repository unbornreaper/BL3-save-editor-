#!/usr/bin/env python3
"""
Builds:
  js/demo.js                      - bundled demo save (tests/sample_pc.sav)
  dist/BL3-Save-Editor.html       - one self-contained file (open it in any browser, works offline)
Usage: python3 tools/build_single.py
"""
import base64, os, re
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
p = lambda *a: os.path.join(ROOT, *a)

with open(p('tests', 'sample_pc.sav'), 'rb') as f:
    demo = base64.b64encode(f.read()).decode()
with open(p('js', 'demo.js'), 'w') as f:
    f.write('/* Demo save (PC sample character from FromDarkHell/BL3SaveEditor) */\nwindow.BL3_DEMO = "' + demo + '";\n')

html = open(p('index.html'), encoding='utf-8').read()
css = open(p('css', 'style.css'), encoding='utf-8').read()
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
def inline(m):
    src = open(p(m.group(1)), encoding='utf-8').read().replace('</script', '<\\/script')
    return '<script>\n' + src + '\n</script>'
html = re.sub(r'<script src="([^"]+)"></script>', inline, html)
os.makedirs(p('dist'), exist_ok=True)
with open(p('dist', 'BL3-Save-Editor.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('dist/BL3-Save-Editor.html', len(html), 'bytes')
