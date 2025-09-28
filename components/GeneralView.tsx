// components/GeneralView.tsx
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
 * General View (per-UE quick diagnostics)
 * Shows: CQI (DL), SINR (UL), Timing Advance (UL), RSRP (UL), MCS (DL & UL)
 * - Select one UE via dropdown; shows connected UE count
 * - Grid of small time-series charts for quick health check
 * - Uses centralized DataStore (no tab-local polling)
 *
 * NOTE: Add this view to your tab list in NavBar/app/page.tsx as "General"
 */

type Point = {
  t: number;          // timestamp
  cqi: number;        // DL
  sinr: number;       // UL (pusch_sinr)
  ta: number;         // UL timing_advance
  rsrp: number;       // UL rsrp
  mcs_dl: number;     // DL mcs
  mcs_ul: number;     // UL mcs
};

function buildSeries(
  snapshots: ReturnType<typeof useDataStore>["snapshots"],
  rnti: number,
  limit = 200
): Point[] {
  const out: Point[] = [];
  for (const s of snapshots) {
    const ue = s.ues.find((u) => u.rnti === rnti);
    if (!ue) continue;
    out.push({
      t: s.timestamp,
      cqi: ue.downlink.cqi,
      sinr: ue.uplink.pusch_sinr,
      ta: ue.uplink.timing_advance,
      rsrp: ue.uplink.rsrp,
      mcs_dl: ue.downlink.mcs,
      mcs_ul: ue.uplink.mcs
    });
  }
  return out.slice(-limit);
}

export default function GeneralView() {
  const { snapshots } = useDataStore();

  // Unique RNTIs
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const u of s.ues) set.add(u.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  const [selectedRnti, setSelectedRnti] = useState<number | "">(() => rntis[0] ?? "");

  // Keep selection valid as RNTIs change
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
    return <p className="text-gray-500 text-sm">No data yet…</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">General (CQI / SINR / TA / RSRP / MCS)</h2>
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
        // 2×3 grid on xl, 2×2 on md, stacked on mobile
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <ChartCard
            title="CQI (DL)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis domain={[0, 15]} />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="cqi" name="CQI" stroke="#10b981" dot={false} />
              </LineChart>
            }
          />

          <ChartCard
            title="SINR (UL, dB)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="sinr" name="SINR" stroke="#0ea5e9" dot={false} />
              </LineChart>
            }
          />

          <ChartCard
            title="Timing Advance (UL)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="ta" name="TA" stroke="#22c55e" dot={false} />
              </LineChart>
            }
          />

          <ChartCard
            title="RSRP (UL, dBm)"
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

          <ChartCard
            title="MCS (DL)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="mcs_dl" name="MCS DL" stroke="#a855f7" dot={false} />
              </LineChart>
            }
          />

          <ChartCard
            title="MCS (UL)"
            child={
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                <YAxis />
                <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                <Legend />
                <Line type="monotone" dataKey="mcs_ul" name="MCS UL" stroke="#f59e0b" dot={false} />
              </LineChart>
            }
          />
        </div>
      )}
    </div>
  );
}

// Consistent chart card wrapper (ResponsiveContainer requires exactly one child)
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