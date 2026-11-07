import { synthesizeSpeech, SpeechBusyError } from "@/lib/speech/kokoro";
import { parseSpeechRequest, SpeechValidationError } from "@/lib/speech/text";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Same-origin local demo endpoint. Do not expose synthesis to arbitrary sites.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Use speech from the demo page." }, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 40000) throw new SpeechValidationError("Speech request is too large.");
    const { text, voice } = parseSpeechRequest(JSON.parse(raw));
    const wav = await synthesizeSpeech(text, voice, request.signal);
    return new Response(wav, {
      headers: {
        "Content-Type": "audio/wav",
        "Cache-Control": "no-store",
        "X-Speech-Engine": "kokoro-local",
        "X-Speech-Voice": voice,
      },
    });
  } catch (error) {
    if (error instanceof SpeechValidationError || error instanceof SyntaxError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpeechBusyError) {
      return Response.json({ error: error.message }, { status: 429, headers: { "Retry-After": "3" } });
    }
    // Never log the speech text or save conversation audio.
    console.error("[A-SYNCH] local speech unavailable", error instanceof Error ? error.name : "Error");
    return Response.json({ error: "Local voice unavailable. Use browser speech." }, { status: 503 });
  }
}
