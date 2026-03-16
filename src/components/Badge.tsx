interface BadgeProps {
  label: string;
  variant?: "gray" | "blue" | "green" | "yellow" | "red" | "purple" | "indigo";
}

const variantClasses: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-emerald-100 text-emerald-700",
  yellow: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
  indigo: "bg-indigo-100 text-indigo-700",
};

export default function Badge({ label, variant = "gray" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]}`}>
      {label}
    </span>
  );
}

export function statusBadgeVariant(status: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    lead: "blue",
    prospect: "yellow",
    customer: "green",
    churned: "red",
  };
  return map[status] || "gray";
}

export function stageBadgeVariant(stage: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    discovery: "blue",
    proposal: "purple",
    negotiation: "yellow",
    closed_won: "green",
    closed_lost: "red",
  };
  return map[stage] || "gray";
}

export function activityBadgeVariant(type: string): BadgeProps["variant"] {
  const map: Record<string, BadgeProps["variant"]> = {
    call: "green",
    email: "blue",
    meeting: "purple",
    note: "yellow",
  };
  return map[type] || "gray";
}
