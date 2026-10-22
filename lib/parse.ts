// Tolerant JSON extraction for Gemma replies.
//
// Local Gemma 4 is a thinking model. Even with format:"json" set on the
// Ollama request, a reply can come back wrapped in markdown fences, preceded
// by a thought channel block, or with a sentence of prose around the object.
// This pulls the JSON object out of whatever envelope it arrived in instead
// of failing the whole draft.

export function parseGemmaJson<T>(raw: string): T {
  let text = raw.trim();

  // Drop a thought channel block if one leaked into the content:
  // everything up to and including the last <channel|> marker is reasoning.
  const channelEnd = text.lastIndexOf("<channel|>");
  if (channelEnd !== -1) text = text.slice(channelEnd + "<channel|>".length).trim();

  // Drop <thought>...</thought> blocks (the other spelling of the same leak).
  text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();

  // Strip markdown code fences.
  text = text.replace(/```(?:json)?/gi, "").trim();

  // Take the outermost object.
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object found in model reply.");
  const candidate = text.slice(start, end + 1);
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return JSON.parse(repairJson(candidate)) as T;
  }
}

// Fix the near-misses Gemma produces most: raw line breaks or tabs inside a
// string (a multi-paragraph cleanDraft) and trailing commas before a closing
// brace or bracket.
export function repairJson(text: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (const ch of text) {
    if (inString) {
      if (escaped) {
        escaped = false;
        out += ch;
      } else if (ch === "\\") {
        escaped = true;
        out += ch;
      } else if (ch === '"') {
        inString = false;
        out += ch;
      } else if (ch === "\n") {
        out += "\\n";
      } else if (ch === "\r") {
        // dropped; \n carries the line break
      } else if (ch === "\t") {
        out += "\\t";
      } else {
        out += ch;
      }
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "}" || ch === "]") {
      out = out.replace(/,\s*$/, "") + ch;
    } else {
      out += ch;
    }
  }
  return out;
}
