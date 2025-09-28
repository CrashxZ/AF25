// lib/dataStore.tsx
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { generateMockData } from "@/lib/mockData";

/**
 * Centralized client-side data store (persistent & tab-safe)
 *
 * Changes in this version:
 * - `clear()` now FLUSHES local history **and** switches to API mode to avoid auto-generating mock data.
 *   This means after clearing, no new data appears unless your endpoint posts/transmits again.
 * - Exposes `latestSource` and `lastReceivedAt` so the UI can display data source (srsRAN/OAI)
 *   and "time since last transmission".
 * - Defaults to your Vercel route `/api/ingest` for API mode.
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

type DataMode = "mock" | "api";

const LS_KEY_SNAPSHOTS = "ran_snapshots_v1";
const LS_KEY_MODE = "ran_mode_v1";
const LS_KEY_ENDPOINT = "ran_endpoint_v1";
const MAX_SNAPSHOTS = 1000;

type StoreShape = {
  mode: DataMode;
  setDataMode: (m: DataMode) => void;
  endpoint: string;
  setEndpoint: (url: string) => void;
  snapshots: Snapshot[];
  latest?: Snapshot;
  latestSource: string | null;
  lastReceivedAt: number | null;
  ueHistory: (rnti: number, limit?: number) => UE[];
  pushSnapshot: (s: Snapshot) => void;
  clear: () => void;
};

const DataStoreCtx = createContext<StoreShape | null>(null);

export function DataStoreProvider({ children }: { children: React.ReactNode }) {
  const defaultEndpoint = "/api/ingest";

  // Prefer API by default (so clearing doesn't restart mock unless explicitly chosen)
  const [mode, setMode] = useState<DataMode>(() => {
    if (typeof window === "undefined") return "api";
    return ((localStorage.getItem(LS_KEY_MODE) as DataMode) || "api") as DataMode;
  });

  const [endpoint, setEndpointState] = useState<string>(() => {
    if (typeof window === "undefined") return defaultEndpoint;
    return localStorage.getItem(LS_KEY_ENDPOINT) || defaultEndpoint;
  });

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastTsRef = useRef<number>(0);

  // Load persisted log on first mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY_SNAPSHOTS);
      if (raw) {
        const parsed: Snapshot[] = JSON.parse(raw);
        const trimmed = parsed.slice(-MAX_SNAPSHOTS);
        setSnapshots(trimmed);
        if (trimmed.length) lastTsRef.current = trimmed[trimmed.length - 1].timestamp;
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist snapshots
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_SNAPSHOTS, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
    } catch {
      // ignore quota failures
    }
  }, [snapshots]);

  // Persist mode & endpoint
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_MODE, mode);
    } catch {}
  }, [mode]);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_ENDPOINT, endpoint);
    } catch {}
  }, [endpoint]);

  // Helper: append with cap + update lastTs
  const appendSnapshots = (items: Snapshot[]) => {
    if (!items.length) return;
    setSnapshots((prev) => {
      const merged = [...prev, ...items].slice(-MAX_SNAPSHOTS);
      if (merged.length) lastTsRef.current = merged[merged.length - 1].timestamp;
      return merged;
    });
  };

  // Polling loop
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      try {
        if (mode === "mock") {
          const s = generateMockData() as Snapshot;
          if (s.timestamp > lastTsRef.current) appendSnapshots([s]);
          return;
        }

        // API mode: fetch all recent; append only strictly newer
        const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}all=1`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return; // keep old data visible
        const payload = await res.json();
        const arr: Snapshot[] = Array.isArray(payload) ? payload : [payload].filter(Boolean);
        const newer = arr
          .filter((s) => s && typeof s.timestamp === "number" && Array.isArray(s.ues))
          .filter((s) => s.timestamp > lastTsRef.current);
        if (newer.length) appendSnapshots(newer);
      } catch {
        // swallow errors; no new data appended
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [mode, endpoint]);

  const latest = snapshots[snapshots.length - 1] as Snapshot | undefined;
  const latestSource = latest?.source ?? null;
  const lastReceivedAt = latest?.timestamp ?? null;

  // Build per-UE history map lazily
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
    endpoint,
    setEndpoint: (url) => setEndpointState(url || defaultEndpoint),
    snapshots,
    latest,
    latestSource,
    lastReceivedAt,
    ueHistory: (rnti, limit = 50) => (historyIndex.get(rnti) ?? []).slice(-limit),
    pushSnapshot: (s) => appendSnapshots([s]),
    clear: () => {
      // Flush browser memory + stop mock regeneration by forcing API mode
      setSnapshots([]);
      lastTsRef.current = 0;
      setMode("api");
      try {
        localStorage.removeItem(LS_KEY_SNAPSHOTS);
      } catch {}
    }
  };

  return <DataStoreCtx.Provider value={value}>{children}</DataStoreCtx.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStoreCtx);
  if (!ctx) throw new Error("useDataStore must be used within <DataStoreProvider />");
  return ctx;
}