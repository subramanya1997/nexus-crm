"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Contact, Deal, Activity, EngagementScore as EngagementScoreType } from "@/lib/types";
import Badge, { statusBadgeVariant, stageBadgeVariant, activityBadgeVariant } from "@/components/Badge";
import EngagementScoreCircle from "@/components/EngagementScore";

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
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

const ACTIVITY_ICONS: Record<string, string> = {
  call: "M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z",
  email: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  meeting: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  note: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
};

interface ContactDetail {
  contact: Contact;
  deals: Deal[];
  activities: Activity[];
  engagement: EngagementScoreType;
}

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", status: "" });

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((d: ContactDetail) => {
        setData(d);
        setForm({
          name: d.contact.name,
          email: d.contact.email,
          phone: d.contact.phone,
          company: d.contact.company,
          status: d.contact.status,
        });
        setLoading(false);
      })
      .catch(() => {
        router.push("/contacts");
      });
  }, [id, router]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/contacts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const updated = (await res.json()) as Contact;
    setData((prev) => (prev ? { ...prev, contact: updated } : prev));
    setEditing(false);
  };

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-4 bg-slate-200 rounded w-32" />
        <div className="bg-white rounded-xl border border-slate-200 p-6 h-32" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 h-64" />
          <div className="bg-white rounded-xl border border-slate-200 p-6 h-64" />
        </div>
      </div>
    );
  }

  const { contact, deals, activities, engagement } = data;
  const totalDealValue = deals.reduce((sum, d) => sum + d.value, 0);
  const activeDeals = deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage));
  const lastActivity = activities.length > 0 ? activities[0] : null;
  const daysSinceContact = lastActivity
    ? Math.floor((Date.now() - new Date(lastActivity.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/contacts" className="hover:text-indigo-600 transition-colors">Contacts</Link>
        <span>/</span>
        <span className="text-slate-900">{contact.name}</span>
      </div>

      {/* Contact Header + Engagement */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        {editing ? (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
                <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                <option value="lead">Lead</option>
                <option value="prospect">Prospect</option>
                <option value="customer">Customer</option>
                <option value="churned">Churned</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">Save Changes</button>
              <button type="button" onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-2xl">
                {contact.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-slate-900">{contact.name}</h1>
                  <Badge label={contact.status} variant={statusBadgeVariant(contact.status)} />
                </div>
                <p className="text-slate-500 mt-0.5">{contact.company}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                  <span>{contact.email}</span>
                  {contact.phone && <span>{contact.phone}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center">
                <EngagementScoreCircle score={engagement.score} label={engagement.label} size="lg" />
                <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-medium">Engagement</span>
              </div>
              <button onClick={() => setEditing(true)} className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Edit
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Summary + Key Metrics */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100 p-5">
        <div className="flex items-center gap-2 mb-3">
          <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          <span className="text-sm font-medium text-indigo-700">AI Summary</span>
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">{engagement.summary}</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalDealValue)}</p>
          <p className="text-xs text-slate-400 mt-1">Total Deal Value</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{activities.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total Interactions</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{daysSinceContact !== null ? `${daysSinceContact}d` : "N/A"}</p>
          <p className="text-xs text-slate-400 mt-1">Since Last Contact</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{activeDeals.length}</p>
          <p className="text-xs text-slate-400 mt-1">Active Deals</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deals */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Deals</h2>
            <span className="text-sm text-slate-500">{formatCurrency(totalDealValue)} total</span>
          </div>
          {deals.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No deals yet</p>
          ) : (
            <div className="space-y-3">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                  <div>
                    <p className="font-medium text-sm text-slate-900">{deal.title}</p>
                    <Badge label={formatStage(deal.stage)} variant={stageBadgeVariant(deal.stage)} />
                  </div>
                  <span className="font-semibold text-sm text-slate-700">{formatCurrency(deal.value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Activity Timeline</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No activities yet</p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity, i) => (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={ACTIVITY_ICONS[activity.type] || ACTIVITY_ICONS.note} />
                      </svg>
                    </div>
                    {i < activities.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2">
                      <Badge label={activity.type} variant={activityBadgeVariant(activity.type)} />
                      <span className="text-xs text-slate-400">{relativeTime(activity.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{activity.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
