export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  status: "lead" | "prospect" | "customer" | "churned";
  created_at: string;
}

export interface Deal {
  id: number;
  title: string;
  value: number;
  stage: "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  contact_id: number;
  contact_name?: string;
  created_at: string;
}

export interface Activity {
  id: number;
  type: "call" | "email" | "meeting" | "note";
  description: string;
  contact_id: number;
  contact_name?: string;
  deal_id: number | null;
  created_at: string;
}

export interface DashboardStats {
  total_contacts: number;
  total_deals: number;
  total_pipeline_value: number;
  won_deals_value: number;
  won_deals_count: number;
  lost_deals_count: number;
  avg_deal_size: number;
  avg_days_to_close: number;
  recent_activities: Activity[];
  deals_by_stage: { stage: string; count: number; value: number }[];
}

export type InsightSeverity = "info" | "warning" | "critical";
export type InsightType = "stale_deal" | "hot_lead" | "at_risk_deal" | "follow_up_needed";

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  title: string;
  description: string;
  entity_type: "contact" | "deal";
  entity_id: number;
  entity_name: string;
  metadata: Record<string, unknown>;
}

export interface EngagementScore {
  score: number;
  label: "high" | "medium" | "low";
  factors: {
    activity_frequency: number;
    recency_days: number;
    total_deal_value: number;
    active_deals: number;
  };
  summary: string;
}

export interface ContactWithEngagement {
  contact: Contact;
  deals: Deal[];
  activities: Activity[];
  engagement: EngagementScore;
}

export interface SearchResult {
  type: "contact" | "deal" | "activity";
  id: number;
  title: string;
  subtitle: string;
  url: string;
}

export interface PipelineHealth {
  total_value: number;
  total_deals: number;
  avg_deal_age_days: number;
  velocity: number;
  win_rate: number;
  stages: {
    stage: string;
    count: number;
    value: number;
    avg_age_days: number;
  }[];
  conversion_rates: {
    from_stage: string;
    to_stage: string;
    rate: number;
  }[];
}

export interface DealWithHealth extends Deal {
  days_in_stage: number;
  last_activity_date: string | null;
  health: "healthy" | "warning" | "critical";
}

export interface ContactWithActivity extends Contact {
  last_activity_date: string | null;
  activity_count: number;
  engagement_level: "high" | "medium" | "low";
}
