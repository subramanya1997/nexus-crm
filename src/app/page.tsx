"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DashboardStats, Insight } from "@/lib/types";
import Badge, { stageBadgeVariant, activityBadgeVariant } from "@/components/Badge";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatStage(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  critical: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-500", text: "text-red-700" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-500", text: "text-amber-700" },
  info: { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-500", text: "text-blue-700" },
};

const INSIGHT_ICONS: Record<string, string> = {
  stale_deal: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  hot_lead: "M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z",
  at_risk_deal: "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  follow_up_needed: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/insights").then((r) => r.json()),
    ]).then(([statsData, insightsData]: [DashboardStats, Insight[]]) => {
      setStats(statsData);
      setInsights(insightsData);
      setLoading(false);
    });
  }, []);

  if (loading || !stats) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 h-64" />
          <div className="bg-white rounded-xl border border-slate-200 p-6 h-64" />
        </div>
      </div>
    );
  }

  const closedTotal = stats.won_deals_count + stats.lost_deals_count;
  const winRate = closedTotal > 0 ? Math.round((stats.won_deals_count / closedTotal) * 100) : 0;

  const kpis = [
    { label: "Pipeline Value", value: formatCurrency(stats.total_pipeline_value), icon: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6", color: "bg-indigo-50 text-indigo-600", sub: `${stats.total_deals} deals` },
    { label: "Won Revenue", value: formatCurrency(stats.won_deals_value), icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-emerald-50 text-emerald-600", sub: `${stats.won_deals_count} won` },
    { label: "Win Rate", value: `${winRate}%`, icon: "M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z", color: "bg-purple-50 text-purple-600", sub: `${closedTotal} closed` },
    { label: "Avg Deal Size", value: formatCurrency(stats.avg_deal_size), icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", color: "bg-amber-50 text-amber-600", sub: `${stats.total_contacts} contacts` },
  ];

  const stageOrder = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"];
  const orderedStages = stageOrder
    .map((s) => stats.deals_by_stage.find((d) => d.stage === s))
    .filter(Boolean) as DashboardStats["deals_by_stage"];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">AI-powered pipeline overview</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-1.5">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="font-medium">
            {insights.length} insight{insights.length !== 1 ? "s" : ""} detected
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={kpi.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
                <p className="text-xs text-slate-400">{kpi.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Insights Panel */}
      {insights.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
            <h2 className="text-lg font-semibold text-slate-900">AI Insights</h2>
            <span className="ml-auto text-xs text-slate-400">Computed from your CRM data</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.slice(0, 6).map((insight) => {
              const style = SEVERITY_STYLES[insight.severity];
              return (
                <Link
                  key={insight.id}
                  href={insight.entity_type === "contact" ? `/contacts/${insight.entity_id}` : "/deals"}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${style.bg} ${style.border} hover:shadow-sm transition-shadow`}
                >
                  <svg className={`w-5 h-5 shrink-0 mt-0.5 ${style.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={INSIGHT_ICONS[insight.type] || INSIGHT_ICONS.stale_deal} />
                  </svg>
                  <div className="min-w-0">
                    <p className={`text-sm font-medium ${style.text}`}>{insight.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{insight.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline Funnel */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-slate-900">Pipeline Funnel</h2>
            <Link href="/pipeline" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View Kanban &rarr;
            </Link>
          </div>
          <div className="space-y-3">
            {orderedStages.map((item, index) => {
              const maxValue = Math.max(...orderedStages.map((d) => d.value), 1);
              const pct = (item.value / maxValue) * 100;
              const widths = [100, 85, 70, 55, 40];
              const funnelWidth = widths[Math.min(index, widths.length - 1)];

              return (
                <div key={item.stage} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge label={formatStage(item.stage)} variant={stageBadgeVariant(item.stage)} />
                      <span className="text-slate-500">{item.count} deal{item.count !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="font-medium text-slate-700">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="flex justify-center">
                    <div
                      className="h-2.5 bg-slate-100 rounded-full overflow-hidden transition-all duration-500"
                      style={{ width: `${funnelWidth}%` }}
                    >
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-indigo-400 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <Link href="/activities" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              View all &rarr;
            </Link>
          </div>
          <div className="space-y-4">
            {stats.recent_activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Badge label={activity.type} variant={activityBadgeVariant(activity.type)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{activity.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activity.contact_name} &middot; {relativeTime(activity.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
