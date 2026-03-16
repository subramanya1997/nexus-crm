import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Contact } from "@/lib/types";

export async function GET(request: NextRequest) {
  const db = getDb();
  const { searchParams } = request.nextUrl;
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";

  let query = `
    SELECT c.*,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.contact_id = c.id) as last_activity_date,
      (SELECT COUNT(*) FROM activities a WHERE a.contact_id = c.id) as activity_count,
      (SELECT COUNT(*) FROM activities a WHERE a.contact_id = c.id AND a.created_at >= datetime('now', '-30 days')) as recent_count
    FROM contacts c WHERE 1=1
  `;
  const params: string[] = [];

  if (search) {
    query += " AND (c.name LIKE ? OR c.email LIKE ? OR c.company LIKE ?)";
    const like = `%${search}%`;
    params.push(like, like, like);
  }

  if (status) {
    query += " AND c.status = ?";
    params.push(status);
  }

  query += " ORDER BY c.created_at DESC";

  const contacts = db.prepare(query).all(...params);
  return NextResponse.json(contacts);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { name, email, phone, company, status } = body as Partial<Contact>;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const result = db
    .prepare("INSERT INTO contacts (name, email, phone, company, status) VALUES (?, ?, ?, ?, ?)")
    .run(name, email, phone || "", company || "", status || "lead");

  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(result.lastInsertRowid) as Contact;
  return NextResponse.json(contact, { status: 201 });
}
