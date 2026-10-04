# ผจญภัยแดนธรรมะ · Dhamma Land Adventure

An interactive cartoon website that teaches Thai children (about 8–12 years old) the basics of Buddhism. Novice Tonboon (เณรต้นบุญ), a cheeky 10-year-old novice monk, and Tup (เจ้าตูบ), his puppy, guide them through 9 stops. Each finished stop earns a lotus flower, and the last one gives a certificate.

Live: https://dhamma-land.netlify.app

| Stop | Teaches | Activity |
|---|---|---|
| 1 พบเณรต้นบุญ | Meet the guides | Talking intro |
| 2 เจ้าชายผู้ตื่น | The Buddha's life | 4-part illustrated story + question |
| 3 แก้ว 3 ดวง | The Triple Gem | Tap the jewels |
| 4 ศีล 5 | The Five Precepts | Good deed or not? card game |
| 5 สายพิณพอดี | The Middle Way | Tune a lute string (Indra's three-string lute) |
| 6 ใจลูกหมา | Mindfulness | พุท–โธ breathing; tap away distracting thoughts |
| 7 คุณหมอเณร | Four Noble Truths | Put the doctor's 4 steps in order |
| 8 สวนแห่งกรรม | Karma | Plant actions, grow flowers or thorns |
| 9 สอบบัณฑิตน้อย | Review | Quiz + named certificate |

Thai by default, with an English toggle. Narration can be read aloud with the device's speech voice; sound effects are generated in the browser. Progress is saved in the browser only.

## Layout

```
index.html        the built site (do not edit by hand; see below)
img/              character and scene art (generated with Higgsfield)
video/            animated clips rendered with HyperFrames, plus poster stills
netlify.toml      publish this folder as-is, no build step
src/              site source: app.jsx (React), shell.html (styles), head.html, build.py
hyperframes/      the three HyperFrames video projects
  intro/          16 s opening film (homepage)
  card/           title-card template; rows.json holds the 9 stops
  bloom/          2.8 s lotus bloom shown when a stop is completed
```

## Edit the site

Change `src/app.jsx` (content and behaviour) or `src/shell.html` (styles), then rebuild:

```bash
python3 src/build.py
```

React 18 loads from cdnjs at runtime, so the page needs no bundling beyond this step.

## Re-render the videos

HyperFrames needs Node 22+ and FFmpeg. From a project folder:

```bash
cd hyperframes/intro
npx hyperframes check
npx hyperframes render --quality delivery --fps 30 --output intro.mp4
```

The title cards render as a batch, one per row in `rows.json`:

```bash
cd hyperframes/card
npx hyperframes render --batch rows.json --output "renders/{name}.mp4" --quality delivery --fps 30 --strict-variables
```

HyperFrames output is large, so re-encode before copying into `video/`:

```bash
ffmpeg -i intro.mp4 -an -c:v libx264 -preset slow -crf 27 -pix_fmt yuv420p -movflags +faststart ../../video/intro.mp4
```

Cards use `-crf 28`. Poster stills (`video/*.webp`) are single frames taken from the rendered clips.

## Notes on content

- The narrator is a novice monk, not the Buddha. The Buddha appears only in the story scenes, drawn calmly with traditional Thai features, because comic depictions of the Buddha are offensive in Thailand.
- The Thai text should be reviewed by a native speaker or Buddhism teacher before classroom use.

## Credits

- Art: generated with Higgsfield (GPT Image 2.5).
- Video: [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen.
- Fonts: [Itim](https://fonts.google.com/specimen/Itim) and [Mali](https://fonts.google.com/specimen/Mali) by Cadson Demak, SIL Open Font License (see `hyperframes/fonts-license/`).
