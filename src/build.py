"""Build the site: compile src/app.jsx with esbuild and write ../index.html.

Recorded voice lines in ../audio/*.mp3 are listed into the page so it knows
which lines to play from file (see src/voice_lines.py).

Run from the repo root:  python3 src/build.py
Needs Node (any recent version) for `npx esbuild`.
"""
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
js = subprocess.run(
    ["npx", "--yes", "esbuild", str(src / "app.jsx"), "--minify", "--target=es2019"],
    check=True, capture_output=True, text=True,
).stdout
voiced = sorted(f.stem for f in (root / "audio").glob("*.mp3") if "." not in f.stem)
js = "window.__VOICED__=" + json.dumps(voiced) + ";\n" + js
head = (src / "head.html").read_text(encoding="utf-8")
shell = (src / "shell.html").read_text(encoding="utf-8")
(root / "index.html").write_text(head + shell.replace("/*APP*/", js) + "\n</body></html>", encoding="utf-8")
print(f"wrote index.html ({len(voiced)} voice lines)")
