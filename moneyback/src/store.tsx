import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { buildSampleState } from "./demo";
import { emptyState, type AppState, type Profile } from "./model";
import { reduce, type Action } from "./workflow";

const STORAGE_KEY = "moneyback.state.v1";

type Store = {
  hydrated: boolean;
  state: AppState;
  dispatch: (action: Action) => void;
  loadSample: (mode: "preview_bank" | "sample_file", phase: AppState["phase"], profile: Profile | null) => void;
};

const AppContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(emptyState());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        try {
          const parsed = JSON.parse(raw) as AppState;
          if (parsed?.phase && Array.isArray(parsed.transactions) && Array.isArray(parsed.opportunities)) {
            setState(parsed);
          }
        } catch {
          setState(emptyState());
        }
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [hydrated, state]);

  const value = useMemo<Store>(
    () => ({
      hydrated,
      state,
      dispatch: (action) => setState((current) => reduce(current, action, new Date().toISOString())),
      loadSample: (mode, phase, profile) => setState(buildSampleState(mode, phase, profile)),
    }),
    [hydrated, state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): Store {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
