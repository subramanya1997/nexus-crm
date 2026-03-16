import { NextResponse } from "next/server";
import { searchCrm } from "@/lib/intelligence";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") || "";

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  const results = searchCrm(query);
  return NextResponse.json(results);
}
