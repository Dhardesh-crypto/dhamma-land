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

Beyond the 9 stops:

- **Recorded voices.** Tonboon and Tup speak every narrator line, story slide and mission in Thai and English (126 recordings). Lines play automatically as the child moves through a stop; anything without a recording falls back to the device's speech voice.
- **Daily good-deed missions (ภารกิจความดี).** One real-life mission a day from a list of 21. The child confirms it honestly (a nudge to precept 4), and a lotus grows in a 14-day pond with a streak counter.
- **Jataka Theatre (โรงละครนิทานชาดก).** All ten Jatakas with the perfection each one teaches. Episode 2, **พระมหาชนก** (perseverance), is a narrated 1½-minute animated film in Thai and English, followed by three "what would you do?" questions that earn a Perseverance Star. The other nine are marked as coming soon.

Thai by default, with an English toggle. Sound effects are generated in the browser. Progress, missions and stars are saved in the browser only.

## Layout

```
index.html        the built site (do not edit by hand; see below)
img/              character and scene art (generated with Higgsfield)
audio/            recorded voice lines, named by voice key (see src/voice_lines.py)
video/            animated clips rendered with HyperFrames, plus poster stills
netlify.toml      publish this folder as-is, no build step
src/              site source: app.jsx (React), shell.html (styles), head.html, build.py,
                  voice_lines.py (lists spoken lines), prepare_audio.py (levels new recordings)
hyperframes/      the three HyperFrames video projects
  intro/          16 s opening film (homepage)
  card/           title-card template; rows.json holds the 9 stops
  bloom/          2.8 s lotus bloom shown when a stop is completed
  mahajanaka/     Jataka episode: script.json + recorded lines in audio/ -> build.py -> th/ and en/
```

## Edit the site

Change `src/app.jsx` (content and behaviour) or `src/shell.html` (styles), then rebuild:

```bash
python3 src/build.py
```

React 18 loads from cdnjs at runtime, so the page needs no bundling beyond this step.

## Voices

| Character | Voice |
|---|---|
| Novice Tonboon | Higgsfield Seed Audio, voice derived from Tonboon's picture, then cloned from that clip for every line |
| Tup | Seed Audio, derived from Tup's picture, cloned the same way |
| Prince Mahajanaka | Higgsfield preset voice "Archie" |
| Manimekhala | Seed Audio, derived from the goddess scene |

Each recording is named after an FNV-1a hash of `<lang>|<text>`, so editing a line in `app.jsx` simply leaves it unrecorded (it falls back to the device voice) until a new file is added. To find lines that need recording:

```bash
python3 src/voice_lines.py      # every spoken line with its key, who and language
```

Save new recordings as `audio/<key>.raw.mp3`, then level them and rebuild:

```bash
python3 src/prepare_audio.py
python3 src/build.py
```

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

The Mahajanaka episode is generated from its script, so its timing follows the recorded voices:

```bash
cd hyperframes/mahajanaka
python3 build.py                       # writes th/ and en/
cd th && npx hyperframes render --quality delivery --fps 30 --output ../renders/mahajanaka-th.mp4
ffmpeg -i ../renders/mahajanaka-th.mp4 -c:v libx264 -preset slow -crf 28 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart ../../../video/mahajanaka-th.mp4
```

## Notes on content

- The narrator is a novice monk, not the Buddha. The Buddha appears only in the story scenes, drawn calmly with traditional Thai features, because comic depictions of the Buddha are offensive in Thailand.
- The Thai text and the Thai voice recordings should be reviewed by a native speaker or Buddhism teacher before classroom use. Speech recognition flagged two spots worth a listen: "ผจญภัย" in the line "วันนี้เราจะพาไปผจญภัยในแดนธรรมะ…", and "ว่าย" in the prince's line in the Mahajanaka episode.

## Credits

- Art: generated with Higgsfield (GPT Image 2.5). Voices: Higgsfield Seed Audio.
- Video: [HyperFrames](https://github.com/heygen-com/hyperframes) by HeyGen.
- Fonts: [Itim](https://fonts.google.com/specimen/Itim) and [Mali](https://fonts.google.com/specimen/Mali) by Cadson Demak, SIL Open Font License (see `hyperframes/fonts-license/`).
