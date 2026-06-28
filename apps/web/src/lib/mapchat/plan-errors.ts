type ProviderStatus = {
  name: string;
  status: string;
  message?: string;
};

export function formatPlanError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "Plan generation failed.";
  const err = (
    payload as {
      error?: { message?: string; details?: { providerStatus?: ProviderStatus[] } };
    }
  ).error;
  const base = err?.message ?? "Plan generation failed.";
  const providers =
    err?.details?.providerStatus?.filter(
      (p) => p.status === "failed" || p.status === "not_configured",
    ) ?? [];
  if (!providers.length) return base;

  const hints = providers.slice(0, 3).map((p) => {
    if (p.name.includes("google-places") && p.message?.includes("blocked")) {
      return "Google Places: enable Places API (New) on your API key in Cloud Console, then restart the dev server.";
    }
    if (p.status === "not_configured") {
      return `${p.name}: ${p.message ?? "not configured"}`;
    }
    const short = p.message?.split("\n")[0]?.slice(0, 100) ?? p.status;
    return `${p.name}: ${short}`;
  });

  return `${base}\n\n${hints.join("\n")}`;
}
