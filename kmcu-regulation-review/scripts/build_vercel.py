"""app/index.html(원본)로 vercel/public/index.html을 만든다. shim.js를 앱 스크립트보다 먼저 불러온다."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(HERE, "..", "app", "index.html")
dst = os.path.join(HERE, "..", "vercel", "public", "index.html")
s = open(src, encoding="utf-8").read()
anchor = '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>'
assert anchor in s
s = s.replace(anchor, '<script src="/shim.js"></script>\n' + anchor, 1)
open(dst, "w", encoding="utf-8").write(s)
print("built", os.path.relpath(dst))
