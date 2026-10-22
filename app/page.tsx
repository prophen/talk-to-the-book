"use client";

import { useEffect, useRef, useState } from "react";
import { BOOK_PARTS } from "@/lib/chapters";
import { VOICE_PRESETS } from "@/lib/voices";

const SAMPLE_DICTATION = `Um, so okay, I remember, I remember the kitchen table, right? Like, I would, I would get up before everybody else, before the house was awake, and I would just, you know, open the laptop and try to figure out one more thing before I had to get ready for work. And it was, it was slow, like, some mornings I literally only understood one little piece, but I wrote it down, I kept a notebook, and, and after a few months of that, I looked back at the notebook and I thought, oh, I actually know some things now. That was the first time I believed I could really do this.`;

// Clearly a demo sample, not one of Nikema's real memories. It exists so the
// draft step can be tried without a mic or an ElevenLabs key.

interface DraftResult {
  titleSuggestion: string;
  cleanDraft: string;
  partId: string;
  partLabel: string;
  suggestedSection: string;
  reason: string;
  gemmaSource: string;
  gemmaModel: string;
}

interface Entry {
  title: string;
  // Older saved entries predate partId; they are matched by label instead.
  partId?: string;
  partLabel: string;
  draft: string;
  savedAt: string;
}

const ENTRIES_KEY = "ttb-entries";

function entryPartId(en: Entry): string {
  return en.partId ?? BOOK_PARTS.find((p) => p.label === en.partLabel)?.id ?? BOOK_PARTS[0].id;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Home() {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioName, setAudioName] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [editedDraft, setEditedDraft] = useState("");
  const [voiceId, setVoiceId] = useState(VOICE_PRESETS[0].id);
  const [narrationUrl, setNarrationUrl] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENTRIES_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch {
      /* fresh book */
    }
  }, []);

  useEffect(() => {
    if (!recording) return;
    setElapsed(0);
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [recording]);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudioBlob(new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" }));
        setAudioName("dictation.webm");
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone access was blocked. You can upload an audio file or paste a transcript instead.");
    }
  }

  async function transcribe() {
    if (!audioBlob) return;
    setBusy("transcribe");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", audioBlob, audioName || "dictation.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      setTranscript(data.transcript);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
    } finally {
      setBusy(null);
    }
  }

  async function makeDraft() {
    setBusy("draft");
    setError(null);
    setDraft(null);
    setNarrationUrl(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drafting failed.");
      setDraft(data);
      setEditedDraft(data.cleanDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Drafting failed.");
    } finally {
      setBusy(null);
    }
  }

  async function narrate() {
    setBusy("narrate");
    setError(null);
    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editedDraft, voiceId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Narration failed.");
      }
      const blob = await res.blob();
      setNarrationUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Narration failed.");
    } finally {
      setBusy(null);
    }
  }

  function saveEntry() {
    if (!draft) return;
    const entry: Entry = {
      title: draft.titleSuggestion,
      partId: draft.partId,
      partLabel: draft.partLabel,
      draft: editedDraft,
      savedAt: new Date().toLocaleString(),
    };
    const next = [entry, ...entries];
    setEntries(next);
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const countByPart = (id: string) => entries.filter((en) => entryPartId(en) === id).length;
  const groups = BOOK_PARTS.map((p) => ({
    part: p,
    items: entries.filter((en) => entryPartId(en) === p.id),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="page">
      <header className="hero">
        <p className="kicker">Slow and Steady · Hacktoberfest Week 3</p>
        <h1>
          Talk to the <span className="book">Book</span>
        </h1>
        <p className="sub">
          Dictate a memory. A local Gemma cleans it into a first draft and files it into the
          right part of <em>My Story</em>. ElevenLabs reads it back so you can hear it.
        </p>
      </header>

      <ol className={`strip ${draft ? "has-filing" : ""}`} aria-label="The four parts of My Story">
        {BOOK_PARTS.map((p, i) => (
          <li
            key={p.id}
            data-part={p.id}
            className={draft?.partId === p.id ? "on" : ""}
            aria-current={draft?.partId === p.id ? "true" : undefined}
          >
            <span className="num">Part {i + 1}</span>
            <span className="name">{p.short}</span>
            <span className="count">
              {countByPart(p.id)} {countByPart(p.id) === 1 ? "dictation" : "dictations"}
            </span>
          </li>
        ))}
      </ol>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <p className="step-label">Step 1 · Talk</p>
        <h2>Tell the memory out loud</h2>
        <p className="hint">
          Ramble is fine. Filler, false starts, and going in circles are the machine's
          problem now, not yours.
        </p>
        <div className="row">
          <button onClick={toggleRecording} className={`cta record ${recording ? "recording" : ""}`}>
            {recording ? "■ Stop recording" : "● Record a dictation"}
          </button>
          {recording && (
            <span className="timer" aria-live="off">
              REC {formatElapsed(elapsed)}
            </span>
          )}
          <label className="cta secondary" style={{ display: "inline-block", cursor: "pointer" }}>
            Upload audio
            <input
              type="file"
              accept="audio/*"
              className="file-input"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setAudioBlob(f);
                  setAudioName(f.name);
                }
              }}
            />
          </label>
          <button
            className="cta secondary"
            onClick={() => setTranscript(SAMPLE_DICTATION)}
            title="A demo dictation, not a real memory, for trying the draft step"
          >
            Load sample dictation
          </button>
        </div>
        {audioBlob && (
          <div className="row">
            <button onClick={transcribe} disabled={busy !== null} className="cta">
              {busy === "transcribe" ? "Scribe is listening..." : "Transcribe with ElevenLabs Scribe"}
            </button>
            <span className="meta">
              Ready: {audioName || "recording"} ({Math.round(audioBlob.size / 1024)} KB)
            </span>
          </div>
        )}
        <p className="hint">
          No mic or no key? Paste a transcript here instead. The draft step works either way.
        </p>
        <textarea
          rows={6}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your transcript will appear here, or paste one..."
        />
        <div className="row">
          <button onClick={makeDraft} disabled={busy !== null || transcript.trim().length < 20} className="cta">
            {busy === "draft" ? "Gemma is drafting..." : "Clean it up and file it (Gemma)"}
          </button>
        </div>
        <p className="meta">
          Drafting runs on local Gemma first (Ollama), with AI Studio as a fallback. Your
          dictation stays on your machine for that step.
        </p>
      </section>

      {draft && (
        <section className="card" data-part={draft.partId}>
          <p className="step-label">Step 2 · Review</p>
          <h2>Your draft, filed</h2>
          <div className="filing">
            <p className="draft-title">{draft.titleSuggestion}</p>
            <p>
              <strong>Files under:</strong> {draft.partLabel}
            </p>
            <p>
              <strong>Suggested section:</strong> {draft.suggestedSection}
            </p>
            <p className="reason">{draft.reason}</p>
          </div>
          <textarea
            rows={10}
            value={editedDraft}
            onChange={(e) => setEditedDraft(e.target.value)}
            aria-label="Cleaned draft, edit before listening or saving"
          />
          <p className="meta">
            Edit freely. Nothing is narrated or saved until you say so. Drafted by Gemma (
            {draft.gemmaSource}: {draft.gemmaModel}).
          </p>
          <div className="row">
            <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} aria-label="Read-back voice">
              {VOICE_PRESETS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}: {v.note}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button onClick={narrate} disabled={busy !== null || !editedDraft.trim()} className="cta">
              {busy === "narrate" ? "ElevenLabs is reading..." : "Hear it read back"}
            </button>
            <button onClick={saveEntry} className="cta secondary">
              Save to my dictations
            </button>
          </div>
          {narrationUrl && <audio controls src={narrationUrl} />}
        </section>
      )}

      {groups.length > 0 && (
        <section className="card">
          <p className="step-label">Your dictations</p>
          <h2>Saved on this device</h2>
          <div className="groups">
            {groups.map(({ part, items }) => (
              <div className="group" key={part.id} data-part={part.id}>
                <h3>
                  <span className="swatch" aria-hidden="true" />
                  {part.label}
                </h3>
                <ul className="entries">
                  {items.map((en, i) => (
                    <li key={i}>
                      <p className="entry-title">{en.title}</p>
                      <p className="meta" style={{ margin: 0 }}>
                        {en.savedAt} · {en.draft.split(/\s+/).length} words
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <p className="step-label">The book it feeds</p>
        <h2>My Story, in four parts</h2>
        <ul className="parts-list">
          {BOOK_PARTS.map((p, i) => (
            <li key={p.id} data-part={p.id}>
              <span className="num-block" aria-hidden="true">
                {i + 1}
              </span>
              <div>
                <p className="part-name">{p.label}</p>
                <p className="hint">{p.covers}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
