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
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ProductMode = "family_day" | "solo_travel";

const STORAGE_KEY = "where2go.productMode";

type ProductModeContextValue = {
  mode: ProductMode;
  setMode: (mode: ProductMode) => void;
  isSoloTravel: boolean;
};

const ProductModeContext = createContext<ProductModeContextValue | null>(null);

export function ProductModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ProductMode>("solo_travel");

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "family_day" || stored === "solo_travel") {
        setModeState(stored);
      }
    });
  }, []);

  const setMode = useCallback((next: ProductMode) => {
    setModeState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ mode, setMode, isSoloTravel: mode === "solo_travel" }),
    [mode, setMode],
  );

  return (
    <ProductModeContext.Provider value={value}>{children}</ProductModeContext.Provider>
  );
}

export function useProductMode() {
  const ctx = useContext(ProductModeContext);
  if (!ctx) throw new Error("useProductMode must be used within ProductModeProvider");
  return ctx;
}
