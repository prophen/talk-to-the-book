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
