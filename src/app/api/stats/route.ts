import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import type { Activity, DashboardStats } from "@/lib/types";

export async function GET() {
  const db = getDb();

  const totalContacts = (db.prepare("SELECT COUNT(*) as c FROM contacts").get() as { c: number }).c;
  const totalDeals = (db.prepare("SELECT COUNT(*) as c FROM deals").get() as { c: number }).c;

  const pipelineValue = (
    db
      .prepare("SELECT COALESCE(SUM(value), 0) as v FROM deals WHERE stage NOT IN ('closed_won','closed_lost')")
      .get() as { v: number }
  ).v;

  const wonValue = (
    db.prepare("SELECT COALESCE(SUM(value), 0) as v FROM deals WHERE stage = 'closed_won'").get() as { v: number }
  ).v;

  const wonCount = (db.prepare("SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_won'").get() as { c: number }).c;
  const lostCount = (db.prepare("SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_lost'").get() as { c: number }).c;

  const avgDealSize = totalDeals > 0
    ? (db.prepare("SELECT AVG(value) as v FROM deals").get() as { v: number }).v
    : 0;

  const avgDaysToClose = (db.prepare(`
    SELECT AVG(julianday(created_at) - julianday(
      (SELECT MIN(a.created_at) FROM activities a WHERE a.deal_id = deals.id)
    )) as avg_days
    FROM deals WHERE stage IN ('closed_won', 'closed_lost')
  `).get() as { avg_days: number | null }).avg_days ?? 0;

  const recentActivities = db
    .prepare(
      `SELECT a.*, c.name as contact_name
       FROM activities a JOIN contacts c ON a.contact_id = c.id
       ORDER BY a.created_at DESC LIMIT 5`
    )
    .all() as Activity[];

  const dealsByStage = db
    .prepare(
      `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value
       FROM deals GROUP BY stage ORDER BY stage`
    )
    .all() as { stage: string; count: number; value: number }[];

  const stats: DashboardStats = {
    total_contacts: totalContacts,
    total_deals: totalDeals,
    total_pipeline_value: pipelineValue,
    won_deals_value: wonValue,
    won_deals_count: wonCount,
    lost_deals_count: lostCount,
    avg_deal_size: Math.round(avgDealSize),
    avg_days_to_close: Math.round(avgDaysToClose),
    recent_activities: recentActivities,
    deals_by_stage: dealsByStage,
  };

  return NextResponse.json(stats);
}
