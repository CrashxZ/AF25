// components/UplinkView.tsx
"use client";

import React, { useMemo, useState, type ReactElement } from "react";
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
 * Uplink view (single UE via dropdown):
 * - Shows a UE selector (RNTI) + connected UE count
 * - Renders a responsive grid of charts for the selected UE only
 * - Reads from centralized DataStore (no tab-local polling)
 */

type ULPoint = {
  t: number; // raw timestamp
  bitrate: number; // Mbps
  sinr: number;
  rsrp: number;
  bsr: number;
  phr: number;
  ta: number;
  drop: number;
};

function buildSeries(
  snapshots: ReturnType<typeof useDataStore>["snapshots"],
  rnti: number,
  limit = 200
): ULPoint[] {
  const out: ULPoint[] = [];
  for (const s of snapshots) {
    const ue = s.ues.find((u) => u.rnti === rnti);
    if (!ue) continue;
    out.push({
      t: s.timestamp,
      bitrate: ue.uplink.bitrate / 1e6,
      sinr: ue.uplink.pusch_sinr,
      rsrp: ue.uplink.rsrp,
      bsr: ue.uplink.bsr,
      phr: ue.uplink.phr,
      ta: ue.uplink.timing_advance,
      drop: ue.uplink.drop_rate
    });
  }
  return out.slice(-limit);
}

export default function UplinkView() {
  const { snapshots } = useDataStore();

  // Unique RNTIs present in the log
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const u of s.ues) set.add(u.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  const [selectedRnti, setSelectedRnti] = useState<number | "">(() => rntis[0] ?? "");

  // Keep selection valid if RNTIs change
  const activeRnti = useMemo(() => {
    if (selectedRnti === "" && rntis.length) return rntis[0];
    if (selectedRnti !== "" && !rntis.includes(selectedRnti)) return rntis[0] ?? undefined;
    return selectedRnti === "" ? undefined : selectedRnti;
  }, [selectedRnti, rntis]);

  const data = useMemo(() => {
    if (!activeRnti) return [];
    return buildSeries(snapshots, activeRnti);
  }, [snapshots, activeRnti]);

  const ueCount = rntis.length;

  if (!snapshots.length) {
    return <p className="text-gray-500 text-sm">No uplink data yet…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header row: title, selector, count */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Uplink Metrics</h2>
          <p className="text-xs text-gray-500">
            Connected UEs: <span className="font-medium">{ueCount}</span>
          </p>
        </div>

        <label className="text-sm text-gray-600 dark:text-gray-300">
          UE (RNTI):&nbsp;
          <select
            className="rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
            value={activeRnti ?? ""}
            onChange={(e) => setSelectedRnti(e.target.value ? Number(e.target.value) : "")}
          >
            {rntis.length === 0 && <option value="">—</option>}
            {rntis.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!activeRnti || data.length === 0 ? (
        <div className="rounded-xl border p-6 text-sm text-gray-500">
          Select a UE to view charts {ueCount === 0 ? "(no UEs detected yet)" : "(awaiting samples)"}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Bitrate */}
          <ChartCard
            title="Bitrate (Mbps)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="bitrate" name="UL Mbps" stroke="#0ea5e9" dot={false} />
              </LineChart>
            }
          />

          {/* SINR */}
          <ChartCard
            title="SINR (dB)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="sinr" name="SINR" stroke="#10b981" dot={false} />
              </LineChart>
            }
          />

          {/* RSRP */}
          <ChartCard
            title="RSRP (dBm)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="rsrp" name="RSRP" stroke="#ef4444" dot={false} />
              </LineChart>
            }
          />

          {/* BSR */}
          <ChartCard
            title="BSR (bytes)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="bsr" name="BSR" stroke="#f59e0b" dot={false} />
              </LineChart>
            }
          />

          {/* PHR / TA / Drop % */}
          <ChartCard
            title="PHR / Timing Advance / Drop %"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="phr" name="PHR" stroke="#6366f1" dot={false} />
                <Line type="monotone" dataKey="ta" name="TA" stroke="#22c55e" dot={false} />
                <Line type="monotone" dataKey="drop" name="Drop %" stroke="#a855f7" dot={false} />
              </LineChart>
            }
          />
        </div>
      )}
    </div>
  );
}

// Wrapper so ResponsiveContainer always has exactly one child
function ChartCard({ title, child }: { title: string; child: ReactElement }) {
  return (
    <div className="h-64 border rounded-xl p-3 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="text-sm font-medium mb-2">{title}</div>
      <ResponsiveContainer width="100%" height="85%">
        {child}
      </ResponsiveContainer>
    </div>
  );
}