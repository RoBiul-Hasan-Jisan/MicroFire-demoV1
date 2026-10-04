"""Voices each line of script.json separately (Edge neural TTS, female voice Ava) and joins the lines with
natural pauses, so the delivery breathes like a person rather than one block of text.
Writes build/<scene>.wav and build/timed.json (scene durations and the start time of every line).

    EDGE_TTS=/path/to/edge-tts python3 narrate.py
The voice is AI-generated; the film shows an on-screen disclosure.
"""
import hashlib, json, os, subprocess
VOICE = os.environ.get("VOICE", "en-US-AvaMultilingualNeural")
RATE = os.environ.get("RATE", "+4%")
EDGE = os.environ.get("EDGE_TTS", "edge-tts")
LEAD, GAP, TAIL, END_TAIL = 0.5, 0.42, 0.8, 3.4  # seconds; the final scene keeps a longer tail for the end card
os.makedirs("build", exist_ok=True)
dur = lambda f: float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True, check=True).stdout)
out = []
scenes = json.load(open("script.json"))
for sc in scenes:
    tail = END_TAIL if sc is scenes[-1] else TAIL
    t, parts, lines = LEAD, [], []
    for i, (text, *cap) in enumerate(sc["lines"]):
        key = hashlib.sha1(f"{VOICE}|{RATE}|{text}".encode()).hexdigest()[:10]  # re-voice only lines whose text changed
        mp3 = f"build/{sc['id']}-{i}-{key}.mp3"
        if not os.path.exists(mp3):
            subprocess.run([EDGE, "--voice", VOICE, f"--rate={RATE}", "--text", text, "--write-media", mp3], check=True, capture_output=True)
        d = dur(mp3)
        lines.append({"text": text, "cap": cap[0] if cap else None, "at": round(t, 3), "dur": round(d, 3)})
        parts.append((mp3, t))
        t += d + (GAP if i < len(sc["lines"]) - 1 else tail)
    # place each line at its time on a silent bed
    ins = sum((["-i", f] for f, _ in parts), [])
    flt = ";".join(f"[{i}]adelay={int(at*1000)}|{int(at*1000)},aformat=sample_rates=48000:channel_layouts=stereo[a{i}]" for i, (_, at) in enumerate(parts))
    mix = "".join(f"[a{i}]" for i in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,apad=whole_dur={t},atrim=0:{t}[o]"
    subprocess.run(["ffmpeg", "-v", "error", "-y", *ins, "-filter_complex", flt + ";" + mix, "-map", "[o]", f"build/{sc['id']}.wav"], check=True)
    out.append({"id": sc["id"], "dur": round(t, 3), "lines": lines})
    print(f"{sc['id']:10s} {t:6.2f}s")
json.dump(out, open("build/timed.json", "w"), indent=1, ensure_ascii=False)
print("total", round(sum(s["dur"] for s in out), 1), "s with", VOICE, RATE)
