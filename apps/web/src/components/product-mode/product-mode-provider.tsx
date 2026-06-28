"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ProductMode } from "@where2go/schemas";

const STORAGE_KEY = "where2go.productMode";

type ProductModeContextValue = {
  mode: ProductMode;
  setMode: (mode: ProductMode) => void;
};

const ProductModeContext = createContext<ProductModeContextValue | null>(null);

export function ProductModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>("family_day");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "family_day" || stored === "solo_travel") {
      setModeState(stored);
    }
  }, []);

  const setMode = useCallback((next: ProductMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);

  return (
    <ProductModeContext.Provider value={value}>{children}</ProductModeContext.Provider>
  );
}

export function useProductMode() {
  const ctx = useContext(ProductModeContext);
  if (!ctx) throw new Error("useProductMode must be used within ProductModeProvider");
  return ctx;
}
