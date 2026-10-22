"use client";

import { useEffect, useRef, useState } from "react";

// The read-back player. The browser's own audio controls are small on phones
// and can't be restyled, so this drives a hidden <audio> with a big play
// button and a seek bar in the draft's part color.

const SPEEDS = [1, 1.25, 1.5, 0.75];

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function ReadBackPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);

  // A new narration starts from the top.
  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed;
  }, [speed, src]);

  function togglePlay() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => setPlaying(false));
    } else {
      a.pause();
    }
  }

  function seek(to: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = to;
    setCurrent(to);
  }

  function nextSpeed() {
    setSpeed((s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]);
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="player" role="group" aria-label="Read-back player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        className="player-play"
        onClick={togglePlay}
        aria-label={playing ? "Pause read-back" : "Play read-back"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="5" y="4" width="5" height="16" />
            <rect x="14" y="4" width="5" height="16" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        )}
      </button>
      <div className="player-body">
        <input
          type="range"
          className="player-seek"
          min={0}
          max={duration || 0}
          step={1}
          value={Math.min(current, duration || 0)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(current)} of ${formatTime(duration)}`}
          style={{ "--pct": `${pct}%` } as React.CSSProperties}
        />
        <div className="player-foot">
          <span className="player-time" aria-hidden="true">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <button
            type="button"
            className="player-speed"
            onClick={nextSpeed}
            aria-label={`Playback speed ${speed}x. Change speed`}
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}
