"use client";
import { METRICS, METRIC_GROUPS } from "@/lib/metrics";
import Tip from "./Tip";

// Grouped stat picker used across the Stats Lab and Chart Studio.
export default function MetricSelect({ label, value, onChange, only }: { label: string; value: string; onChange: (v: string) => void; only?: (k: string) => boolean }) {
  const list = METRICS.filter((m) => !only || only(m.key));
  const tip = list.find((m) => m.key === value)?.tip;
  return (
    <label className="ctl">
      <span className="k muted">{label}{tip ? <Tip term={tip} /> : null}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {METRIC_GROUPS.map((g) => {
          const items = list.filter((m) => m.group === g);
          return items.length ? (
            <optgroup key={g} label={g}>
              {items.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
            </optgroup>
          ) : null;
        })}
      </select>
    </label>
  );
}
