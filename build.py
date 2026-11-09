# Builds soul-wrapped.html (one self-contained file) from soul-wrapped.src.html + assets/
#   __LOGO_SOUL__ / __LOGO_ACOUSTIC__  -> logos
#   __PH:<file>__                      -> assets/photos/<file>
import base64, pathlib, re
root = pathlib.Path(__file__).parent
src = (root / "soul-wrapped.src.html").read_text(encoding="utf-8")

def uri(path):
    return "data:image/webp;base64," + base64.b64encode((root / "assets" / path).read_bytes()).decode()

out = src.replace("__LOGO_SOUL__", uri("soul-logo.webp")).replace("__LOGO_ACOUSTIC__", uri("acoustic-soul-logo.webp"))
out = re.sub(r"__PH:([A-Za-z0-9_.\-]+)__", lambda m: uri("photos/" + m.group(1)), out)
head, body = out.split("</style>", 1)
html = '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + head + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>'
(root / "public" / "index.html").write_text(html, encoding="utf-8")
print("built", len(out), "chars")

# Keep server-side validation in sync with the candidate arrays in the source.
import json
candidates = {m.group(1): json.loads(m.group(2)) for m in re.finditer(r'^\s+([a-z_]+):\s+(\[[^\n]*\])', src, re.M)}
(root / "api" / "candidates.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
