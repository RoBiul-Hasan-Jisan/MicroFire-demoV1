"""Builds the final film from the rendered scenes, the narration and a generated music bed.

    python3 narrate.py && node capture.mjs all && python3 assemble.py
Output: MicroFire-Atlas-explorer-film.mp4 (3840x2160, 60 fps, AAC, soft English subtitles).
"""
import json, re, subprocess

timed = json.load(open("build/timed.json"))
run = lambda *a: subprocess.run(["ffmpeg", "-v", "error", "-y", *a], check=True)

# 1. scenes: capture.mjs renders each one frame by frame (4K, 60 fps, fades included); join them losslessly
with open("build/scenes.txt", "w") as f:
    f.writelines(f"file '{sc['id']}.mp4'\n" for sc in timed)
run("-f", "concat", "-safe", "0", "-i", "build/scenes.txt", "-c", "copy", "build/video.mp4")

# 2. voice track: scene narrations back to back
with open("build/voices.txt", "w") as f:
    f.writelines(f"file '{sc['id']}.wav'\n" for sc in timed)
run("-f", "concat", "-safe", "0", "-i", "build/voices.txt", "-c:a", "pcm_s16le", "build/voice.wav")
T = sum(sc["dur"] for sc in timed)

# 3. music bed: two soft drone chords (A add9 / F#m7) that breathe into each other every 16 s
A = "+".join(f"sin(2*PI*{hz}*t)*(0.6+0.4*sin(2*PI*{r}*t))" for hz, r in [(110, .05), (164.81, .07), (220, .045), (277.18, .06), (329.63, .08), (493.88, .035)])
B = "+".join(f"sin(2*PI*{hz}*t)*(0.6+0.4*sin(2*PI*{r}*t))" for hz, r in [(92.5, .055), (138.59, .065), (220, .05), (277.18, .07), (329.63, .04), (440, .03)])
expr = f"0.05*((0.5+0.5*cos(2*PI*t/16))*({A})+(0.5-0.5*cos(2*PI*t/16))*({B}))"
run("-f", "lavfi", "-i", f"aevalsrc='{expr}':s=48000:d={T:.2f}",
    "-af", f"lowpass=f=1400,aecho=0.8:0.7:180|340:0.25|0.18,afade=t=in:d=3,afade=t=out:st={T - 4:.2f}:d=4,volume=0.55",
    "-ac", "2", "build/music.wav")

# 4. mix: music ducks under the voice, then broadcast loudness
run("-i", "build/voice.wav", "-i", "build/music.wav", "-filter_complex",
    "[0]asplit=2[v][sc];[1][sc]sidechaincompress=threshold=0.03:ratio=8:attack=30:release=500[m];"
    "[v][m]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[out]",
    "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "build/mix.m4a")

# 5. subtitles: one cue per sentence, timed inside its line
def ts(t):
    h, m, s = int(t // 3600), int(t % 3600 // 60), t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}".replace(",1000", ",999")
cues, off = [], 0.0
for sc in timed:
    for ln in sc["lines"]:
        parts = [p.strip() for p in re.findall(r"[^.!?]+(?:[.!?]+|$)", ln["text"]) if p.strip()]
        n = sum(len(p) for p in parts); at = off + ln["at"]
        for p in parts:
            d = ln["dur"] * len(p) / n
            cues.append(f"{len(cues) + 1}\n{ts(at)} --> {ts(at + d)}\n{p}\n"); at += d
    off += sc["dur"]
open("build/subtitles.srt", "w").write("\n".join(cues))

# 6. mux
run("-i", "build/video.mp4", "-i", "build/mix.m4a", "-i", "build/subtitles.srt", "-map", "0:v", "-map", "1:a", "-map", "2",
    "-c:v", "copy", "-c:a", "copy", "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart",
    "MicroFire-Atlas-explorer-film.mp4")
print(f"done: {T:.1f} s")
