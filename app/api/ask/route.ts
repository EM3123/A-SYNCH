import { NextResponse } from "next/server";
import { askAsynch, AskValidationError } from "@/lib/backend";
import type { AskRequest } from "@/lib/contracts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<AskRequest>;
    const result = await askAsynch({
      question: typeof body.question === "string" ? body.question : "",
      mode: body.mode,
      personId: body.personId,
      requesterId: body.requesterId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AskValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[A-SYNCH] /api/ask failed", error);
    return NextResponse.json(
      { error: "A-SYNCH could not answer that question" },
      { status: 500 },
    );
  }
}
