"""Generate the Mahajanaka episode compositions (th/ and en/) from script.json.

Each spoken line needs audio/<lang>-<scene>-<line>.mp3. Scene timing comes from
the real length of those recordings, so picture, subtitles and voice stay in sync.

    python3 build.py            # writes th/index.html and en/index.html
    cd th && npx hyperframes render --quality delivery --fps 30 --output ../mahajanaka-th.mp4
"""
import html
import json
import pathlib
import shutil
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
SCRIPT = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
NAMES = {
    "nen": {"th": "เณรต้นบุญ", "en": "Tonboon"},
    "tup": {"th": "เจ้าตูบ", "en": "Tup"},
    "goddess": {"th": "นางมณีเมขลา", "en": "Manimekhala"},
    "prince": {"th": "เจ้าชายมหาชนก", "en": "Prince Mahajanaka"},
}
INTRO, GAP, TAIL, OUTRO = 3.2, 0.45, 0.8, 3.4


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True).stdout
    return float(out.strip())


def build(lang):
    root = HERE / lang
    (root / "assets").mkdir(parents=True, exist_ok=True)
    for sub in ("fonts", "img", "audio"):
        shutil.copytree(HERE / "assets" / sub, root / "assets" / sub, dirs_exist_ok=True)

    t = INTRO
    scenes, lines, audios = [], [], []
    for si, sc in enumerate(SCRIPT["scenes"]):
        start = t
        for li, ln in enumerate(sc["lines"]):
            name = f"{lang}-{si}-{li}.mp3"
            d = duration(HERE / "audio" / name)
            shutil.copy(HERE / "audio" / name, root / "assets" / "audio" / name)
            lines.append({"id": f"l{si}-{li}", "start": round(t, 2), "dur": round(d + GAP, 2), "who": ln["who"], "text": ln[lang]})
            audios.append({"id": f"a{si}-{li}", "src": f"assets/audio/{name}", "start": round(t, 2), "dur": round(d, 2)})
            t += d + GAP
        t += TAIL
        scenes.append({"id": f"s{si}", "img": sc["img"], "start": round(start, 2), "dur": round(t - start, 2)})
    total = round(t + OUTRO, 2)

    scene_html = []
    for i, s in enumerate(scenes):
        # each scene overlaps the next by 0.6 s so the crossfade has something underneath
        dur = s["dur"] + (0.6 if i < len(scenes) - 1 else OUTRO)
        if s["img"] == "lesson":
            body = ('<img class="bg" src="assets/img/temple-bg.webp" alt="" />'
                    '<img class="nen" data-layout-allow-overflow src="assets/img/nen-wave.webp" alt="" />')
        else:
            body = f'<img class="bg kb" src="assets/img/{s["img"]}.webp" alt="" />'
        scene_html.append(f'<div id="{s["id"]}" class="clip scene" data-start="{s["start"]}" data-duration="{round(dur, 2)}" data-track-index="1"><div class="inner">{body}</div></div>')
    line_html = [
        f'<div id="{l["id"]}" class="clip line who-{l["who"]}" data-start="{l["start"]}" data-duration="{l["dur"]}" data-track-index="2">'
        f'<div class="sub"><span class="who">{html.escape(NAMES[l["who"]][lang])}</span><span class="say">{html.escape(l["text"])}</span></div></div>'
        for l in lines]
    audio_html = [f'<audio id="{a["id"]}" src="{a["src"]}" data-start="{a["start"]}" data-duration="{a["dur"]}" data-track-index="3"></audio>' for a in audios]

    tween = []
    for i, s in enumerate(scenes):
        tween.append(f'tl.fromTo("#{s["id"]} .inner", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.6, ease: "power1.out" }}, {s["start"] - (0.6 if i else 0)});')
        if s["img"] == "lesson":
            tween.append(f'tl.fromTo("#{s["id"]} .nen", {{ y: 500 }}, {{ y: 0, duration: 0.7, ease: "back.out(1.6)" }}, {s["start"]});')
        else:
            tween.append(f'tl.fromTo("#{s["id"]} .kb", {{ scale: 1.14, xPercent: {-2 if i % 2 else 2} }}, {{ scale: 1.0, xPercent: 0, duration: {s["dur"] + 0.6}, ease: "none" }}, {max(0, s["start"] - 0.6)});')
    for l in lines:
        tween.append(f'tl.fromTo("#{l["id"]} .sub", {{ y: 40, opacity: 0 }}, {{ y: 0, opacity: 1, duration: 0.35, ease: "back.out(2)" }}, {l["start"]});')
    tween.append(f'tl.fromTo("#outro .card", {{ scale: 0.6, opacity: 0 }}, {{ scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2)" }}, {round(t + 0.1, 2)});')

    title, virtue = SCRIPT["title"][lang], SCRIPT["virtue"][lang]
    kicker = "นิทานชาดก เรื่องที่ 2" if lang == "th" else "Jataka tale no. 2"
    moral = "ความพยายามไม่เคยสูญเปล่า" if lang == "th" else "Effort is never wasted"
    page = (HERE / "template.html").read_text(encoding="utf-8")
    page = (page.replace("{{LANG}}", lang).replace("{{TOTAL}}", str(total))
            .replace("{{KICKER}}", kicker).replace("{{TITLE}}", title).replace("{{VIRTUE}}", virtue)
            .replace("{{MORAL}}", moral).replace("{{OUTRO_START}}", str(round(t, 2))).replace("{{OUTRO_DUR}}", str(OUTRO))
            .replace("{{SCENES}}", "\n        ".join(scene_html)).replace("{{LINES}}", "\n        ".join(line_html))
            .replace("{{AUDIO}}", "\n        ".join(audio_html)).replace("{{TWEENS}}", "\n      ".join(tween)))
    (root / "index.html").write_text(page, encoding="utf-8")
    for f in ("hyperframes.json",):
        shutil.copy(HERE / f, root / f)
    print(f"{lang}: {len(lines)} lines, {total}s")


if __name__ == "__main__":
    for lang in ("th", "en"):
        build(lang)
