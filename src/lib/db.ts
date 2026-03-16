import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const isVercel = !!process.env.VERCEL;
const DB_PATH = isVercel
  ? path.join("/tmp", "crm.db")
  : path.join(process.cwd(), "crm.db");

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initializeDb(db);
  }
  return db;
}

function initializeDb(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'lead' CHECK(status IN ('lead','prospect','customer','churned')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      value REAL NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'discovery' CHECK(stage IN ('discovery','proposal','negotiation','closed_won','closed_lost')),
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('call','email','meeting','note')),
      description TEXT NOT NULL,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const count = database.prepare("SELECT COUNT(*) as c FROM contacts").get() as { c: number };
  if (count.c === 0) {
    seed(database);
  }
}

function seed(database: Database.Database): void {
  const insertContact = database.prepare(
    "INSERT INTO contacts (name, email, phone, company, status, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertDeal = database.prepare(
    "INSERT INTO deals (title, value, stage, contact_id, created_at) VALUES (?, ?, ?, ?, ?)"
  );
  const insertActivity = database.prepare(
    "INSERT INTO activities (type, description, contact_id, deal_id, created_at) VALUES (?, ?, ?, ?, ?)"
  );

  const contacts = [
    ["Alice Johnson", "alice@acmecorp.com", "+1-555-0101", "Acme Corp", "customer", "2025-11-15 09:00:00"],
    ["Bob Martinez", "bob@globex.io", "+1-555-0102", "Globex Inc", "prospect", "2025-12-01 10:30:00"],
    ["Carol Chen", "carol@initech.com", "+1-555-0103", "Initech", "lead", "2026-01-10 14:00:00"],
    ["David Kim", "david@umbrella.co", "+1-555-0104", "Umbrella LLC", "customer", "2025-10-20 08:15:00"],
    ["Eva Rossi", "eva@wayneent.com", "+1-555-0105", "Wayne Enterprises", "prospect", "2026-02-05 11:45:00"],
    ["Frank Okafor", "frank@starkindustries.com", "+1-555-0106", "Stark Industries", "lead", "2026-02-28 16:00:00"],
    ["Grace Tanaka", "grace@oscorp.net", "+1-555-0107", "Oscorp", "churned", "2025-08-12 13:20:00"],
    ["Henry Dubois", "henry@lexcorp.com", "+1-555-0108", "LexCorp", "customer", "2025-09-05 09:45:00"],
  ];

  const seedTx = database.transaction(() => {
    for (const c of contacts) {
      insertContact.run(...c);
    }

    const deals = [
      ["Acme Annual License", 48000, "closed_won", 1, "2025-11-20 10:00:00"],
      ["Globex Platform Deal", 72000, "proposal", 2, "2026-01-05 09:00:00"],
      ["Initech Starter Package", 12000, "discovery", 3, "2026-01-15 11:00:00"],
      ["Umbrella Enterprise Suite", 120000, "closed_won", 4, "2025-11-01 08:00:00"],
      ["Wayne Security Upgrade", 95000, "negotiation", 5, "2026-02-10 14:00:00"],
      ["Stark AI Integration", 200000, "discovery", 6, "2026-03-01 10:00:00"],
      ["Oscorp Renewal", 36000, "closed_lost", 7, "2025-09-01 09:00:00"],
      ["LexCorp Data Platform", 85000, "proposal", 8, "2026-01-20 15:00:00"],
      ["Acme Q2 Expansion", 65000, "negotiation", 1, "2026-02-15 10:30:00"],
      ["Globex Analytics Add-on", 28000, "discovery", 2, "2026-03-02 11:00:00"],
    ];

    for (const d of deals) {
      insertDeal.run(...d);
    }

    const activities = [
      ["call", "Discussed renewal terms for annual license", 1, 1, "2025-11-18 10:00:00"],
      ["email", "Sent proposal deck for platform deal", 2, 2, "2026-01-06 09:30:00"],
      ["meeting", "Intro call to understand requirements", 3, 3, "2026-01-12 14:00:00"],
      ["note", "Customer very happy with current deployment", 4, 4, "2025-12-15 11:00:00"],
      ["call", "Follow-up on security upgrade timeline", 5, 5, "2026-02-12 15:00:00"],
      ["email", "Sent AI integration case studies", 6, 6, "2026-03-02 10:00:00"],
      ["meeting", "Quarterly business review", 1, 1, "2026-01-20 09:00:00"],
      ["email", "Shared updated pricing for analytics add-on", 2, 10, "2026-03-03 11:30:00"],
      ["call", "Discussed contract terms with legal", 5, 5, "2026-02-20 14:00:00"],
      ["note", "Churned due to budget cuts — revisit Q3", 7, 7, "2025-09-15 10:00:00"],
      ["meeting", "Demo of data platform features", 8, 8, "2026-01-25 13:00:00"],
      ["email", "Sent Q2 expansion proposal", 1, 9, "2026-02-16 10:00:00"],
      ["call", "Negotiation call — close to agreement", 5, 5, "2026-03-05 16:00:00"],
      ["note", "Frank interested but needs board approval", 6, 6, "2026-03-04 09:00:00"],
      ["meeting", "Final review of LexCorp data platform scope", 8, 8, "2026-02-28 14:00:00"],
    ];

    for (const a of activities) {
      insertActivity.run(...a);
    }
  });

  seedTx();
}

export default getDb;
