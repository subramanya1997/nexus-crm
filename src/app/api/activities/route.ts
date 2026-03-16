import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Activity } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const contactId = searchParams.get("contact_id") || "";
  const type = searchParams.get("type") || "";
  const limit = searchParams.get("limit") || "50";

  let query = `
    SELECT a.*, c.name as contact_name
    FROM activities a
    JOIN contacts c ON a.contact_id = c.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (contactId) {
    query += " AND a.contact_id = ?";
    params.push(contactId);
  }

  if (type) {
    query += " AND a.type = ?";
    params.push(type);
  }

  query += " ORDER BY a.created_at DESC LIMIT ?";
  params.push(parseInt(limit, 10));

  const activities = db.prepare(query).all(...params) as Activity[];
  return NextResponse.json(activities);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { type, description, contact_id, deal_id } = body as Partial<Activity>;

  if (!type || !description || !contact_id) {
    return NextResponse.json({ error: "Type, description, and contact_id are required" }, { status: 400 });
  }

  const result = db
    .prepare("INSERT INTO activities (type, description, contact_id, deal_id) VALUES (?, ?, ?, ?)")
    .run(type, description, contact_id, deal_id || null);

  const activity = db
    .prepare(
      "SELECT a.*, c.name as contact_name FROM activities a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ?"
    )
    .get(result.lastInsertRowid) as Activity;

  return NextResponse.json(activity, { status: 201 });
}
