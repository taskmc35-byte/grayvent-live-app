#!/bin/sh
# Costruisce l'anteprima a file singolo (pubblicabile come pagina) in dist-preview/
set -e
cd "$(dirname "$0")/.."
npx vite build --mode artifact >/dev/null
python3 - <<'PY'
import re
s=open('dist-preview/index.html').read()
head=re.search(r'<head>(.*)</head>',s,re.S).group(1)
body=re.search(r'<body>(.*)</body>',s,re.S).group(1)
head=re.sub(r'<meta charset[^>]*>|<meta name="viewport"[^>]*>|<link rel="(manifest|icon|apple-touch-icon)"[^>]*>','',head)
open('dist-preview/grayvent-schede.html','w').write(head+body)
w=open('public/pdf.worker.min.mjs','rb').read().replace(b'"\x1b"',b'"\\x1b"')
open('dist-preview/pdf.worker.min.mjs','wb').write(w)
PY
cp -r public/manuali dist-preview/
