# Talk to the Book

Dictate a memory. A local Gemma cleans it into a first draft and files it into your book. ElevenLabs reads it back so you can hear whether it sounds like you.

Built for the Hacktoberfest Open-Source AI Challenge, Week 3 (2026): theme "Slow and Steady", building something with open-source AI that rewards laziness. Talking is lazier than typing, and a memoir that has waited since 2021 deserves the laziest possible on-ramp.

## The problem it solves

*My Story* is a pre-sold book: 57 people paid for it in January 2021. The manuscript lives as a Google Doc outline (four parts, 14 chapter slots) plus piles of material that is easiest to produce by talking and hardest to produce by sitting down to type. Every dictated memory that turns into a filed draft is one less blank page.

## How it works

1. **Talk.** Record a dictation in the browser, upload an audio file, or (for a key-free demo) paste a transcript or load the built-in sample dictation.
2. **Transcribe.** ElevenLabs Scribe (`scribe_v2`) turns the audio into text, server-side.
3. **Draft and file.** Gemma removes filler and false starts, lightly cleans the grammar, keeps every specific detail, invents nothing, never uses em dashes, and files the memory into one of the book's four parts with a suggested section and a one-sentence reason. The raw transcript and the draft sit side by side, and the author edits before anything else happens.
4. **Hear it.** Only after she approves the text does ElevenLabs narrate it back, because hearing your own draft read aloud is the fastest edit there is, and because narration credits should never be spent on an unapproved draft.
5. **Save.** Approved dictations are kept in localStorage on her device, with title, part, and word count.

The four parts of *My Story* live in `lib/chapters.ts`, in one editable file: Breaking into tech; Founder years, betting on myself; PayPal, the win and the loss; The AI pivot, finding my people.

## Why open, and why local Gemma

A memoir draft is about as private as writing gets. Gemma 4 is open-weight (Apache 2.0), so the drafting step can run on the author's own machine through Ollama. The transcript of an unpublished, pre-sold memoir never has to leave her laptop to become a draft. The same code can fall back to Gemma served through Google AI Studio (`gemma-4-31b-it`) when Ollama is not running, which also makes a hosted demo possible.

### Picking a local model size

Disk space is not the real limit, memory is: the model has to fit in RAM to run. Reasonable choices through Ollama:

| Model | Download (QAT) | Good for |
| --- | --- | --- |
| `gemma4:e4b-it-qat` | about 6.1 GB | 8 GB machines, solid first try |
| `gemma4:12b-it-qat` (default here) | about 7.2 GB | 16 GB machines, the sweet spot for writing quality |
| `gemma4:26b-a4b-it-qat` | about 16 GB | 32 GB Macs, faster MoE responses |
| `gemma4:31b-it-qat` | about 19 GB | Best quality, needs a 24 GB GPU or a roomy Mac |

One gotcha this project handles for you: Ollama defaults Gemma 4 to a 4K context window, far below what the model supports, so `lib/gemma.ts` sends `num_ctx: 16384` on every request. A dictated memory plus instructions should never silently truncate.

## Run it

```bash
# 1. Local Gemma (once)
# Install Ollama from https://ollama.com, then:
ollama pull gemma4:12b-it-qat

# 2. The app
cp .env.example .env.local
# add ELEVENLABS_API_KEY (and GOOGLE_AI_STUDIO_KEY if you want the cloud fallback)
npm install
npm run dev
```

Open http://localhost:3000. No ElevenLabs key? Use "Load sample dictation", then "Clean it up and file it": the Gemma step works on its own.

## Prize categories this enters

- Overall, Hacktoberfest Week 3: Slow and Steady
- Best Use of Gemma ($200 featured): Gemma is the drafting and filing brain, local first
- Best Use of ElevenLabs ($100 partner): Scribe gives the book ears, text-to-speech gives it a voice

## Write-up angles (for the DEV post)

- Laziness as an accessibility feature: dictation removes the blank page, not just keystrokes.
- Privacy as the open-model argument: an unpublished memoir is exactly the text you want processed on your own machine.
- The approval gate as a cost feature: narration credits are only spent after a human approves the text.
- Honest limits: local Gemma cleans and files well; it should never be trusted to remember what you said, which is why the prompt forbids inventing and the UI shows the raw transcript next to the draft.
