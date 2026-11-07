export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function extractTextContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  return "";
}

function parseJsonObject<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1)) as T;
    }
    throw new OpenRouterError("OpenRouter returned non-JSON content");
  }
}

export async function callOpenRouterJson<T>(options: {
  messages: OpenRouterMessage[];
  timeoutMs?: number;
}): Promise<{ data: T; model: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new OpenRouterError("OPENROUTER_API_KEY is not configured");

  const model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 18_000);

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "A-SYNCH Nova Hackathon",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new OpenRouterError(
        `OpenRouter request failed: ${errorText.slice(0, 300)}`,
        response.status,
      );
    }

    const payload = (await response.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const raw = extractTextContent(payload.choices?.[0]?.message?.content);
    if (!raw) throw new OpenRouterError("OpenRouter returned an empty response");

    return { data: parseJsonObject<T>(raw), model: payload.model || model };
  } catch (error) {
    if (error instanceof OpenRouterError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError("OpenRouter request timed out");
    }
    throw new OpenRouterError(error instanceof Error ? error.message : "OpenRouter failed");
  } finally {
    clearTimeout(timer);
  }
}
