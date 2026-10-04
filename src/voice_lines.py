"""List every spoken line in src/app.jsx with its audio key.

Spoken lines are the narrator lines (`lines=[...]` blocks), the story slide text,
Tup's story asides and the daily missions. Each line is voiced once per language; the file name is
the FNV-1a hash of "<lang>|<text>", matching voiceKey() in app.jsx.

    python3 src/voice_lines.py            # JSON list to stdout
"""
import json, pathlib, re

SRC = pathlib.Path(__file__).resolve().parent / "app.jsx"
TPAIR = r'T\("((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\)'

def key(lang, text):
    h = 0x811C9DC5
    for b in f"{lang}|{text}".encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f"{h:08x}"

def lines():
    s = SRC.read_text(encoding="utf-8")
    out = []
    blocks = re.findall(r"lines=\{\[(.*?)\]\}", s, re.S) + re.findall(r"const lines = \[(.*?)\];", s, re.S)
    for b in blocks:
        for item in re.finditer(r"\{\s*\.\.\.%s,\s*who:\s*\"tup\"\s*\}|%s" % (TPAIR, TPAIR), b):
            if item.group(1) is not None:
                out.append(("tup", item.group(1), item.group(2)))
            else:
                out.append(("nen", item.group(3), item.group(4)))
    for block in re.findall(r"const MISSIONS = \[(.*?)\];", s, re.S):
        for m in re.finditer(TPAIR, block):
            out.append(("nen", m.group(1), m.group(2)))
    for who, field in (("nen", "text"), ("tup", "tup")):
        for m in re.finditer(r"\b%s: %s" % (field, TPAIR), s):
            out.append((who, m.group(1), m.group(2)))
    seen, rows = set(), []
    for who, th, en in out:
        for lang, text in (("th", th), ("en", en)):
            k = key(lang, text)
            if k not in seen:
                seen.add(k)
                rows.append({"key": k, "who": who, "lang": lang, "text": text})
    return rows

if __name__ == "__main__":
    print(json.dumps(lines(), ensure_ascii=False, indent=1))
