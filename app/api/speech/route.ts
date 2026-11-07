import { prepareSpeech, streamSpeech, synthesizeSpeech, SpeechBusyError } from "@/lib/speech/kokoro";
import { parseSpeechRequest, SpeechValidationError } from "@/lib/speech/text";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prepareSpeech();
    return Response.json({ ready: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ready: false }, { status: 503 });
  }
}

export async function POST(request: Request) {
  // Same-origin local demo endpoint. Do not expose synthesis to arbitrary sites.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Use speech from the demo page." }, { status: 403 });
  }
  try {
    const raw = await request.text();
    if (raw.length > 40000) throw new SpeechValidationError("Speech request is too large.");
    const body: unknown = JSON.parse(raw);
    const { text, voice } = parseSpeechRequest(body);
    if ((body as { stream?: unknown }).stream === true) {
      const canceled = new AbortController();
      const signal = AbortSignal.any([request.signal, canceled.signal]);
      const encoder = new TextEncoder();
      const output = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            for await (const chunk of streamSpeech(text, voice, signal)) {
              const audio = Buffer.from(chunk.audio.toWav()).toString("base64");
              controller.enqueue(encoder.encode(JSON.stringify({ text: chunk.text, audio }) + "\n"));
            }
            controller.close();
          } catch {
            if (!signal.aborted) controller.error(new Error("Local speech stream stopped."));
          }
        },
        cancel() { canceled.abort(); },
      });
      return new Response(output, {
        headers: {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store, no-transform",
          "X-Accel-Buffering": "no",
          "X-Speech-Engine": "kokoro-local",
        },
      });
    }
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
