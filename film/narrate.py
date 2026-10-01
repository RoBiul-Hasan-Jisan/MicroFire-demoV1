"""Narrates each scene of script.json with a neural voice (Microsoft Edge TTS via the `edge-tts` CLI)
and records durations in build/script-timed.json for build-data.mjs.

    EDGE_TTS=/path/to/edge-tts python3 narrate.py     # voice/rate below
The voice is AI-generated; the film carries an on-screen disclosure as the local rules require.
"""
import json, os, subprocess
VOICE = os.environ.get("VOICE", "en-US-AndrewMultilingualNeural")
RATE = os.environ.get("RATE", "+12%")
EDGE = os.environ.get("EDGE_TTS", "edge-tts")
os.makedirs("build", exist_ok=True)
scenes = json.load(open("script.json"))
for sc in scenes:
    out = f"build/{sc['id']}.mp3"
    subprocess.run([EDGE, "--voice", VOICE, f"--rate={RATE}", "--text", sc["narration"], "--write-media", out], check=True, capture_output=True)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out], capture_output=True, text=True, check=True).stdout
    sc["audio"] = round(float(dur), 2)
    print(f"{sc['id']:10s} {sc['audio']:6.2f}s")
json.dump(scenes, open("build/script-timed.json", "w"), indent=1)
print("total speech", round(sum(s["audio"] for s in scenes), 1), "s with", VOICE, RATE)
