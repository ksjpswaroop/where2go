"use client";

import {
  APILoadingStatus,
  useApiLoadingStatus,
} from "@vis.gl/react-google-maps";
import { Loader2 } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type MapKeyErrorKind = "auth" | "api_target" | "referrer" | "unknown";

type MapLoadError = {
  kind: MapKeyErrorKind;
  detail: string;
};

function classifyMapError(message: string): MapKeyErrorKind {
  const lower = message.toLowerCase();
  if (lower.includes("apitargetblocked")) return "api_target";
  if (lower.includes("referernotallowed")) return "referrer";
  if (lower.includes("invalidkey") || lower.includes("auth")) return "auth";
  return "unknown";
}

type MapErrorContextValue = {
  error: MapLoadError | null;
  reportError: (detail: string) => void;
  clearError: () => void;
};

const MapErrorContext = createContext<MapErrorContextValue | null>(null);

export function MapErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<MapLoadError | null>(null);

  const reportError = useCallback((detail: string) => {
    setError({ kind: classifyMapError(detail), detail });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ error, reportError, clearError }),
    [error, reportError, clearError],
  );

  return <MapErrorContext.Provider value={value}>{children}</MapErrorContext.Provider>;
}

export function useMapError() {
  const ctx = useContext(MapErrorContext);
  if (!ctx) throw new Error("useMapError must be used within MapErrorProvider");
  return ctx;
}

/** Hooks Google auth failure + window errors; must render inside APIProvider. */
export function MapErrorBridge() {
  const { reportError } = useMapError();

  useEffect(() => {
    const win = window as Window & { gm_authFailure?: () => void };
    const previousAuthFailure = win.gm_authFailure;
    win.gm_authFailure = () => {
      reportError("Google Maps authentication failed (gm_authFailure).");
      previousAuthFailure?.();
    };

    const onWindowError = (event: ErrorEvent) => {
      const message = event.message ?? "";
      if (message.includes("Google Maps") || message.includes("ApiTargetBlocked")) {
        reportError(message);
      }
    };

    const previousConsoleError = console.error;
    console.error = (...args: unknown[]) => {
      const text = args.map(String).join(" ");
      if (text.includes("Google Maps JavaScript API error")) {
        reportError(text);
        return;
      }
      previousConsoleError(...args);
    };

    window.addEventListener("error", onWindowError);
    return () => {
      win.gm_authFailure = previousAuthFailure;
      window.removeEventListener("error", onWindowError);
      console.error = previousConsoleError;
    };
  }, [reportError]);

  return null;
}

export function MapKeyErrorHelp({ kind, detail }: { kind: MapKeyErrorKind; detail?: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md w-full rounded-xl border border-amber-200 bg-white p-5 shadow-lg">
        <h2 className="text-sm font-bold text-amber-700">Map could not load</h2>
        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          <strong>ApiTargetBlockedMapError</strong> means your API key is not allowed to use{" "}
          <strong>Maps JavaScript API</strong>. Fix this in Google Cloud Console — it cannot be
          resolved in app code alone.
        </p>

        {detail ? (
          <pre className="mt-2 max-h-20 overflow-auto rounded bg-slate-50 p-2 text-[10px] text-slate-500 whitespace-pre-wrap">
            {detail}
          </pre>
        ) : null}

        <ol className="mt-3 space-y-2 text-xs text-slate-600 list-decimal pl-4">
          <li>
            <a
              href="https://console.cloud.google.com/apis/library/maps-backend.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Enable Maps JavaScript API
            </a>{" "}
            for your project
          </li>
          <li>
            Open{" "}
            <a
              href="https://console.cloud.google.com/google/maps-apis/credentials"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline"
            >
              Credentials
            </a>
            , edit your browser key → <strong>API restrictions</strong> → add{" "}
            <strong>Maps JavaScript API</strong>
          </li>
          <li>
            <strong>Application restrictions</strong> → HTTP referrers:{" "}
            <code>{origin}/*</code>, <code>http://localhost:3000/*</code>
          </li>
          {kind === "api_target" ? (
            <li className="text-amber-700">
              Do not use a server-only key (IP restricted). Browser keys need HTTP referrer rules.
            </li>
          ) : null}
          <li>Enable billing, save, wait 2 min, restart <code>npm run dev</code></li>
        </ol>
      </div>
    </div>
  );
}

export function MapPanelStatus() {
  const status = useApiLoadingStatus();
  const { error } = useMapError();

  if (status === APILoadingStatus.LOADING || status === APILoadingStatus.NOT_LOADED) {
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading map…
        </div>
      </div>
    );
  }

  if (
    error ||
    status === APILoadingStatus.AUTH_FAILURE ||
    status === APILoadingStatus.FAILED
  ) {
    return (
      <MapKeyErrorHelp
        kind={error?.kind ?? "auth"}
        detail={
          error?.detail ??
          (status === APILoadingStatus.AUTH_FAILURE
            ? "Maps API authentication failed."
            : "Maps API failed to load.")
        }
      />
    );
  }

  return null;
}
