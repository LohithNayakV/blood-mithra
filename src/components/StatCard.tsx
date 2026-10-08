import type { ReactNode } from "react";

export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = "red",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  accent?: "red" | "green" | "blue" | "amber" | "gray";
}) {
  const accentBg: Record<string, string> = {
    red: "var(--bm-red-soft)",
    green: "var(--bm-green-soft)",
    blue: "var(--bm-blue-soft)",
    amber: "var(--bm-amber-soft)",
    gray: "#f2f4f7",
  };
  return (
    <div className="bm-stat-card">
      <div className="flex items-start justify-between gap-3">
        <span className="bm-stat-label">{label}</span>
        {icon ? (
          <span
            className="bm-stat-icon"
            style={{ background: accentBg[accent] }}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="bm-stat-value">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}
