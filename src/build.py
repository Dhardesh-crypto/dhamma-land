"""Build the site: compile src/app.jsx with esbuild and write ../index.html.

Run from the repo root:  python3 src/build.py
Needs Node (any recent version) for `npx esbuild`.
"""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parent.parent
src = root / "src"
js = subprocess.run(
    ["npx", "--yes", "esbuild", str(src / "app.jsx"), "--minify", "--target=es2019"],
    check=True, capture_output=True, text=True,
).stdout
head = (src / "head.html").read_text(encoding="utf-8")
shell = (src / "shell.html").read_text(encoding="utf-8")
(root / "index.html").write_text(head + shell.replace("/*APP*/", js) + "\n</body></html>", encoding="utf-8")
print("wrote index.html")
