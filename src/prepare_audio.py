"""Level and compress downloaded voice lines.

Turns audio/<key>.raw.mp3 (as downloaded from Higgsfield) into audio/<key>.mp3:
silence trimmed from both ends, loudness normalised to -16 LUFS, mono 64 kbps.
The raw file is removed afterwards. Needs ffmpeg.

    python3 src/prepare_audio.py
"""
import pathlib
import subprocess

audio = pathlib.Path(__file__).resolve().parent.parent / "audio"
trim = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse"
done = 0
for raw in sorted(audio.glob("*.raw.mp3")):
    out = audio / (raw.name.split(".")[0] + ".mp3")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(raw), "-af", f"{trim},loudnorm=I=-16:TP=-1.5:LRA=11,apad=pad_dur=0.15",
                    "-ac", "1", "-ar", "24000", "-b:a", "64k", str(out)], check=True)
    raw.unlink()
    done += 1
print(f"prepared {done} voice lines; {len(list(audio.glob('*.mp3')))} in audio/")
