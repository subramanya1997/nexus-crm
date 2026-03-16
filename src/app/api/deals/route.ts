import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Deal } from "@/lib/types";
import { getDealsWithHealth } from "@/lib/intelligence";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const includeHealth = searchParams.get("include_health") === "true";

  if (includeHealth) {
    let deals = getDealsWithHealth();
    const stage = searchParams.get("stage") || "";
    if (stage) deals = deals.filter((d) => d.stage === stage);
    return NextResponse.json(deals);
  }

  const db = getDb();
  const stage = searchParams.get("stage") || "";
  const contactId = searchParams.get("contact_id") || "";

  let query = `
    SELECT d.*, c.name as contact_name,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.deal_id = d.id) as last_activity_date,
      CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_in_stage
    FROM deals d
    JOIN contacts c ON d.contact_id = c.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (stage) {
    query += " AND d.stage = ?";
    params.push(stage);
  }

  if (contactId) {
    query += " AND d.contact_id = ?";
    params.push(contactId);
  }

  query += " ORDER BY d.created_at DESC";

  const deals = db.prepare(query).all(...params) as Deal[];
  return NextResponse.json(deals);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { title, value, stage, contact_id } = body as Partial<Deal>;

  if (!title || !contact_id) {
    return NextResponse.json({ error: "Title and contact_id are required" }, { status: 400 });
  }

  const result = db
    .prepare("INSERT INTO deals (title, value, stage, contact_id) VALUES (?, ?, ?, ?)")
    .run(title, value || 0, stage || "discovery", contact_id);

  const deal = db
    .prepare("SELECT d.*, c.name as contact_name FROM deals d JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?")
    .get(result.lastInsertRowid) as Deal;

  return NextResponse.json(deal, { status: 201 });
}
