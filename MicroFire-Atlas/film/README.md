# MicroFire Atlas demo film (240 s)

Every frame is a pure function of time (`window.renderAt(t)` in `film.html`), rendered at 1920×1080, 25 fps.
All numbers come from the site's data and tested code (`build-data.mjs` imports `apps/web/lib`).

```bash
python3 narrate.py         # neural TTS narration per scene (edge-tts) -> build/*.mp3 + durations
node build-data.mjs        # scene timing (240 s total) + all on-screen data from the site's code
node make-html.mjs         # inline the data into build/film.html
node render.mjs            # 6000 frames -> build/video.mp4 (needs playwright)
python3 make-audio.py      # narration track + subtitles
ffmpeg -i build/video.mp4 -i build/narration.m4a -i build/subtitles.srt \
  -map 0:v -map 1:a -map 2 -c:v copy -c:a copy -c:s mov_text -metadata:s:s:0 language=eng \
  MicroFire-Atlas-film.mp4
```

The flame drawings in scenes 1 and 6 are illustrations, labelled as such, not simulations.
The Ask scene shows the real retrieval output and the real citation checker on test cases; it is not a live model answer.
