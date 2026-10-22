"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BOOK_PARTS, DEFAULT_OUTLINE, sanitizeOutline, type BookOutline, type BookPart } from "@/lib/chapters";
import { VOICE_PRESETS } from "@/lib/voices";
import DraftingOverlay from "./drafting-overlay";

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
const OUTLINE_KEY = "ttb-outline";

// File an entry against the outline currently in use, falling back to the
// default book's parts for entries saved before outlines were editable.
function entryPartId(en: Entry, parts: BookPart[]): string {
  return (
    en.partId ??
    parts.find((p) => p.label === en.partLabel)?.id ??
    BOOK_PARTS.find((p) => p.label === en.partLabel)?.id ??
    parts[0].id
  );
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
  // Read out by screen readers through the polite live region.
  const [status, setStatus] = useState("");
  const [saved, setSaved] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [outline, setOutline] = useState<BookOutline>(DEFAULT_OUTLINE);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const reviewHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const draftButtonRef = useRef<HTMLButtonElement | null>(null);
  const draftAbortRef = useRef<AbortController | null>(null);
  // Set when drafting ends without a draft, so focus goes back to the button
  // once the overlay is gone and the page is no longer inert.
  const refocusDraftButton = useRef(false);

  // When a draft lands, take keyboard and screen reader users to it.
  useEffect(() => {
    if (draft) reviewHeadingRef.current?.focus();
  }, [draft]);

  useEffect(() => {
    if (busy === null && refocusDraftButton.current) {
      refocusDraftButton.current = false;
      draftButtonRef.current?.focus();
    }
  }, [busy]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENTRIES_KEY);
      if (raw) setEntries(JSON.parse(raw));
      const savedOutline = localStorage.getItem(OUTLINE_KEY);
      if (savedOutline) setOutline(sanitizeOutline(JSON.parse(savedOutline)));
    } catch {
      /* fresh book */
    }
  }, []);

  function updateOutline(next: BookOutline) {
    setOutline(next);
    try {
      localStorage.setItem(OUTLINE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function updatePart(index: number, patch: Partial<BookPart>) {
    updateOutline({
      ...outline,
      parts: outline.parts.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    });
  }

  function addPart() {
    if (outline.parts.length >= 12) return;
    updateOutline({
      ...outline,
      parts: [
        ...outline.parts,
        { id: `part-${Date.now()}`, label: `Part ${outline.parts.length + 1}: `, short: "", covers: "" },
      ],
    });
  }

  function removePart(index: number) {
    if (outline.parts.length <= 1) return;
    updateOutline({ ...outline, parts: outline.parts.filter((_, i) => i !== index) });
  }

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
        setStatus("Recording stopped. Ready to transcribe.");
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setStatus("Recording.");
    } catch {
      setError("Microphone access was blocked. You can upload an audio file or paste a transcript instead.");
    }
  }

  async function transcribe() {
    if (!audioBlob || busy) return;
    setBusy("transcribe");
    setError(null);
    setStatus("Transcribing with Scribe.");
    try {
      const form = new FormData();
      form.append("file", audioBlob, audioName || "dictation.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Transcription failed.");
      setTranscript(data.transcript);
      setStatus("Transcript ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed.");
      setStatus("");
    } finally {
      setBusy(null);
    }
  }

  async function makeDraft() {
    if (busy) return;
    setBusy("draft");
    setStatus("Gemma is drafting.");
    setError(null);
    setDraft(null);
    setNarrationUrl(null);
    const controller = new AbortController();
    draftAbortRef.current = controller;
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, outline }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Drafting failed.");
      setDraft(data);
      setEditedDraft(data.cleanDraft);
      setSaved(false);
      setStatus(`Draft filed under ${data.partLabel}.`);
    } catch (e) {
      refocusDraftButton.current = true;
      if (controller.signal.aborted) {
        setStatus("Drafting cancelled. Your transcript is unchanged.");
      } else {
        setError(e instanceof Error ? e.message : "Drafting failed.");
        setStatus("");
      }
    } finally {
      draftAbortRef.current = null;
      setBusy(null);
    }
  }

  const cancelDraft = useCallback(() => draftAbortRef.current?.abort(), []);

  async function narrate() {
    if (busy) return;
    setBusy("narrate");
    setStatus("ElevenLabs is reading.");
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
      setStatus("Read-back ready. Press play on the audio player.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Narration failed.");
      setStatus("");
    } finally {
      setBusy(null);
    }
  }

  // Copy a draft in manuscript shape: the suggested title as a heading line,
  // a blank line, then the draft text, ready to paste into the book document.
  async function copyForManuscript(key: string, title: string, text: string) {
    const payload = `${title}\n\n${text}`;
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedKey(key);
    setStatus(`Copied "${title}" for the manuscript.`);
    setTimeout(() => setCopiedKey((c) => (c === key ? null : c)), 2500);
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
    setSaved(true);
    setStatus(`Saved to ${draft.partLabel}.`);
    try {
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const countByPart = (id: string) =>
    entries.filter((en) => entryPartId(en, outline.parts) === id).length;
  const groups = outline.parts
    .map((p) => ({
      part: p,
      items: entries.filter((en) => entryPartId(en, outline.parts) === p.id),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <>
      {/* While Gemma drafts, the overlay is the whole page and everything
          behind it is inert, so focus and the screen reader stay with it. */}
      <main className="page" inert={busy === "draft"}>
        <header className="hero">
          <p className="kicker">Slow and Steady · Hacktoberfest Week 3</p>
          <h1>
            Talk to the <span className="book">Book</span>
          </h1>
          <p className="sub">
            Dictate a memory. A local Gemma cleans it into a first draft and files it into the
            right part of <em>{outline.title}</em>. ElevenLabs reads it back so you can hear it.
          </p>
        </header>

        <ol className={`strip ${draft ? "has-filing" : ""}`} aria-label={`The parts of ${outline.title}`}>
          {outline.parts.map((p, i) => (
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

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <section className="card">
          <p className="step-label">Step 1 · Talk</p>
          <h2>Tell the memory out loud</h2>
          <p className="hint">
            Ramble is fine. Filler, false starts, and going in circles are the machine's
            problem now, not yours.
          </p>
          <div className="row">
            <button onClick={toggleRecording} className={`cta record ${recording ? "recording" : ""}`}>
              <span aria-hidden="true">{recording ? "■" : "●"}</span>{" "}
              {recording ? "Stop recording" : "Record a dictation"}
            </button>
            {recording && (
              <span className="timer" aria-live="off">
                REC {formatElapsed(elapsed)}
              </span>
            )}
            {/* The input stays in the tab order but is visually hidden; the
                label shows its focus ring via :focus-within. */}
            <label className="cta secondary upload">
              Upload audio
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setAudioBlob(f);
                    setAudioName(f.name);
                    setStatus(`Ready to transcribe ${f.name}.`);
                  }
                }}
              />
            </label>
            <button className="cta secondary" onClick={() => setTranscript(SAMPLE_DICTATION)}>
              Load sample dictation
            </button>
          </div>
          {audioBlob && (
            <div className="row">
              <button onClick={transcribe} aria-disabled={busy !== null} className="cta">
                {busy === "transcribe" ? "Scribe is listening..." : "Transcribe with ElevenLabs Scribe"}
              </button>
              <span className="meta">
                Ready: {audioName || "recording"} ({Math.round(audioBlob.size / 1024)} KB)
              </span>
            </div>
          )}
          <p className="hint">
            No mic or no key? Paste a transcript below instead, or load the sample, a made-up demo
            memory. The draft step works either way.
          </p>
          <label htmlFor="transcript" className="field-label">
            Transcript
          </label>
          <textarea
            id="transcript"
            rows={6}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Your transcript will appear here, or paste one..."
          />
          <div className="row">
            <button
              ref={draftButtonRef}
              onClick={makeDraft}
              disabled={transcript.trim().length < 20}
              aria-disabled={busy !== null}
              aria-describedby={transcript.trim().length < 20 ? "draft-needs" : undefined}
              className="cta"
            >
              {busy === "draft" ? "Gemma is drafting..." : "Clean it up and file it (Gemma)"}
            </button>
            {transcript.trim().length < 20 && (
              <span id="draft-needs" className="meta">
                Add a transcript of at least a sentence to continue.
              </span>
            )}
          </div>
          <p className="meta">
            Drafting runs on local Gemma first (Ollama), with AI Studio as a fallback. When
            local Gemma drafts, your dictation stays on your machine for that step. When the
            cloud fallback drafts instead, your transcript is sent to Google AI Studio for
            that request. Transcription and read-back use ElevenLabs.
          </p>
        </section>

        {draft && (
          <section className="card" data-part={draft.partId}>
            <p className="step-label">Step 2 · Review</p>
            <h2 ref={reviewHeadingRef} tabIndex={-1}>
              Your draft, filed
            </h2>
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
              onChange={(e) => {
                setEditedDraft(e.target.value);
                setSaved(false);
              }}
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
              <button
                onClick={narrate}
                disabled={!editedDraft.trim()}
                aria-disabled={busy !== null}
                className="cta"
              >
                {busy === "narrate" ? "ElevenLabs is reading..." : "Hear it read back"}
              </button>
              <button onClick={saveEntry} disabled={saved} className="cta secondary">
                {saved ? "Saved to my dictations" : "Save to my dictations"}
              </button>
              <button
                onClick={() => copyForManuscript("draft", draft.titleSuggestion, editedDraft)}
                className="cta secondary"
              >
                {copiedKey === "draft" ? "Copied, paste it in" : "Copy draft for the manuscript"}
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
                        <p className="meta">
                          {en.savedAt} · {en.draft.split(/\s+/).length} words
                        </p>
                        <div className="row entry-actions">
                          <button
                            onClick={() => copyForManuscript(`entry-${part.id}-${i}`, en.title, en.draft)}
                            className="cta secondary"
                          >
                            {copiedKey === `entry-${part.id}-${i}` ? "Copied, paste it in" : "Copy for the manuscript"}
                            <span className="sr-only">: {en.title}</span>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="card">
          <p className="step-label">Your book outline</p>
          <h2>
            {outline.title}, in {outline.parts.length} {outline.parts.length === 1 ? "part" : "parts"}
          </h2>
          <p className="hint">
            Built for {DEFAULT_OUTLINE.title}, and that book is the default below. Writing your
            own? Change the title and the parts, in your words, and Gemma files your dictations
            against your outline instead. Saved only in this browser.
          </p>
          <label className="label" htmlFor="book-title">
            Book title
          </label>
          <input
            id="book-title"
            type="text"
            value={outline.title}
            onChange={(e) => updateOutline({ ...outline, title: e.target.value })}
            className="text-input"
          />
          <ul className="parts-list">
            {outline.parts.map((p, i) => (
              <li key={p.id} data-part={p.id}>
                <span className="num-block" aria-hidden="true">
                  {i + 1}
                </span>
                <div className="part-fields">
                  <label className="label" htmlFor={`part-label-${p.id}`}>
                    Part name
                  </label>
                  <input
                    id={`part-label-${p.id}`}
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePart(i, { label: e.target.value })}
                    className="text-input tight"
                  />
                  <label className="label" htmlFor={`part-covers-${p.id}`}>
                    What belongs in this part?
                  </label>
                  <textarea
                    id={`part-covers-${p.id}`}
                    rows={2}
                    value={p.covers}
                    onChange={(e) => updatePart(i, { covers: e.target.value })}
                    placeholder="Themes, years, people, places. This is how Gemma decides a memory belongs here."
                  />
                  <div className="row">
                    <button
                      onClick={() => removePart(i)}
                      disabled={outline.parts.length <= 1}
                      className="cta secondary"
                    >
                      Remove this part
                      <span className="sr-only">: part {i + 1}</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="row">
            <button onClick={addPart} disabled={outline.parts.length >= 12} className="cta secondary">
              Add a part
            </button>
            <button onClick={() => updateOutline(DEFAULT_OUTLINE)} className="cta secondary">
              Reset to {DEFAULT_OUTLINE.title}
            </button>
          </div>
          <p className="meta">
            Edits apply to the next dictation you draft. Dictations already saved keep the
            part they were filed under.
          </p>
        </section>
      </main>
      {busy === "draft" && (
        <DraftingOverlay transcript={transcript} outline={outline} onCancel={cancelDraft} />
      )}
      {/* Outside main so announcements still reach screen readers while main is inert. */}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </>
  );
}
