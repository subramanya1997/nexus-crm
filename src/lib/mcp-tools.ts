import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import getDb from "./db";
import { getInsights, computeEngagementScore, getPipelineHealth, searchCrm, suggestNextAction } from "./intelligence";

export function createCrmMcpServer(): McpServer {
  const server = new McpServer({
    name: "crm",
    version: "1.0.0",
  });

  // ─── Contacts ──────────────────────────────────────────────────────────────

  server.tool(
    "list_contacts",
    "List all CRM contacts. Optionally filter by search term or status (lead, prospect, customer, churned).",
    {
      search: z.string().optional().describe("Search by name, email, or company"),
      status: z.enum(["lead", "prospect", "customer", "churned"]).optional().describe("Filter by contact status"),
    },
    async ({ search, status }) => {
      const db = getDb();
      let query = "SELECT * FROM contacts WHERE 1=1";
      const params: string[] = [];

      if (search) {
        query += " AND (name LIKE ? OR email LIKE ? OR company LIKE ?)";
        const like = `%${search}%`;
        params.push(like, like, like);
      }
      if (status) {
        query += " AND status = ?";
        params.push(status);
      }
      query += " ORDER BY created_at DESC";

      const contacts = db.prepare(query).all(...params);
      return { content: [{ type: "text" as const, text: JSON.stringify(contacts, null, 2) }] };
    }
  );

  server.tool(
    "get_contact",
    "Get a single contact by ID, including their associated deals and activities.",
    {
      id: z.number().describe("Contact ID"),
    },
    async ({ id }) => {
      const db = getDb();
      const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
      if (!contact) {
        return { content: [{ type: "text" as const, text: `Contact with ID ${id} not found.` }], isError: true };
      }

      const deals = db.prepare("SELECT * FROM deals WHERE contact_id = ? ORDER BY created_at DESC").all(id);
      const activities = db.prepare("SELECT * FROM activities WHERE contact_id = ? ORDER BY created_at DESC").all(id);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ contact, deals, activities }, null, 2) }],
      };
    }
  );

  server.tool(
    "create_contact",
    "Create a new contact in the CRM.",
    {
      name: z.string().describe("Full name of the contact"),
      email: z.string().email().describe("Email address"),
      phone: z.string().optional().describe("Phone number"),
      company: z.string().optional().describe("Company name"),
      status: z.enum(["lead", "prospect", "customer"]).optional().describe("Contact status (defaults to lead)"),
    },
    async ({ name, email, phone, company, status }) => {
      const db = getDb();
      const result = db
        .prepare("INSERT INTO contacts (name, email, phone, company, status) VALUES (?, ?, ?, ?, ?)")
        .run(name, email, phone || "", company || "", status || "lead");

      const contact = db.prepare("SELECT * FROM contacts WHERE id = ?").get(result.lastInsertRowid);
      return { content: [{ type: "text" as const, text: JSON.stringify(contact, null, 2) }] };
    }
  );

  server.tool(
    "update_contact",
    "Update an existing contact's details.",
    {
      id: z.number().describe("Contact ID to update"),
      name: z.string().optional().describe("New name"),
      email: z.string().email().optional().describe("New email"),
      phone: z.string().optional().describe("New phone"),
      company: z.string().optional().describe("New company"),
      status: z.enum(["lead", "prospect", "customer", "churned"]).optional().describe("New status"),
    },
    async ({ id, name, email, phone, company, status }) => {
      const db = getDb();
      const existing = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id) as Record<string, string> | undefined;
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Contact with ID ${id} not found.` }], isError: true };
      }

      db.prepare("UPDATE contacts SET name=?, email=?, phone=?, company=?, status=? WHERE id=?").run(
        name || existing.name,
        email || existing.email,
        phone ?? existing.phone,
        company ?? existing.company,
        status || existing.status,
        id
      );

      const updated = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "delete_contact",
    "Delete a contact and all associated deals and activities.",
    {
      id: z.number().describe("Contact ID to delete"),
    },
    async ({ id }) => {
      const db = getDb();
      const existing = db.prepare("SELECT * FROM contacts WHERE id = ?").get(id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Contact with ID ${id} not found.` }], isError: true };
      }

      db.prepare("DELETE FROM contacts WHERE id = ?").run(id);
      return { content: [{ type: "text" as const, text: `Contact ${id} and all associated data deleted.` }] };
    }
  );

  // ─── Deals ─────────────────────────────────────────────────────────────────

  server.tool(
    "list_deals",
    "List all deals. Optionally filter by stage or contact.",
    {
      stage: z
        .enum(["discovery", "proposal", "negotiation", "closed_won", "closed_lost"])
        .optional()
        .describe("Filter by deal stage"),
      contact_id: z.number().optional().describe("Filter by contact ID"),
    },
    async ({ stage, contact_id }) => {
      const db = getDb();
      let query = `
        SELECT d.*, c.name as contact_name
        FROM deals d JOIN contacts c ON d.contact_id = c.id
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (stage) {
        query += " AND d.stage = ?";
        params.push(stage);
      }
      if (contact_id) {
        query += " AND d.contact_id = ?";
        params.push(contact_id);
      }
      query += " ORDER BY d.created_at DESC";

      const deals = db.prepare(query).all(...params);
      return { content: [{ type: "text" as const, text: JSON.stringify(deals, null, 2) }] };
    }
  );

  server.tool(
    "create_deal",
    "Create a new deal linked to a contact.",
    {
      title: z.string().describe("Deal title"),
      value: z.number().optional().describe("Deal value in dollars"),
      stage: z
        .enum(["discovery", "proposal", "negotiation", "closed_won", "closed_lost"])
        .optional()
        .describe("Deal stage (defaults to discovery)"),
      contact_id: z.number().describe("ID of the associated contact"),
    },
    async ({ title, value, stage, contact_id }) => {
      const db = getDb();
      const contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contact_id);
      if (!contact) {
        return { content: [{ type: "text" as const, text: `Contact ${contact_id} not found.` }], isError: true };
      }

      const result = db
        .prepare("INSERT INTO deals (title, value, stage, contact_id) VALUES (?, ?, ?, ?)")
        .run(title, value || 0, stage || "discovery", contact_id);

      const deal = db
        .prepare("SELECT d.*, c.name as contact_name FROM deals d JOIN contacts c ON d.contact_id = c.id WHERE d.id = ?")
        .get(result.lastInsertRowid);

      return { content: [{ type: "text" as const, text: JSON.stringify(deal, null, 2) }] };
    }
  );

  server.tool(
    "update_deal",
    "Update a deal's title, value, stage, or contact.",
    {
      id: z.number().describe("Deal ID to update"),
      title: z.string().optional().describe("New title"),
      value: z.number().optional().describe("New value"),
      stage: z
        .enum(["discovery", "proposal", "negotiation", "closed_won", "closed_lost"])
        .optional()
        .describe("New stage"),
      contact_id: z.number().optional().describe("New contact ID"),
    },
    async ({ id, title, value, stage, contact_id }) => {
      const db = getDb();
      const existing = db.prepare("SELECT * FROM deals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Deal with ID ${id} not found.` }], isError: true };
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
        .get(id);

      return { content: [{ type: "text" as const, text: JSON.stringify(updated, null, 2) }] };
    }
  );

  server.tool(
    "delete_deal",
    "Delete a deal by ID.",
    {
      id: z.number().describe("Deal ID to delete"),
    },
    async ({ id }) => {
      const db = getDb();
      const existing = db.prepare("SELECT * FROM deals WHERE id = ?").get(id);
      if (!existing) {
        return { content: [{ type: "text" as const, text: `Deal with ID ${id} not found.` }], isError: true };
      }

      db.prepare("DELETE FROM deals WHERE id = ?").run(id);
      return { content: [{ type: "text" as const, text: `Deal ${id} deleted.` }] };
    }
  );

  // ─── Activities ────────────────────────────────────────────────────────────

  server.tool(
    "list_activities",
    "List activity logs. Optionally filter by contact or type (call, email, meeting, note).",
    {
      contact_id: z.number().optional().describe("Filter by contact ID"),
      type: z.enum(["call", "email", "meeting", "note"]).optional().describe("Filter by activity type"),
      limit: z.number().optional().describe("Max number of results (default 50)"),
    },
    async ({ contact_id, type, limit }) => {
      const db = getDb();
      let query = `
        SELECT a.*, c.name as contact_name
        FROM activities a JOIN contacts c ON a.contact_id = c.id
        WHERE 1=1
      `;
      const params: (string | number)[] = [];

      if (contact_id) {
        query += " AND a.contact_id = ?";
        params.push(contact_id);
      }
      if (type) {
        query += " AND a.type = ?";
        params.push(type);
      }
      query += " ORDER BY a.created_at DESC LIMIT ?";
      params.push(limit || 50);

      const activities = db.prepare(query).all(...params);
      return { content: [{ type: "text" as const, text: JSON.stringify(activities, null, 2) }] };
    }
  );

  server.tool(
    "log_activity",
    "Log a new activity (call, email, meeting, or note) for a contact.",
    {
      type: z.enum(["call", "email", "meeting", "note"]).describe("Activity type"),
      description: z.string().describe("Description of the activity"),
      contact_id: z.number().describe("ID of the associated contact"),
      deal_id: z.number().optional().describe("Optional deal ID to link this activity to"),
    },
    async ({ type, description, contact_id, deal_id }) => {
      const db = getDb();
      const contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contact_id);
      if (!contact) {
        return { content: [{ type: "text" as const, text: `Contact ${contact_id} not found.` }], isError: true };
      }

      if (deal_id) {
        const deal = db.prepare("SELECT id FROM deals WHERE id = ?").get(deal_id);
        if (!deal) {
          return { content: [{ type: "text" as const, text: `Deal ${deal_id} not found.` }], isError: true };
        }
      }

      const result = db
        .prepare("INSERT INTO activities (type, description, contact_id, deal_id) VALUES (?, ?, ?, ?)")
        .run(type, description, contact_id, deal_id || null);

      const activity = db
        .prepare("SELECT a.*, c.name as contact_name FROM activities a JOIN contacts c ON a.contact_id = c.id WHERE a.id = ?")
        .get(result.lastInsertRowid);

      return { content: [{ type: "text" as const, text: JSON.stringify(activity, null, 2) }] };
    }
  );

  // ─── Dashboard / Stats ────────────────────────────────────────────────────

  server.tool(
    "get_dashboard_stats",
    "Get CRM dashboard statistics: total contacts, total deals, pipeline value, won revenue, deals by stage, and recent activities.",
    {},
    async () => {
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

      const recentActivities = db
        .prepare(
          `SELECT a.*, c.name as contact_name
           FROM activities a JOIN contacts c ON a.contact_id = c.id
           ORDER BY a.created_at DESC LIMIT 5`
        )
        .all();

      const dealsByStage = db
        .prepare(
          `SELECT stage, COUNT(*) as count, COALESCE(SUM(value), 0) as value
           FROM deals GROUP BY stage ORDER BY stage`
        )
        .all();

      const stats = {
        total_contacts: totalContacts,
        total_deals: totalDeals,
        total_pipeline_value: pipelineValue,
        won_deals_value: wonValue,
        recent_activities: recentActivities,
        deals_by_stage: dealsByStage,
      };

      return { content: [{ type: "text" as const, text: JSON.stringify(stats, null, 2) }] };
    }
  );

  // ─── Intelligence / AI Tools ──────────────────────────────────────────────

  server.tool(
    "search_crm",
    "Full-text search across contacts, deals, and activities. Returns matching results with links.",
    {
      query: z.string().describe("Search query to match against names, emails, companies, deal titles, and activity descriptions"),
    },
    async ({ query }) => {
      const results = searchCrm(query);
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "get_insights",
    "Get AI-computed insights about the CRM: stale deals needing attention, hot leads with high engagement, at-risk deals in negotiation too long, and contacts needing follow-up.",
    {},
    async () => {
      const insights = getInsights();
      return { content: [{ type: "text" as const, text: JSON.stringify(insights, null, 2) }] };
    }
  );

  server.tool(
    "get_contact_engagement",
    "Get a contact's engagement score (0-100), engagement factors, and a human-readable summary of their relationship status.",
    {
      contact_id: z.number().describe("Contact ID to analyze"),
    },
    async ({ contact_id }) => {
      const db = getDb();
      const contact = db.prepare("SELECT id FROM contacts WHERE id = ?").get(contact_id);
      if (!contact) {
        return { content: [{ type: "text" as const, text: `Contact ${contact_id} not found.` }], isError: true };
      }
      const engagement = computeEngagementScore(contact_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(engagement, null, 2) }] };
    }
  );

  server.tool(
    "get_pipeline_health",
    "Get pipeline health metrics: total value, deal count, average deal age, velocity, win rate, per-stage breakdowns, and conversion rates between stages.",
    {},
    async () => {
      const health = getPipelineHealth();
      return { content: [{ type: "text" as const, text: JSON.stringify(health, null, 2) }] };
    }
  );

  server.tool(
    "get_stale_deals",
    "Get deals that have had no activity in 14+ days and need immediate attention. Returns deal details with days since last activity.",
    {},
    async () => {
      const insights = getInsights();
      const staleDeals = insights.filter(i => i.type === "stale_deal" || i.type === "at_risk_deal");
      return { content: [{ type: "text" as const, text: JSON.stringify(staleDeals, null, 2) }] };
    }
  );

  server.tool(
    "suggest_next_action",
    "Get a suggested next action for a contact based on their activity history, deal stages, and engagement level. Returns an action, reason, and priority.",
    {
      contact_id: z.number().describe("Contact ID to get a suggestion for"),
    },
    async ({ contact_id }) => {
      const suggestion = suggestNextAction(contact_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(suggestion, null, 2) }] };
    }
  );

  return server;
}
