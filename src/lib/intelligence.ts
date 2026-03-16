import type { Insight, EngagementScore, PipelineHealth, SearchResult, DealWithHealth, ContactWithActivity } from "./types";
import getDb from "./db";

export function getInsights(): Insight[] {
  const db = getDb();
  const insights: Insight[] = [];
  const now = new Date();

  const staleDeals = db.prepare(`
    SELECT d.id, d.title, d.stage, d.value, d.created_at, c.name as contact_name,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.deal_id = d.id) as last_activity
    FROM deals d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
  `).all() as Array<{
    id: number; title: string; stage: string; value: number;
    created_at: string; contact_name: string; last_activity: string | null;
  }>;

  for (const deal of staleDeals) {
    const lastDate = deal.last_activity ? new Date(deal.last_activity) : new Date(deal.created_at);
    const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 14) {
      insights.push({
        id: `stale_deal_${deal.id}`,
        type: "stale_deal",
        severity: daysSince >= 30 ? "critical" : "warning",
        title: `${deal.title} is stale`,
        description: `No activity in ${daysSince} days. Last touched ${lastDate.toLocaleDateString()}.`,
        entity_type: "deal",
        entity_id: deal.id,
        entity_name: deal.title,
        metadata: { days_since_activity: daysSince, stage: deal.stage, contact_name: deal.contact_name, value: deal.value },
      });
    }
  }

  const hotLeads = db.prepare(`
    SELECT c.id, c.name, c.company, c.status, COUNT(a.id) as activity_count
    FROM contacts c
    JOIN activities a ON a.contact_id = c.id
    WHERE a.created_at >= datetime('now', '-30 days')
    AND c.status IN ('lead', 'prospect')
    GROUP BY c.id
    HAVING COUNT(a.id) >= 3
    ORDER BY activity_count DESC
  `).all() as Array<{
    id: number; name: string; company: string; status: string; activity_count: number;
  }>;

  for (const lead of hotLeads) {
    insights.push({
      id: `hot_lead_${lead.id}`,
      type: "hot_lead",
      severity: "info",
      title: `${lead.name} is highly engaged`,
      description: `${lead.activity_count} activities in the last 30 days. Consider upgrading from ${lead.status}.`,
      entity_type: "contact",
      entity_id: lead.id,
      entity_name: lead.name,
      metadata: { activity_count: lead.activity_count, company: lead.company, status: lead.status },
    });
  }

  const atRiskDeals = db.prepare(`
    SELECT d.id, d.title, d.value, d.created_at, c.name as contact_name,
      CAST(julianday('now') - julianday(d.created_at) AS INTEGER) as days_in_stage,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.deal_id = d.id) as last_activity
    FROM deals d
    JOIN contacts c ON d.contact_id = c.id
    WHERE d.stage = 'negotiation'
    AND julianday('now') - julianday(d.created_at) >= 30
  `).all() as Array<{
    id: number; title: string; value: number; created_at: string;
    contact_name: string; days_in_stage: number; last_activity: string | null;
  }>;

  for (const deal of atRiskDeals) {
    insights.push({
      id: `at_risk_${deal.id}`,
      type: "at_risk_deal",
      severity: "critical",
      title: `${deal.title} may be at risk`,
      description: `In negotiation for ${deal.days_in_stage} days with ${deal.contact_name}. Worth $${deal.value.toLocaleString()}.`,
      entity_type: "deal",
      entity_id: deal.id,
      entity_name: deal.title,
      metadata: { days_in_stage: deal.days_in_stage, value: deal.value, contact_name: deal.contact_name },
    });
  }

  const followUps = db.prepare(`
    SELECT c.id, c.name, c.company, c.status,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.contact_id = c.id) as last_activity
    FROM contacts c
    WHERE c.status IN ('lead', 'prospect')
  `).all() as Array<{
    id: number; name: string; company: string; status: string; last_activity: string | null;
  }>;

  for (const contact of followUps) {
    if (!contact.last_activity) continue;
    const daysSince = Math.floor((now.getTime() - new Date(contact.last_activity).getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince >= 21) {
      insights.push({
        id: `follow_up_${contact.id}`,
        type: "follow_up_needed",
        severity: daysSince >= 30 ? "critical" : "warning",
        title: `Follow up with ${contact.name}`,
        description: `No contact in ${daysSince} days. ${contact.status} at ${contact.company}.`,
        entity_type: "contact",
        entity_id: contact.id,
        entity_name: contact.name,
        metadata: { days_since_contact: daysSince, company: contact.company, status: contact.status },
      });
    }
  }

  insights.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });

  return insights;
}

export function computeEngagementScore(contactId: number): EngagementScore {
  const db = getDb();

  const activityCount = (db.prepare(`
    SELECT COUNT(*) as c FROM activities
    WHERE contact_id = ? AND created_at >= datetime('now', '-30 days')
  `).get(contactId) as { c: number }).c;

  const lastActivity = db.prepare(`
    SELECT MAX(created_at) as last FROM activities WHERE contact_id = ?
  `).get(contactId) as { last: string | null };

  const recencyDays = lastActivity.last
    ? Math.floor((Date.now() - new Date(lastActivity.last).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  const dealStats = db.prepare(`
    SELECT COALESCE(SUM(value), 0) as total_value,
      COUNT(*) as active_deals
    FROM deals
    WHERE contact_id = ? AND stage NOT IN ('closed_won', 'closed_lost')
  `).get(contactId) as { total_value: number; active_deals: number };

  const contact = db.prepare(`SELECT status, created_at FROM contacts WHERE id = ?`).get(contactId) as {
    status: string; created_at: string;
  } | undefined;

  let score = 0;

  const freqScore = Math.min(activityCount * 8, 30);
  score += freqScore;

  let recencyScore = 0;
  if (recencyDays <= 3) recencyScore = 25;
  else if (recencyDays <= 7) recencyScore = 20;
  else if (recencyDays <= 14) recencyScore = 15;
  else if (recencyDays <= 21) recencyScore = 8;
  else recencyScore = 0;
  score += recencyScore;

  const valueScore = Math.min(Math.floor(dealStats.total_value / 10000) * 5, 25);
  score += valueScore;

  const dealCountScore = Math.min(dealStats.active_deals * 5, 20);
  score += dealCountScore;

  score = Math.min(Math.max(score, 0), 100);

  const label: EngagementScore["label"] = score >= 60 ? "high" : score >= 30 ? "medium" : "low";

  const totalActivities = (db.prepare(`SELECT COUNT(*) as c FROM activities WHERE contact_id = ?`).get(contactId) as { c: number }).c;
  const allDeals = db.prepare(`SELECT stage, value FROM deals WHERE contact_id = ?`).all(contactId) as Array<{ stage: string; value: number }>;
  const totalDealValue = allDeals.reduce((s, d) => s + d.value, 0);
  const activeDeals = allDeals.filter(d => !["closed_won", "closed_lost"].includes(d.stage));

  const parts: string[] = [];
  if (contact) {
    const since = new Date(contact.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const statusLabel = contact.status.charAt(0).toUpperCase() + contact.status.slice(1);
    parts.push(`${statusLabel} since ${since}`);
  }
  if (activeDeals.length > 0) {
    const val = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
      activeDeals.reduce((s, d) => s + d.value, 0)
    );
    parts.push(`${activeDeals.length} active deal${activeDeals.length !== 1 ? "s" : ""} worth ${val}`);
  }
  if (recencyDays < 999) {
    const lastAct = db.prepare(`SELECT type FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1`).get(contactId) as { type: string } | undefined;
    parts.push(`Last contacted ${recencyDays === 0 ? "today" : recencyDays === 1 ? "yesterday" : `${recencyDays} days ago`}${lastAct ? ` via ${lastAct.type}` : ""}`);
  }
  parts.push(`${label.charAt(0).toUpperCase() + label.slice(1)} engagement`);

  return {
    score,
    label,
    factors: {
      activity_frequency: activityCount,
      recency_days: recencyDays,
      total_deal_value: totalDealValue,
      active_deals: dealStats.active_deals,
    },
    summary: parts.join(". ") + ".",
  };
}

export function getPipelineHealth(): PipelineHealth {
  const db = getDb();

  const stages = db.prepare(`
    SELECT d.stage,
      COUNT(*) as count,
      COALESCE(SUM(d.value), 0) as value,
      CAST(AVG(julianday('now') - julianday(d.created_at)) AS INTEGER) as avg_age_days
    FROM deals d
    WHERE d.stage NOT IN ('closed_won', 'closed_lost')
    GROUP BY d.stage
    ORDER BY d.stage
  `).all() as Array<{ stage: string; count: number; value: number; avg_age_days: number }>;

  const totalValue = stages.reduce((s, st) => s + st.value, 0);
  const totalDeals = stages.reduce((s, st) => s + st.count, 0);
  const avgAge = totalDeals > 0 ? Math.round(stages.reduce((s, st) => s + st.avg_age_days * st.count, 0) / totalDeals) : 0;

  const wonCount = (db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_won'`).get() as { c: number }).c;
  const lostCount = (db.prepare(`SELECT COUNT(*) as c FROM deals WHERE stage = 'closed_lost'`).get() as { c: number }).c;
  const closedTotal = wonCount + lostCount;
  const winRate = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

  const wonValue = (db.prepare(`SELECT COALESCE(SUM(value), 0) as v FROM deals WHERE stage = 'closed_won'`).get() as { v: number }).v;
  const velocity = avgAge > 0 ? Math.round((wonValue / Math.max(avgAge, 1)) * 30) : 0;

  const stageOrder = ["discovery", "proposal", "negotiation"];
  const conversionRates: PipelineHealth["conversion_rates"] = [];
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const from = stages.find(s => s.stage === stageOrder[i]);
    const to = stages.find(s => s.stage === stageOrder[i + 1]);
    conversionRates.push({
      from_stage: stageOrder[i],
      to_stage: stageOrder[i + 1],
      rate: from && from.count > 0 && to ? Math.round((to.count / from.count) * 100) : 0,
    });
  }

  return { total_value: totalValue, total_deals: totalDeals, avg_deal_age_days: avgAge, velocity, win_rate: winRate, stages, conversion_rates: conversionRates };
}

export function searchCrm(query: string): SearchResult[] {
  const db = getDb();
  const like = `%${query}%`;
  const results: SearchResult[] = [];

  const contacts = db.prepare(`
    SELECT id, name, company, email FROM contacts
    WHERE name LIKE ? OR email LIKE ? OR company LIKE ?
    ORDER BY name LIMIT 10
  `).all(like, like, like) as Array<{ id: number; name: string; company: string; email: string }>;

  for (const c of contacts) {
    results.push({ type: "contact", id: c.id, title: c.name, subtitle: `${c.company} - ${c.email}`, url: `/contacts/${c.id}` });
  }

  const deals = db.prepare(`
    SELECT d.id, d.title, d.value, d.stage, c.name as contact_name
    FROM deals d JOIN contacts c ON d.contact_id = c.id
    WHERE d.title LIKE ? OR c.name LIKE ?
    ORDER BY d.title LIMIT 10
  `).all(like, like) as Array<{ id: number; title: string; value: number; stage: string; contact_name: string }>;

  for (const d of deals) {
    results.push({ type: "deal", id: d.id, title: d.title, subtitle: `${d.contact_name} - $${d.value.toLocaleString()} - ${d.stage}`, url: `/deals` });
  }

  const activities = db.prepare(`
    SELECT a.id, a.type, a.description, c.name as contact_name, a.contact_id
    FROM activities a JOIN contacts c ON a.contact_id = c.id
    WHERE a.description LIKE ? OR c.name LIKE ?
    ORDER BY a.created_at DESC LIMIT 10
  `).all(like, like) as Array<{ id: number; type: string; description: string; contact_name: string; contact_id: number }>;

  for (const a of activities) {
    results.push({ type: "activity", id: a.id, title: `${a.type}: ${a.description.slice(0, 60)}`, subtitle: a.contact_name, url: `/contacts/${a.contact_id}` });
  }

  return results;
}

export function getDealsWithHealth(): DealWithHealth[] {
  const db = getDb();
  const now = new Date();

  const deals = db.prepare(`
    SELECT d.*, c.name as contact_name,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.deal_id = d.id) as last_activity_date
    FROM deals d
    JOIN contacts c ON d.contact_id = c.id
    ORDER BY d.created_at DESC
  `).all() as Array<DealWithHealth & { last_activity_date: string | null }>;

  return deals.map(deal => {
    const daysInStage = Math.floor((now.getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const lastDate = deal.last_activity_date ? new Date(deal.last_activity_date) : new Date(deal.created_at);
    const daysSinceActivity = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

    let health: DealWithHealth["health"] = "healthy";
    if (["closed_won", "closed_lost"].includes(deal.stage)) {
      health = "healthy";
    } else if (daysSinceActivity >= 14) {
      health = "critical";
    } else if (daysSinceActivity >= 7) {
      health = "warning";
    }

    return { ...deal, days_in_stage: daysInStage, health };
  });
}

export function getContactsWithActivity(): ContactWithActivity[] {
  const db = getDb();

  const contacts = db.prepare(`
    SELECT c.*,
      (SELECT MAX(a.created_at) FROM activities a WHERE a.contact_id = c.id) as last_activity_date,
      (SELECT COUNT(*) FROM activities a WHERE a.contact_id = c.id AND a.created_at >= datetime('now', '-30 days')) as recent_count,
      (SELECT COUNT(*) FROM activities a WHERE a.contact_id = c.id) as activity_count
    FROM contacts c
    ORDER BY c.created_at DESC
  `).all() as Array<ContactWithActivity & { recent_count: number }>;

  return contacts.map(c => {
    let engagement_level: ContactWithActivity["engagement_level"] = "low";
    if (c.recent_count >= 3) engagement_level = "high";
    else if (c.recent_count >= 1) engagement_level = "medium";
    return { ...c, engagement_level };
  });
}

export function suggestNextAction(contactId: number): { action: string; reason: string; priority: "high" | "medium" | "low" } {
  const db = getDb();

  const contact = db.prepare(`SELECT * FROM contacts WHERE id = ?`).get(contactId) as {
    id: number; name: string; status: string;
  } | undefined;
  if (!contact) return { action: "Contact not found", reason: "Invalid contact ID", priority: "low" };

  const lastActivity = db.prepare(`
    SELECT type, created_at FROM activities WHERE contact_id = ? ORDER BY created_at DESC LIMIT 1
  `).get(contactId) as { type: string; created_at: string } | undefined;

  const activeDeals = db.prepare(`
    SELECT stage, title, value FROM deals WHERE contact_id = ? AND stage NOT IN ('closed_won', 'closed_lost')
    ORDER BY value DESC
  `).all(contactId) as Array<{ stage: string; title: string; value: number }>;

  const daysSinceContact = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  if (daysSinceContact >= 21) {
    return {
      action: `Send a check-in ${contact.status === "customer" ? "email" : "call"} to ${contact.name}`,
      reason: `No contact in ${daysSinceContact} days`,
      priority: "high",
    };
  }

  if (activeDeals.length > 0) {
    const topDeal = activeDeals[0];
    if (topDeal.stage === "discovery") {
      return { action: `Schedule a discovery call about "${topDeal.title}"`, reason: "Deal is in early discovery stage", priority: "medium" };
    }
    if (topDeal.stage === "proposal") {
      return { action: `Follow up on proposal for "${topDeal.title}"`, reason: "Proposal is pending review", priority: "high" };
    }
    if (topDeal.stage === "negotiation") {
      return { action: `Push for close on "${topDeal.title}" ($${topDeal.value.toLocaleString()})`, reason: "Deal is in active negotiation", priority: "high" };
    }
  }

  if (contact.status === "lead") {
    return { action: `Qualify ${contact.name} and assess fit`, reason: "Contact is still a lead", priority: "medium" };
  }

  return { action: `Log a touchpoint with ${contact.name}`, reason: "Maintain relationship", priority: "low" };
}
