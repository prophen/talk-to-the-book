// Gemma access, local first.
//
// Local: Ollama serving an open-weight Gemma 4 build on the author's own
// machine (default model gemma4:12b-it-qat, about a 7.2 GB download, fits a
// 16 GB machine). Her dictated memoir never has to leave the laptop for the
// drafting step.
//
// Cloud fallback: the same Gemma family served through Google AI Studio
// (gemma-4-31b-it), used only when Ollama is not reachable and a key exists,
// or when GEMMA_MODE=cloud.
//
// GEMMA_MODE=local | cloud | auto   (default: auto, local first)

const OLLAMA_BASE = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const LOCAL_MODEL = process.env.GEMMA_LOCAL_MODEL ?? "gemma4:12b-it-qat";
const CLOUD_MODEL = process.env.GEMMA_CLOUD_MODEL ?? "gemma-4-31b-it";

export interface GemmaResult {
  text: string;
  source: "local" | "cloud";
  model: string;
}

async function tryLocal(
  system: string,
  user: string,
  think: boolean | undefined = false
): Promise<GemmaResult> {
  const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: LOCAL_MODEL,
      stream: false,
      format: "json",
      // Gemma 4 is a thinking model. Thinking here is pure cost: it burns
      // tokens (and minutes on an M1) and can leak reasoning into the reply
      // ahead of the JSON. Drafting and filing do not need it, so turn it off.
      ...(think !== undefined ? { think } : {}),
      // Ollama defaults Gemma 4 to a 4K context window. A dictated chapter
      // memory plus instructions needs more, so ask for 16K explicitly.
      // num_predict gives the whole cleaned draft room to finish: a truncated
      // reply is invalid JSON.
      options: { num_ctx: 16384, num_predict: 3072, temperature: 0.4 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(300_000),
  });
  // Older Ollama / model builds may reject the think flag itself. Retry once
  // without it rather than failing the draft.
  if (!res.ok && think !== undefined) {
    const detail = await res.clone().text().catch(() => "");
    if (/think/i.test(detail)) return tryLocal(system, user, undefined);
  }
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text: string | undefined = data?.message?.content;
  if (!text) throw new Error("Empty response from local Gemma.");
  return { text, source: "local", model: LOCAL_MODEL };
}

async function tryCloud(system: string, user: string): Promise<GemmaResult> {
  const apiKey = process.env.GOOGLE_AI_STUDIO_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_AI_STUDIO_KEY for the cloud fallback.");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${CLOUD_MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) throw new Error(`AI Studio ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  // A thinking model can return its thoughts as a separate part ahead of the
  // answer, so join the non-thought parts instead of taking the first one.
  const parts: { text?: string; thought?: boolean }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Empty response from cloud Gemma.");
  return { text, source: "cloud", model: CLOUD_MODEL };
}

/** Ask Gemma for a JSON answer. Local first unless GEMMA_MODE says otherwise. */
export async function gemmaJson(system: string, user: string): Promise<GemmaResult> {
  const mode = (process.env.GEMMA_MODE ?? "auto").toLowerCase();
  if (mode === "cloud") return tryCloud(system, user);
  if (mode === "local") return tryLocal(system, user);
  try {
    return await tryLocal(system, user);
  } catch (localErr) {
    if (!process.env.GOOGLE_AI_STUDIO_KEY) throw localErr;
    return tryCloud(system, user);
  }
}
