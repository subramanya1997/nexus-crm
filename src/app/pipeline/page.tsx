"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { DealWithHealth } from "@/lib/types";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

const STAGES = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"] as const;

const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const STAGE_COLORS: Record<string, string> = {
  discovery: "border-t-blue-400",
  proposal: "border-t-purple-400",
  negotiation: "border-t-amber-400",
  closed_won: "border-t-emerald-400",
  closed_lost: "border-t-red-400",
};

const HEALTH_DOT: Record<string, string> = {
  healthy: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "No activity";
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealWithHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const fetchDeals = useCallback(() => {
    fetch("/api/deals?include_health=true")
      .then((r) => r.json())
      .then((data: DealWithHealth[]) => {
        setDeals(data);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  const handleDragStart = (dealId: number) => {
    setDraggingId(dealId);
  };

  const handleDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDropTarget(stage);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (draggingId === null) return;

    const deal = deals.find((d) => d.id === draggingId);
    if (!deal || deal.stage === stage) {
      setDraggingId(null);
      return;
    }

    setDeals((prev) =>
      prev.map((d) => (d.id === draggingId ? { ...d, stage: stage as DealWithHealth["stage"] } : d))
    );

    await fetch(`/api/deals/${draggingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });

    setDraggingId(null);
    fetchDeals();
  };

  const totalPipeline = deals
    .filter((d) => !["closed_won", "closed_lost"].includes(d.stage))
    .reduce((sum, d) => sum + d.value, 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-slate-200 rounded w-48" />
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map((s) => (
            <div key={s} className="w-72 shrink-0 bg-white rounded-xl border border-slate-200 h-96" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-500 mt-1">
            {deals.filter((d) => !["closed_won", "closed_lost"].includes(d.stage)).length} active deals &middot; {formatCurrency(totalPipeline)} in pipeline
          </p>
        </div>
        <Link
          href="/deals"
          className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          List View
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 -mx-8 px-8">
        {STAGES.map((stage) => {
          const stageDeals = deals.filter((d) => d.stage === stage);
          const stageValue = stageDeals.reduce((sum, d) => sum + d.value, 0);
          const isOver = dropTarget === stage;

          return (
            <div
              key={stage}
              className={`w-72 shrink-0 flex flex-col rounded-xl border-t-4 ${STAGE_COLORS[stage]} bg-white border border-slate-200 transition-shadow ${
                isOver ? "shadow-lg ring-2 ring-indigo-200" : ""
              }`}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700">{STAGE_LABELS[stage]}</h3>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">
                    {stageDeals.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{formatCurrency(stageValue)}</p>
              </div>

              <div className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => handleDragStart(deal.id)}
                    className={`p-3 rounded-lg border border-slate-100 bg-white hover:shadow-sm cursor-grab active:cursor-grabbing transition-all ${
                      draggingId === deal.id ? "opacity-50 scale-95" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 leading-snug">{deal.title}</p>
                      <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${HEALTH_DOT[deal.health]}`} title={deal.health} />
                    </div>
                    <Link
                      href={`/contacts/${deal.contact_id}`}
                      className="text-xs text-indigo-500 hover:text-indigo-600 font-medium mt-1 inline-block"
                    >
                      {deal.contact_name}
                    </Link>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold text-slate-700">{formatCurrency(deal.value)}</span>
                      <span className="text-[10px] text-slate-400">{relativeTime(deal.last_activity_date)}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{deal.days_in_stage}d in stage</div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className="flex items-center justify-center h-24 text-xs text-slate-300">
                    No deals
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
