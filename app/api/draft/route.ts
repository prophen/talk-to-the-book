import { BOOK_PARTS, partById } from "@/lib/chapters";
import { gemmaJson } from "@/lib/gemma";

const SYSTEM = `You are the drafting assistant for a memoir called "My Story" by Nikema.
She dictates memories out loud. Your job is to turn a raw spoken transcript into
a clean first draft IN HER VOICE, and to file it into the right part of the book.

Rules:
- First person, natural, direct. She is telling her own story, not marketing it.
- Remove filler words, false starts, and repetitions. Lightly fix grammar.
- Keep every specific detail she gave: names, places, dates, numbers, dialogue.
- Do NOT invent facts, events, people, or feelings she did not mention.
- Do NOT embellish. If she said it plainly, keep it plain.
- Never use em dashes. Use commas, periods, or colons instead.
- Keep it close to the length of what she said. You are cleaning, not expanding.
- Respond with JSON only, no markdown.`;

export async function POST(req: Request) {
  let transcript: string;
  try {
    const body = await req.json();
    transcript = String(body.transcript ?? "").trim();
    if (transcript.length < 20) throw new Error("short");
  } catch {
    return Response.json(
      { error: "Send { transcript } with at least a sentence or two of dictation." },
      { status: 400 }
    );
  }

  const partsList = BOOK_PARTS.map((p) => `- ${p.id}: ${p.label}. Covers: ${p.covers}`).join("\n");
  const user = `Here are the parts of the book:\n${partsList}\n\nRaw dictation transcript:\n"""\n${transcript}\n"""\n\nReturn JSON with exactly these keys:\n{\n  "titleSuggestion": "a short working title for this memory, in her words where possible",\n  "cleanDraft": "the cleaned first draft of the dictation, paragraphs separated by \\n\\n",\n  "partId": "one of the part ids above",\n  "suggestedSection": "a short phrase naming the section or chapter topic this belongs in",\n  "reason": "one sentence on why it files there"\n}`;

  let result;
  try {
    result = await gemmaJson(SYSTEM, user);
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
    parsed = JSON.parse(result.text);
  } catch {
    return Response.json(
      { error: "Gemma returned non-JSON.", raw: result.text.slice(0, 300) },
      { status: 502 }
    );
  }

  const part = partById(parsed.partId);
  return Response.json({
    titleSuggestion: parsed.titleSuggestion,
    cleanDraft: parsed.cleanDraft,
    partId: part.id,
    partLabel: part.label,
    suggestedSection: parsed.suggestedSection,
    reason: parsed.reason,
    gemmaSource: result.source,
    gemmaModel: result.model,
  });
}
