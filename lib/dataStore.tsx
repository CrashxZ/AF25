// lib/dataStore.tsx
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { generateMockData } from "@/lib/mockData";

/**
 * Centralized client-side data store:
 * - Keeps a rolling log of snapshots (persisted to localStorage)
 * - Provides per-UE history
 * - Single stream source so tabs don't reset on navigation
 * - Easy to swap to real API later (setDataMode('api'))
 */

type Downlink = {
  cqi: number;
  ri: number;
  mcs: number;
  bitrate: number;
  packets_ok: number;
  packets_nok: number;
  drop_rate: number;
  buffer_status: number;
};
type Uplink = {
  pusch_sinr: number;
  rsrp: number;
  ri: number;
  mcs: number;
  bitrate: number;
  packets_ok: number;
  packets_nok: number;
  drop_rate: number;
  bsr: number;
  timing_advance: number;
  phr: number;
};
export type UE = {
  pci: number;
  rnti: number;
  downlink: Downlink;
  uplink: Uplink;
};

export type Snapshot = {
  timestamp: number;
  source: "srsRAN" | "OAI" | string;
  ues: UE[];
};

type DataMode = "mock" | "api"; // mock = generateMockData(), api = fetch('/api/data')
const LOCAL_KEY = "ran_snapshots_v1";
const MAX_SNAPSHOTS = 500; // keep it light for hackathon/demo

type StoreShape = {
  mode: DataMode;
  setDataMode: (m: DataMode) => void;
  snapshots: Snapshot[];
  latest?: Snapshot;
  ueHistory: (rnti: number, limit?: number) => UE[];
  pushSnapshot: (s: Snapshot) => void; // for teammates to POST directly if needed
  clear: () => void; // quick reset during demo
};

const DataStoreCtx = createContext<StoreShape | null>(null);

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<DataMode>("mock");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Load persisted log on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) {
        const parsed: Snapshot[] = JSON.parse(raw);
        setSnapshots(parsed.slice(-MAX_SNAPSHOTS));
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist on change
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
    } catch {
      // ignore
    }
  }, [snapshots]);

  // Single polling loop for the whole app
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      let s: Snapshot;
      if (mode === "mock") {
        s = generateMockData() as Snapshot;
      } else {
        // swap to your backend endpoint when ready
        // const res = await fetch("/api/data", { cache: "no-store" });
        // s = await res.json();
        s = generateMockData() as Snapshot; // fallback until API is plugged
      }
      setSnapshots((prev) => [...prev.slice(-MAX_SNAPSHOTS + 1), s]);
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [mode]);

  const latest = snapshots[snapshots.length - 1];

  // Per-UE rolling history built on the fly (cheap for small MAX_SNAPSHOTS)
  const historyIndex = useMemo(() => {
    const map = new Map<number, UE[]>();
    for (const snap of snapshots) {
      for (const ue of snap.ues) {
        const arr = map.get(ue.rnti) ?? [];
        arr.push(ue);
        map.set(ue.rnti, arr);
      }
    }
    return map;
  }, [snapshots]);

  const value: StoreShape = {
    mode,
    setDataMode: (m) => setMode(m),
    snapshots,
    latest,
    ueHistory: (rnti, limit = 50) => (historyIndex.get(rnti) ?? []).slice(-limit),
    pushSnapshot: (s) => setSnapshots((prev) => [...prev.slice(-MAX_SNAPSHOTS + 1), s]),
    clear: () => setSnapshots([])
  };

  return <DataStoreCtx.Provider value={value}>{children}</DataStoreCtx.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreCtx);
  if (!ctx) {
    throw new Error("useDataStore must be used within <DataStoreProvider />");
  }
  return ctx;
}