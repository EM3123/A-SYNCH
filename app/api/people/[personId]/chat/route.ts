import { NextResponse } from "next/server";
import { askAsynch, AskValidationError } from "@/lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ personId: string }> },
) {
  try {
    const { personId } = await context.params;
    const body = (await request.json()) as {
      question?: unknown;
      requesterId?: unknown;
    };
    const result = await askAsynch({
      question: typeof body.question === "string" ? body.question : "",
      mode: "person",
      personId,
      requesterId:
        typeof body.requesterId === "string" ? body.requesterId : undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[A-SYNCH] person chat failed", error);
    return NextResponse.json(
      { error: "The context agent could not answer that question" },
      { status: 500 },
    );
  }
}
