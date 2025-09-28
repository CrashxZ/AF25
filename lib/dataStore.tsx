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
 * 🔧 Fixes for "Flush & Pause" behavior:
 * - Introduces a `paused` flag that truly stops polling when paused.
 * - Adds `ignoreBeforeRef` cutoff (set at flush time) so even if the API
 *   still holds old snapshots, we IGNORE anything with timestamp <= cutoff.
 * - After flush, `lastReceivedAt` and `latestSource` reset to null.
 *
 * Endpoints:
 *   - Default API endpoint: `/api/ingest` (Vercel)
 *   - Teammates POST snapshots there; dashboard GETs with `?all=1`
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
const LS_KEY_PAUSED = "ran_paused_v1";
const MAX_SNAPSHOTS = 1000;

type StoreShape = {
  mode: DataMode;
  setDataMode: (m: DataMode) => void;
  endpoint: string;
  setEndpoint: (url: string) => void;

  paused: boolean;
  pause: () => void;
  resume: () => void;

  snapshots: Snapshot[];
  latest?: Snapshot;
  latestSource: string | null;
  lastReceivedAt: number | null;

  ueHistory: (rnti: number, limit?: number) => UE[];
  pushSnapshot: (s: Snapshot) => void;
  clear: () => void; // Flush & Pause behavior
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

  const [paused, setPaused] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const raw = localStorage.getItem(LS_KEY_PAUSED);
    return raw === "1";
  });

  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastTsRef = useRef<number>(0);

  // NEW: Cutoff to ignore server-held older data after flush
  const ignoreBeforeRef = useRef<number>(0);

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

  // Persist mode, endpoint, paused
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
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY_PAUSED, paused ? "1" : "0");
    } catch {}
  }, [paused]);

  // Helper: append with cap + update lastTs (respect ignoreBeforeRef)
  const appendSnapshots = (items: Snapshot[]) => {
    if (!items.length) return;
    const filtered = items.filter(
      (s) =>
        typeof s.timestamp === "number" &&
        s.timestamp > lastTsRef.current &&
        s.timestamp > ignoreBeforeRef.current
    );
    if (!filtered.length) return;
    setSnapshots((prev) => {
      const merged = [...prev, ...filtered].slice(-MAX_SNAPSHOTS);
      if (merged.length) lastTsRef.current = merged[merged.length - 1].timestamp;
      return merged;
    });
  };

  // Polling loop (honors `paused`)
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(async () => {
      if (paused) return; // 🔒 do nothing while paused

      try {
        if (mode === "mock") {
          const s = generateMockData() as Snapshot;
          appendSnapshots([s]);
          return;
        }

        // API mode: fetch all recent; append only strictly newer & after cutoff
        const url = `${endpoint}${endpoint.includes("?") ? "&" : "?"}all=1`;
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return; // keep old data visible
        const payload = await res.json();
        const arr: Snapshot[] = Array.isArray(payload) ? payload : [payload].filter(Boolean);
        const valid = arr.filter((s) => s && Array.isArray(s.ues) && typeof s.timestamp === "number");
        appendSnapshots(valid);
      } catch {
        // swallow errors; no new data appended
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [mode, endpoint, paused]);

  const latest = snapshots[snapshots.length - 1] as Snapshot | undefined;
  const latestSource = latest?.source ?? null;
  const lastReceivedAt = latest?.timestamp ?? null;

  // Per-UE history map
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

  // Public API
  const value: StoreShape = {
    mode,
    setDataMode: (m) => setMode(m),
    endpoint,
    setEndpoint: (url) => setEndpointState(url || defaultEndpoint),

    paused,
    pause: () => setPaused(true),
    resume: () => setPaused(false),

    snapshots,
    latest,
    latestSource,
    lastReceivedAt,

    ueHistory: (rnti, limit = 50) => (historyIndex.get(rnti) ?? []).slice(-limit),

    pushSnapshot: (s) => appendSnapshots([s]),

    clear: () => {
      // Set a cutoff so older server-held data won't be re-imported,
      // and pause polling so nothing new is appended until user resumes.
      const now = Date.now();
      ignoreBeforeRef.current = now;
      lastTsRef.current = now;

      setSnapshots([]);
      setPaused(true); // true "Pause" behavior
      setMode("api"); // avoid falling back to mock unless explicitly chosen

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