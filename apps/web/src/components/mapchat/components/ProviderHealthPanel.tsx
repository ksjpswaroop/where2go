"use client";

import { useEffect, useState } from "react";

type ProviderRow = {
  name: string;
  status: string;
  message?: string;
  latencyMs?: number;
};

type HealthResponse = {
  generatedAt?: string;
  storage?: string;
  providers: ProviderRow[];
};

export function ProviderHealthPanel() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/provider-health")
      .then((res) => res.json())
      .then((payload: HealthResponse) => setHealth(payload))
      .catch(() => setError("Failed to load provider health."));
  }, []);

  const notConfigured = health?.providers.filter((p) => p.status === "not_configured").length ?? 0;

  return (
    <div className="fixed bottom-4 right-4 z-[100] font-sans text-xs">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-slate-600 bg-slate-900/95 px-3 py-1.5 text-slate-300 shadow-lg hover:text-white"
          title="Admin: provider health"
        >
          Admin · {notConfigured ? `${notConfigured} missing keys` : "providers ok"}
        </button>
      ) : (
        <div className="w-80 max-h-96 overflow-auto rounded-xl border border-slate-600 bg-slate-900/95 p-3 text-slate-200 shadow-2xl">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="font-semibold text-white">Provider health</span>
            <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
              Close
            </button>
          </div>
          {error ? <p className="text-red-400">{error}</p> : null}
          {health ? (
            <>
              <p className="mb-2 text-slate-400">
                Storage: {health.storage ?? "unknown"}
                {health.generatedAt ? ` · ${new Date(health.generatedAt).toLocaleTimeString()}` : ""}
              </p>
              <ul className="space-y-1.5">
                {health.providers.map((provider) => (
                  <li key={provider.name} className="rounded border border-slate-700/60 px-2 py-1">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">{provider.name}</span>
                      <span
                        className={
                          provider.status === "ok" || provider.status === "configured"
                            ? "text-emerald-400"
                            : provider.status === "not_configured"
                              ? "text-amber-400"
                              : "text-red-400"
                        }
                      >
                        {provider.status}
                      </span>
                    </div>
                    {provider.message ? (
                      <p className="mt-0.5 text-[10px] text-slate-400">{provider.message}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-slate-400">Loading…</p>
          )}
        </div>
      )}
    </div>
  );
}
