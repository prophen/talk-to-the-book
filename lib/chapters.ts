// The four parts of "My Story" (Nikema's pre-sold book: breaking into tech,
// betting on herself, and finding her people; four parts, 14 chapter slots in
// the manuscript Google Doc). Gemma files each dictation into one part and
// suggests a section inside it. Edit this one file when the outline changes.

export interface BookPart {
  id: string;
  label: string;
  // Short name for tight spots like the chapter strip.
  short: string;
  covers: string;
}

export const BOOK_PARTS: BookPart[] = [
  {
    id: "breaking-in",
    label: "Part 1: Breaking into tech",
    short: "Breaking into tech",
    covers:
      "Learning to code, career change, first opportunities, impostor feelings, early community, getting the first real break.",
  },
  {
    id: "founder-years",
    label: "Part 2: Founder years, betting on myself",
    short: "Founder years",
    covers:
      "Starting things of her own, freelancing and founder work, risks taken, money stress, lessons learned the hard way, betting on herself.",
  },
  {
    id: "paypal",
    label: "Part 3: PayPal, the win and the loss",
    short: "PayPal",
    covers:
      "Developer advocacy at PayPal, moving into software engineering, the team being eliminated, the win of getting there and the loss of how it ended, leaving in April 2025.",
  },
  {
    id: "ai-pivot",
    label: "Part 4: The AI pivot, finding my people",
    short: "The AI pivot",
    covers:
      "Building with AI agents, building in public, California Black Stories, the current job search, community, and what comes next.",
  },
];

export const partById = (id: string): BookPart =>
  BOOK_PARTS.find((p) => p.id === id) ?? BOOK_PARTS[0];

// A book outline is just data: a title plus its parts. "My Story" ships as
// the default because this app was built for that book. The outline editor
// in the UI lets any author swap in their own title and parts, stored in
// their browser, and the draft route files dictations against whatever
// outline it is sent.

export interface BookOutline {
  title: string;
  parts: BookPart[];
}

export const DEFAULT_OUTLINE: BookOutline = {
  title: "My Story",
  parts: BOOK_PARTS,
};

const deriveShort = (label: string): string =>
  label.replace(/^part\s+\d+\s*:\s*/i, "").split(",")[0].trim() || label;

const cleanLine = (value: string, max: number): string =>
  value
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const cleanId = (value: string, fallback: string): string => {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return cleaned || fallback;
};

/** Clean up an outline arriving from the client, or fall back to the default. */
export function sanitizeOutline(input: unknown): BookOutline {
  if (!input || typeof input !== "object") return DEFAULT_OUTLINE;
  const raw = input as { title?: unknown; parts?: unknown };
  // Outline fields are interpolated into the Gemma prompt, so every field is
  // flattened to a single line here: embedded newlines or control characters
  // in a title, label, or "covers" note must not be able to pose as prompt
  // structure. The fields stay data; the draft route says so explicitly too.
  const title =
    typeof raw.title === "string" && cleanLine(raw.title, 120)
      ? cleanLine(raw.title, 120)
      : DEFAULT_OUTLINE.title;
  if (!Array.isArray(raw.parts)) return { title, parts: DEFAULT_OUTLINE.parts };
  const parts: BookPart[] = raw.parts
    .filter((p): p is Record<string, unknown> => !!p && typeof p === "object")
    .map((p, i) => {
      const label =
        typeof p.label === "string" && cleanLine(p.label, 160)
          ? cleanLine(p.label, 160)
          : `Part ${i + 1}`;
      const short = typeof p.short === "string" ? cleanLine(p.short, 60) : "";
      return {
        id: typeof p.id === "string" ? cleanId(p.id, `part-${i + 1}`) : `part-${i + 1}`,
        label,
        short: short || deriveShort(label),
        covers: typeof p.covers === "string" ? cleanLine(p.covers, 600) : "",
      };
    })
    .slice(0, 12);
  return { title, parts: parts.length ? parts : DEFAULT_OUTLINE.parts };
}

export const outlinePartById = (outline: BookOutline, id: string): BookPart =>
  outline.parts.find((p) => p.id === id) ?? outline.parts[0];
