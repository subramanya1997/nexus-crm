"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { Deal, Contact } from "@/lib/types";
import Badge, { stageBadgeVariant } from "@/components/Badge";
import Modal from "@/components/Modal";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatStage(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

const STAGES = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

interface DealExtended extends Deal {
  days_in_stage?: number;
  last_activity_date?: string | null;
}

const HEALTH_COLORS: Record<string, string> = {
  healthy: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

function getDealHealth(deal: DealExtended): "healthy" | "warning" | "critical" {
  if (["closed_won", "closed_lost"].includes(deal.stage)) return "healthy";
  if (!deal.last_activity_date) {
    const daysSinceCreated = deal.days_in_stage ?? 0;
    if (daysSinceCreated >= 14) return "critical";
    if (daysSinceCreated >= 7) return "warning";
    return "healthy";
  }
  const daysSince = Math.floor((Date.now() - new Date(deal.last_activity_date).getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince >= 14) return "critical";
  if (daysSince >= 7) return "warning";
  return "healthy";
}

export default function DealsPage() {
  const [deals, setDeals] = useState<DealExtended[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ title: "", value: "", stage: "discovery", contact_id: "" });

  const fetchDeals = useCallback(() => {
    const params = new URLSearchParams();
    if (stageFilter) params.set("stage", stageFilter);
    fetch(`/api/deals?${params}`)
      .then((r) => r.json())
      .then((data: DealExtended[]) => {
        setDeals(data);
        setLoading(false);
      });
  }, [stageFilter]);

  useEffect(() => {
    fetchDeals();
    fetch("/api/contacts")
      .then((r) => r.json())
      .then((data: Contact[]) => setContacts(data));
  }, [fetchDeals]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/deals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        value: parseFloat(form.value) || 0,
        stage: form.stage,
        contact_id: parseInt(form.contact_id, 10),
      }),
    });
    setForm({ title: "", value: "", stage: "discovery", contact_id: "" });
    setModalOpen(false);
    fetchDeals();
  };

  const handleStageChange = async (dealId: number, newStage: string) => {
    await fetch(`/api/deals/${dealId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: newStage }),
    });
    fetchDeals();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this deal?")) return;
    await fetch(`/api/deals/${id}`, { method: "DELETE" });
    fetchDeals();
  };

  const pipelineTotal = deals
    .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deals</h1>
          <p className="text-slate-500 mt-1">
            {deals.length} deals &middot; {formatCurrency(pipelineTotal)} in pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/pipeline"
            className="px-4 py-2.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Kanban
          </Link>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Deal
          </button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setStageFilter("")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            !stageFilter ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        {STAGES.map((stage) => (
          <button
            key={stage}
            onClick={() => setStageFilter(stage)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              stageFilter === stage ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {formatStage(stage)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-16" />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-6"></th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Deal</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stage</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Age</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Activity</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {deals.map((deal) => {
                const health = getDealHealth(deal);
                return (
                  <tr key={deal.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="pl-5 py-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${HEALTH_COLORS[health]}`} title={health} />
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{deal.title}</p>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/contacts/${deal.contact_id}`} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                        {deal.contact_name}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <select
                        value={deal.stage}
                        onChange={(e) => handleStageChange(deal.id, e.target.value)}
                        className="text-xs font-medium px-2 py-1 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>{formatStage(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-sm text-slate-700">
                      {formatCurrency(deal.value)}
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-slate-400">
                      {deal.days_in_stage !== undefined ? `${deal.days_in_stage}d` : "—"}
                    </td>
                    <td className="px-5 py-4 text-right text-xs text-slate-400">
                      {relativeTime(deal.last_activity_date ?? null)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => handleDelete(deal.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {deals.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    No deals found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Deal">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Value ($)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>{formatStage(s)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Contact *</label>
            <select
              required
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            >
              <option value="">Select a contact</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
              Create Deal
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
