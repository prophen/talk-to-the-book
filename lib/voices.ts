// ElevenLabs library voice presets for the read-back step.
// Replace the ids with your own favorites (or a clone of your own voice)
// from your ElevenLabs voice library. The server also honors
// ELEVENLABS_VOICE_ID in .env.local as an override.

export interface VoicePreset {
  id: string;
  label: string;
  note: string;
}

export const VOICE_PRESETS: VoicePreset[] = [
  {
    id: "21m00Tcm4TlvDq8ikWAM",
    label: "Rachel",
    note: "Calm narration, good default for hearing a draft back.",
  },
  {
    id: "EXAVITQu4vr4xnSDxMaL",
    label: "Sarah",
    note: "Warm and even, closer to a reading voice.",
  },
  {
    id: "onwK4e9ZLuTAKqWW03F9",
    label: "Daniel",
    note: "Steadier, newsreader pace, useful contrast when editing.",
  },
];
