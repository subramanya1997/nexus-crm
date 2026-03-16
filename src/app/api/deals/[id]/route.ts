import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Deal } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { title, value, stage, contact_id } = body as Partial<Deal>;

  const existing = db.prepare("SELECT * FROM deals WHERE id = ?").get(id) as Deal | undefined;
  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  db.prepare("UPDATE deals SET title=?, value=?, stage=?, contact_id=? WHERE id=?").run(
    title || existing.title,
    value ?? existing.value,
    stage || existing.stage,
    contact_id || existing.contact_id,
    id
  );

  const updated = db
    .prepare("SELECT d.*, c.name as contact_name FROM deals d JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?")
    .get(id) as Deal;

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const existing = db.prepare("SELECT * FROM deals WHERE id = ?").get(id) as Deal | undefined;

  if (!existing) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  db.prepare("DELETE FROM deals WHERE id = ?").run(id);
  return NextResponse.json({ success: true });
}
