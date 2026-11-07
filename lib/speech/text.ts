import { DEFAULT_VOICE, isKokoroVoice, MAX_SPEECH_CHARACTERS, type KokoroVoice } from "./config";

export class SpeechValidationError extends Error {}

export function parseSpeechRequest(body: unknown): { text: string; voice: KokoroVoice } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new SpeechValidationError("Send a text and a supported generic voice.");
  }
  const { text, voice = DEFAULT_VOICE } = body as Record<string, unknown>;
  if (typeof text !== "string" || !text.trim() || text.length > MAX_SPEECH_CHARACTERS) {
    throw new SpeechValidationError(`Speech text must contain 1–${MAX_SPEECH_CHARACTERS} characters.`);
  }
  if (!isKokoroVoice(voice)) throw new SpeechValidationError("Unsupported speech voice.");
  return { text: text.trim(), voice };
}

// Sentence-sized inputs let playback start before the full reply is generated.
// Bound each input well below Kokoro's phoneme/token window. Never silently
// truncate the end of a verified answer (especially an authority disclaimer).
export function speechChunks(text: string): string[] {
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining) {
    // Front-load a short phrase even if the first sentence is unusually long.
    const limit = chunks.length === 0 ? 80 : 160;
    const prefix = remaining.slice(0, limit);
    const sentenceEnd = [...prefix.matchAll(/[.!?](?=\s|$)/g)].find((match) => match.index >= 20)?.index ?? -1;
    const wordEnd = prefix.lastIndexOf(" ");
    const end = sentenceEnd >= 0 ? sentenceEnd + 1 : remaining.length <= limit ? remaining.length : wordEnd > 0 ? wordEnd : limit;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  return chunks;
}
