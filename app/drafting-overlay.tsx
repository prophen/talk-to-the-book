"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { BookOutline } from "@/lib/chapters";

// The full-page scene shown while Gemma drafts. The transcript sits on a page
// and its filler words get struck out one by one, while the book's parts take
// turns lighting up as if Gemma is deciding where the memory files. It is all
// decoration: screen readers get the dialog name and the polite status line.

const FILLERS = new Set([
  "um", "umm", "uh", "uhh", "er", "erm", "hmm", "like", "so", "okay", "ok",
  "right", "literally", "basically", "actually", "just", "anyway", "yeah",
]);

const MAX_WORDS = 70;

interface Word {
  text: string;
  filler: boolean;
}

const normalize = (w: string) => w.toLowerCase().replace(/[^a-z']/g, "");

// Mark the words a cleanup would drop: filler words, "you know", and a word
// or two-word phrase said twice in a row ("I would, I would").
function markFillers(transcript: string): { words: Word[]; truncated: boolean } {
  const raw = transcript.trim().split(/\s+/).filter(Boolean);
  const words = raw.slice(0, MAX_WORDS).map((text) => ({ text, filler: false }));
  const n = words.map((w) => normalize(w.text));
  for (let i = 0; i < words.length; i++) {
    if (FILLERS.has(n[i])) words[i].filler = true;
    if (n[i] === "you" && n[i + 1] === "know") {
      words[i].filler = true;
      words[i + 1].filler = true;
    }
    if (i > 0 && n[i] && n[i] === n[i - 1]) words[i - 1].filler = true;
    if (i > 2 && n[i] && n[i] === n[i - 2] && n[i - 1] === n[i - 3]) {
      words[i - 3].filler = true;
      words[i - 2].filler = true;
    }
  }
  return { words, truncated: raw.length > MAX_WORDS };
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function DraftingOverlay({
  transcript,
  outline,
  onCancel,
}: {
  transcript: string;
  outline: BookOutline;
  onCancel: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [captionIndex, setCaptionIndex] = useState(0);
  const { words, truncated } = useMemo(() => markFillers(transcript), [transcript]);

  const captions = [
    "Clearing out the ums and you-knows.",
    "Keeping your voice and your words.",
    "Finding a title for this memory.",
    `Deciding where it files in ${outline.title}.`,
  ];

  // The page behind is inert while this is open, so move focus here and let
  // Escape back out the same way the Cancel button does.
  useEffect(() => {
    headingRef.current?.focus();
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500);
    const rotate = setInterval(() => setCaptionIndex((i) => i + 1), 2800);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("drafting-open");
    return () => {
      clearInterval(tick);
      clearInterval(rotate);
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("drafting-open");
    };
  }, [onCancel]);

  let fillerCount = 0;
  const parts = outline.parts;

  return (
    <div
      className="drafting"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drafting-title"
      aria-describedby="drafting-desc"
    >
      <div className="drafting-stripe" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="drafting-inner">
        <p className="kicker">Step 1 · Talk → Step 2 · Review</p>
        <h2 id="drafting-title" ref={headingRef} tabIndex={-1}>
          Gemma is <span className="drafting-accent">drafting</span>
        </h2>
        <p id="drafting-desc" className="drafting-caption">
          {/* Only the first caption is read out; the rotation is visual. */}
          <span className="sr-only">Cleaning your dictation into a first draft and filing it.</span>
          <span aria-hidden="true" key={captionIndex}>
            {captions[captionIndex % captions.length]}
          </span>
        </p>

        <div className="drafting-page" aria-hidden="true">
          <p>
            {words.map((w, i) => {
              const delay = w.filler ? 0.5 + fillerCount++ * 0.32 : 0;
              return (
                <span
                  key={i}
                  className={w.filler ? "w filler" : "w"}
                  style={w.filler ? ({ "--d": `${delay}s` } as React.CSSProperties) : undefined}
                >
                  {w.text}{" "}
                </span>
              );
            })}
            {truncated && <span className="w">…</span>}
          </p>
        </div>

        <ol className="drafting-parts" aria-hidden="true" style={{ "--n": parts.length } as React.CSSProperties}>
          {parts.map((p, i) => (
            <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
              {p.short || p.label}
            </li>
          ))}
        </ol>

        <div className="row drafting-foot">
          <button className="cta secondary" onClick={onCancel}>
            Cancel drafting
          </button>
          <span className="meta" aria-hidden="true">
            {formatElapsed(elapsed)} · local Gemma can take a minute
          </span>
        </div>
      </div>
    </div>
  );
}
