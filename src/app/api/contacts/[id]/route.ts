import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Contact, Deal, Activity } from "@/lib/types";
import { computeEngagementScore } from "@/lib/intelligence";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact | undefined;

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const deals = db.prepare("SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC").all(id) as Deal[];
  const activities = db
    .prepare("SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC")
    .all(id) as Activity[];

  const engagement = computeEngagementScore(contact.id);

  return NextResponse.json({ contact, deals, activities, engagement });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { name, email, phone, company, status } = body as Partial<Contact>;

  const existing = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  db.prepare("UPDATE contacts SET name=?, email=?, phone=?, company=?, status=? WHERE id=?").run(
    name || existing.name,
    email || existing.email,
    phone ?? existing.phone,
    company ?? existing.company,
    status || existing.status,
    id
  );

  const updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact;
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Contact | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
