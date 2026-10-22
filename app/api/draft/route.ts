import { outlinePartById, sanitizeOutline } from "@/lib/chapters";
import { gemmaJson } from "@/lib/gemma";
import { parseGemmaJson } from "@/lib/parse";

const systemFor = (bookTitle: string) => `You are the drafting assistant for a memoir called "${bookTitle}".
The author dictates memories out loud. Your job is to turn a raw spoken transcript into
a clean first draft IN THE AUTHOR'S VOICE, and to file it into the right part of the book.

Rules:
- First person, natural, direct. The author is telling their own story, not marketing it.
- Remove filler words, false starts, and repetitions. Lightly fix grammar.
- Keep every specific detail given: names, places, dates, numbers, dialogue.
- Do NOT invent facts, events, people, or feelings that were not mentioned.
- Do NOT embellish. If it was said plainly, keep it plain.
- Never use em dashes. Use commas, periods, or colons instead.
- Keep it close to the length of what was said. You are cleaning, not expanding.
- Respond with JSON only, no markdown.`;

export async function POST(req: Request) {
  let transcript: string;
  let outline;
  try {
    const body = await req.json();
    transcript = String(body.transcript ?? "").trim();
    if (transcript.length < 20) throw new Error("short");
    outline = sanitizeOutline(body.outline);
  } catch {
    return Response.json(
      { error: "Send { transcript, outline? } with at least a sentence or two of dictation." },
      { status: 400 }
    );
  }

  const partsList = outline.parts
    .map((p) => `- ${p.id}: ${p.label}. Covers: ${p.covers}`)
    .join("\n");
  const user = `The book is "${outline.title}". Here are its parts:\n${partsList}\n\nRaw dictation transcript:\n"""\n${transcript}\n"""\n\nReturn JSON with exactly these keys:\n{\n  "titleSuggestion": "a short working title for this memory, in the author's words where possible",\n  "cleanDraft": "the cleaned first draft of the dictation, paragraphs separated by \\n\\n",\n  "partId": "one of the part ids above",\n  "suggestedSection": "a short phrase naming the section or chapter topic this belongs in",\n  "reason": "one sentence on why it files there"\n}`;

  let result;
  try {
    result = await gemmaJson(systemFor(outline.title), user);
  } catch (e) {
    return Response.json(
      {
        error:
          "Gemma is unreachable. For local mode, start Ollama and pull the model (see README). For cloud mode, set GEMMA_MODE=cloud and add GOOGLE_AI_STUDIO_KEY.",
        detail: e instanceof Error ? e.message.slice(0, 300) : String(e),
      },
      { status: 502 }
    );
  }

  let parsed: {
    titleSuggestion: string;
    cleanDraft: string;
    partId: string;
    suggestedSection: string;
    reason: string;
  };
  try {
    // Local Gemma can wrap its JSON in fences or a thought block, so this is
    // a tolerant extract, not a bare JSON.parse. See lib/parse.ts.
    parsed = parseGemmaJson(result.text);
  } catch {
    return Response.json(
      { error: "Gemma returned non-JSON.", raw: result.text.slice(0, 300) },
      { status: 502 }
    );
  }

  const part = outlinePartById(outline, parsed.partId);
  return Response.json({
    titleSuggestion: parsed.titleSuggestion,
    cleanDraft: parsed.cleanDraft,
    partId: part.id,
    partLabel: part.label,
    bookTitle: outline.title,
    suggestedSection: parsed.suggestedSection,
    reason: parsed.reason,
    gemmaSource: result.source,
    gemmaModel: result.model,
  });
}
