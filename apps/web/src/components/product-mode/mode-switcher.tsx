"use client";

import type { ProductMode } from "@where2go/schemas";
import { useProductMode } from "./product-mode-provider";

const MODES: { id: ProductMode; label: string }[] = [
  { id: "family_day", label: "Family Day" },
  { id: "solo_travel", label: "Solo Travel" },
];

export function ModeSwitcher() {
  const { mode, setMode } = useProductMode();

  return (
    <div
      className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5"
      role="tablist"
      aria-label="Product mode"
    >
      {MODES.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setMode(m.id)}
            className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
              active
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
