// ElevenLabs Scribe: spoken dictation in, transcript out.
// The browser uploads the recording (or an audio file); this route forwards
// it to ElevenLabs server-side so the API key never reaches the browser.

export async function POST(req: Request) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Missing ELEVENLABS_API_KEY. Add it to .env.local, or use the paste-a-transcript path instead (no key needed).",
      },
      { status: 500 }
    );
  }

  const incoming = await req.formData().catch(() => null);
  const file = incoming?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    return Response.json({ error: "Send an audio file as form field 'file'." }, { status: 400 });
  }

  const form = new FormData();
  form.append("file", file, (file as File).name ?? "dictation.webm");
  form.append("model_id", process.env.ELEVENLABS_SCRIBE_MODEL ?? "scribe_v2");
  form.append("diarize", "false");
  form.append("tag_audio_events", "false");

  const upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });

  if (!upstream.ok) {
    const detail = await upstream.text();
    return Response.json(
      { error: "ElevenLabs transcription failed.", detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const data = await upstream.json();
  const text: string = (data?.text ?? "").trim();
  if (!text) {
    return Response.json({ error: "Scribe returned an empty transcript." }, { status: 502 });
  }
  return Response.json({ transcript: text });
}
