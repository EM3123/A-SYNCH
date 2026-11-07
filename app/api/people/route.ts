import { NextResponse } from "next/server";
import { listPeople } from "@/lib/backend";

export function GET() {
  return NextResponse.json({ people: listPeople() });
}
