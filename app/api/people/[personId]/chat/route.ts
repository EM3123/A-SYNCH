import { NextResponse } from "next/server";
import { DEMO_REQUESTER_ID } from "@/lib/agents/demo-context";
import { askPerspective, PerspectiveValidationError } from "@/lib/part-b";

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
      history?: unknown;
    };
    const result = await askPerspective({
      question: typeof body.question === "string" ? body.question : "",
      personId,
      history: body.history,
      // Identity is server-resolved in demo mode. Ignore caller-supplied requesterId.
      requesterId: DEMO_REQUESTER_ID,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PerspectiveValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[A-SYNCH] person chat failed", error);
    return NextResponse.json(
      { error: "The context agent could not answer that question" },
      { status: 500 },
    );
  }
}
