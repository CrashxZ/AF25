// components/DownlinkView.tsx
"use client";

import React, { useMemo, type ReactElement } from "react";
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
 * Downlink view (grid layout, type-safe):
 * - Reads logged snapshots from the central DataStore
 * - Renders per-UE charts in a responsive grid
 * - Uses a ChartCard wrapper so ResponsiveContainer always has exactly one child
 */

type DLPoint = {
  time: string; // human readable for tooltip/axis
  t: number; // raw timestamp
  bitrate: number; // Mbps
  cqi: number;
  drop: number;
  buffer: number;
};

function buildSeries(
  snapshots: ReturnType<typeof useDataStore>["snapshots"],
  rnti: number,
  limit = 200
): DLPoint[] {
  const out: DLPoint[] = [];
  for (const s of snapshots) {
    const ue = s.ues.find((u) => u.rnti === rnti);
    if (!ue) continue;
    out.push({
      time: new Date(s.timestamp).toLocaleTimeString(),
      t: s.timestamp,
      bitrate: ue.downlink.bitrate / 1e6,
      cqi: ue.downlink.cqi,
      drop: ue.downlink.drop_rate,
      buffer: ue.downlink.buffer_status
    });
  }
  return out.slice(-limit);
}

export default function DownlinkView() {
  const { snapshots } = useDataStore();

  // Unique RNTIs present in the log
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const u of s.ues) set.add(u.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  if (!snapshots.length) {
    return <p className="text-gray-500 text-sm">No downlink data yet…</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Downlink Metrics</h2>

      {rntis.map((rnti) => {
        const data = buildSeries(snapshots, rnti);

        return (
          <div key={rnti} className="space-y-4">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-300">
              UE {rnti}
            </h3>

            {/* Responsive grid: 2 cols on md, 3 on xl (we use 4 cards total) */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-6">
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
                    <Line type="monotone" dataKey="bitrate" name="DL Mbps" stroke="#0ea5e9" dot={false} />
                  </LineChart>
                }
              />

              {/* CQI */}
              <ChartCard
                title="CQI"
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

              {/* Buffer Status */}
              <ChartCard
                title="Buffer Status (bytes)"
                child={
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                    <Legend />
                    <Line type="monotone" dataKey="buffer" name="Buffer" stroke="#f59e0b" dot={false} />
                  </LineChart>
                }
              />

              {/* Drop Rate */}
              <ChartCard
                title="Drop Rate (%)"
                child={
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                    <YAxis />
                    <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                    <Legend />
                    <Line type="monotone" dataKey="drop" name="Drops %" stroke="#a855f7" dot={false} />
                  </LineChart>
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Wrapper to keep chart cards consistent; ResponsiveContainer requires exactly one child element
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