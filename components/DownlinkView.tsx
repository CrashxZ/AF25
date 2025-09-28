// components/DownlinkView.tsx
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
 * Downlink view (logged, persistent):
 * - Reads from centralized DataStore (no per-tab polling)
 * - Allows selecting a UE (RNTI)
 * - Shows rolling time-series for DL bitrate, CQI, buffer status, drop rate
 */

type Point = {
  t: number;
  bitrate: number; // Mbps
  cqi: number;
  buffer_status: number;
  drop_rate: number;
};

export default function DownlinkView() {
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

  // Build time-series for the active RNTI
  const data: Point[] = useMemo(() => {
    if (!activeRnti) return [];
    const arr: Point[] = [];
    for (const s of snapshots) {
      const ue = s.ues.find((u) => u.rnti === activeRnti);
      if (!ue) continue;
      arr.push({
        t: s.timestamp,
        bitrate: ue.downlink.bitrate / 1e6, // Mbps
        cqi: ue.downlink.cqi,
        buffer_status: ue.downlink.buffer_status,
        drop_rate: ue.downlink.drop_rate
      });
    }
    // keep newest 200 points; recharts reads oldest->newest fine
    return arr.slice(-200);
  }, [snapshots, activeRnti]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Downlink Metrics (Logged)</h2>
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
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            />
            <Legend />
            <Line type="monotone" dataKey="bitrate" name="DL Mbps" stroke="#0ea5e9" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CQI */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">CQI</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            />
            <Legend />
            <Line type="monotone" dataKey="cqi" name="CQI" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Buffer Status */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">Buffer Status (bytes)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="buffer_status"
              name="Buffer"
              stroke="#f59e0b"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Drop Rate */}
      <div className="h-64 bg-white dark:bg-gray-800 rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">Drop Rate (%)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
            <YAxis />
            <Tooltip
              labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="drop_rate"
              name="Drops %"
              stroke="#a855f7"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}