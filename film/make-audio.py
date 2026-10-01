"""Builds build/narration.m4a (240 s) and build/subtitles.srt from build/data.json scene timing."""
import json, re, subprocess
d = json.load(open("build/data.json"))
inputs, filters = [], []
for i, sc in enumerate(d["scenes"]):
    inputs += ["-i", f"build/{sc['id']}.mp3"]
    ms = int(round((sc["start"] + sc["audioAt"]) * 1000))
    filters.append(f"[{i}]adelay={ms}|{ms},aformat=channel_layouts=stereo[a{i}]")
n = len(d["scenes"])
T = d["total"]
mix = "".join(f"[a{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0,apad=whole_dur={T},atrim=0:{T},loudnorm=I=-16:TP=-1.5[out]"
subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", ";".join(filters) + ";" + mix, "-map", "[out]", "-c:a", "aac", "-b:a", "192k", "build/narration.m4a"], check=True)

def ts(t):
    h, m = int(t // 3600), int(t % 3600 // 60); s = t % 60
    return f"{h:02d}:{m:02d}:{int(s):02d},{int(round((s % 1) * 1000)):03d}"
srt, k = [], 1
for sc in d["scenes"]:
    parts = [p.strip() for p in re.findall(r"[^.!?]+[.!?]+", sc["narration"])]
    total = sum(len(p) for p in parts); at = sc["start"] + sc["audioAt"]
    for p in parts:
        dur = sc["audio"] * len(p) / total
        srt.append(f"{k}\n{ts(at)} --> {ts(at + dur)}\n{p}\n"); k += 1; at += dur
open("build/subtitles.srt", "w").write("\n".join(srt))
print("narration + subtitles ok")
