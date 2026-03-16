"use client";

interface EngagementScoreProps {
  score: number;
  label: "high" | "medium" | "low";
  size?: "sm" | "md" | "lg";
}

const COLORS: Record<string, { stroke: string; text: string; bg: string }> = {
  high: { stroke: "stroke-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" },
  medium: { stroke: "stroke-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
  low: { stroke: "stroke-red-500", text: "text-red-600", bg: "bg-red-50" },
};

const SIZES = {
  sm: { width: 48, strokeWidth: 4, fontSize: "text-xs" },
  md: { width: 64, strokeWidth: 5, fontSize: "text-sm" },
  lg: { width: 80, strokeWidth: 6, fontSize: "text-lg" },
};

export default function EngagementScore({ score, label, size = "md" }: EngagementScoreProps) {
  const color = COLORS[label];
  const dim = SIZES[size];
  const radius = (dim.width - dim.strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim.width, height: dim.width }}>
      <svg width={dim.width} height={dim.width} className="-rotate-90">
        <circle
          cx={dim.width / 2}
          cy={dim.width / 2}
          r={radius}
          fill="none"
          strokeWidth={dim.strokeWidth}
          className="stroke-slate-100"
        />
        <circle
          cx={dim.width / 2}
          cy={dim.width / 2}
          r={radius}
          fill="none"
          strokeWidth={dim.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={`${color.stroke} transition-all duration-700`}
        />
      </svg>
      <span className={`absolute ${dim.fontSize} font-bold ${color.text}`}>{score}</span>
    </div>
  );
}
