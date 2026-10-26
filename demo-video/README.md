# Demo video

A narrated ~2 minute demo of Talk to the Book, built with [HyperFrames](https://hyperframes.heygen.com) (HTML and GSAP rendered to MP4). It lives in its own folder with its own `package.json`, so the Next.js app and its Vercel build never see it.

## What's here

- `index.html`: the edit. It cuts Nikema's screen recording into segments (waits sped up 2x and 4x), pushes in on the app column so its text reads at 1080p, lets about 28 seconds of the real ElevenLabs read-back play, and lays the narration over the rest.
- `compositions/`: the title card, the Talk / Draft / Hear / Save step rail, and the outro card.
- `script/n1.txt` to `n8.txt`: the narration, one file per beat. `assets/voice/n*.wav` are Nikema's own read of those lines, cut from one take (second takes kept where a line was redone) and normalized to -18 LUFS.
- `talk-to-the-book-demo.srt`: captions for the rendered MP4 (narration and the read-back), timed to the cut. Retime it if the edit changes.
- `vendor/gsap.min.js`: GSAP 3.14.2, vendored so renders never need a CDN.

## Render it

Needs Node 22+ and FFmpeg.

```bash
cd demo-video
# The recording is not in git. Put it here first:
cp /path/to/talk-to-the-book.mp4 assets/recording.mp4
npm run check
npm run dev       # live preview in the browser
npm run render    # writes an MP4 under renders/
```

## Change the narration

Re-record a line as `assets/voice/nN.wav`, then update that clip's `data-duration` in `index.html` if the length changed. For a quick placeholder voice, HyperFrames has local TTS:

```bash
pip install kokoro-onnx soundfile   # once
npx hyperframes tts script/n4.txt -v af_heart -o assets/voice/n4.wav
```

## Agent skills

`npx hyperframes init` installs HyperFrames skills for Claude Code (`/hyperframes`, `/hyperframes-cli`, `/hyperframes-registry`, `/media-use`) into `~/.claude/skills`. On another machine, install them with:

```bash
npx skills add heygen-com/hyperframes --all
```
