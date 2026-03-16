import { NextResponse } from "next/server";
import { getInsights } from "@/lib/intelligence";

export async function GET() {
  const insights = getInsights();
  return NextResponse.json(insights);
}
