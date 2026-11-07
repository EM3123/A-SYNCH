import { askAsynch, AskValidationError } from "@/lib/backend";
import type { AskRequest } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function encodeEvent(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

export async function POST(request: Request) {
  let input: AskRequest;
  try {
    const body = (await request.json()) as Partial<AskRequest>;
    input = {
      question: typeof body.question === "string" ? body.question : "",
      mode: body.mode,
      personId: body.personId,
      requesterId: body.requesterId,
    };
  } catch {
    return Response.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const result = await askAsynch(input, {
          onEvent(event) {
            controller.enqueue(encodeEvent("stage", event));
          },
        });
        controller.enqueue(encodeEvent("result", result));
      } catch (error) {
        const status = error instanceof AskValidationError ? 400 : 500;
        const message =
          error instanceof AskValidationError
            ? error.message
            : "A-SYNCH could not answer that question";
        controller.enqueue(encodeEvent("error", { status, error: message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
