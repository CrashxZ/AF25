// components/UplinkView.tsx
"use client";

import { useMemo, useState } from "react";
import { useDataStore } from "@/lib/dataStore";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

/**
 * Uplink view (logged, persistent):
 * - Reads from centralized DataStore (no per-tab polling)
 * - Select a UE (RNTI) to visualize
 * - Shows rolling time-series for UL bitrate, SINR, RSRP, BSR, PHR, TA, Drop %
 */

type Point = {
  t: number;
  bitrate: number; // Mbps
  sinr: number;
  rsrp: number;
  bsr: number;
  phr: number;
  ta: number;
  drop_rate: number;
};

export default function UplinkView() {
  const { snapshots } = useDataStore();

  // Build RNTI list
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const ue of s.ues) set.add(ue.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  // Auto-select the most recent UE if none chosen
  const latestRnti = useMemo(() => {
    for (let i = snapshots.length - 1; i >= 0; i--) {
      const s = snapshots[i];
      if (s.ues.length > 0) return s.ues[0].rnti;
    }
    return undefined;
  }, [snapshots]);

  const [selectedRnti, setSelectedRnti] = useState<number | undefined>(undefined);
  const activeRnti = selectedRnti ?? latestRnti;

  // Build time-series for active RNTI
  const data: Point[] = useMemo(() => {
    if (!activeRnti) return [];
    const arr: Point[] = [];
    for (const s of snapshots) {
      const ue = s.ues.find((u) => u.rnti === activeRnti);
      if (!ue) continue;
      arr.push({
        t: s.timestamp,
        bitrate: ue.uplink.bitrate / 1e6, // Mbps
        sinr: ue.uplink.pusch_sinr,
        rsrp: ue.uplink.rsrp,
        bsr: ue.uplink.bsr,
        phr: ue.uplink.phr,
        ta: ue.uplink.timing_advance,
        drop_rate: ue.uplink.drop_rate
      });
    }
    return arr.slice(-200);
  }, [snapshots, activeRnti]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Uplink Metrics (Logged)</h2>
          <p className="text-xs text-gray-500">
            Data comes from the persistent client-side log (refresh-safe).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">
            RNTI:&nbsp;
            <select
              className="rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
              value={activeRnti ?? ""}
              onChange={(e) =>
                setSelectedRnti(e.target.value ? Number(e.target.value) : undefined)
              }
            >
              {activeRnti === undefined && <option value="">—</option>}
              {rntis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Bitrate */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">Bitrate (Mbps)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
            <Legend />
            <Line type="monotone" dataKey="bitrate" name="UL Mbps" stroke="#0ea5e9" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* SINR & RSRP */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">SINR (dB) & RSRP (dBm)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
            <Legend />
            <Line type="monotone" dataKey="sinr" name="SINR" stroke="#10b981" dot={false} />
            <Line type="monotone" dataKey="rsrp" name="RSRP" stroke="#ef4444" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BSR */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">BSR (bytes)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
            <Legend />
            <Line type="monotone" dataKey="bsr" name="BSR" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PHR / TA / Drop % */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">PHR / Timing Advance / Drop %</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
            <Legend />
            <Line type="monotone" dataKey="phr" name="PHR" stroke="#6366f1" dot={false} />
            <Line type="monotone" dataKey="ta" name="TA" stroke="#22c55e" dot={false} />
            <Line type="monotone" dataKey="drop_rate" name="Drop %" stroke="#a855f7" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}