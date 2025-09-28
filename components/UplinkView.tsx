// components/UplinkView.tsx
"use client";

import { useMemo } from "react";
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
 * Uplink view (grid layout):
 * - Reads logged snapshots from the central DataStore
 * - Renders per-UE charts in a responsive grid (no tab-local polling)
 */

type ULPoint = {
  time: string; // human readable for tooltip/axis
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
      time: new Date(s.timestamp).toLocaleTimeString(),
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

  if (!snapshots.length) {
    return <p className="text-gray-500 text-sm">No uplink data yet…</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Uplink Metrics</h2>

      {rntis.map((rnti) => {
        const data = buildSeries(snapshots, rnti);

        return (
          <div key={rnti} className="space-y-4">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-300">
              UE {rnti}
            </h3>

            {/* Responsive grid: 2 cols on md, 3 on xl */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {/* Bitrate */}
              <ChartCard title="Bitrate (Mbps)">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                  <Legend />
                  <Line type="monotone" dataKey="bitrate" name="UL Mbps" stroke="#0ea5e9" dot={false} />
                </LineChart>
              </ChartCard>

              {/* SINR */}
              <ChartCard title="SINR (dB)">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                  <Legend />
                  <Line type="monotone" dataKey="sinr" name="SINR" stroke="#10b981" dot={false} />
                </LineChart>
              </ChartCard>

              {/* RSRP */}
              <ChartCard title="RSRP (dBm)">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                  <Legend />
                  <Line type="monotone" dataKey="rsrp" name="RSRP" stroke="#ef4444" dot={false} />
                </LineChart>
              </ChartCard>

              {/* BSR */}
              <ChartCard title="BSR (bytes)">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" tickFormatter={(t) => new Date(t).toLocaleTimeString()} />
                  <YAxis />
                  <Tooltip labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()} />
                  <Legend />
                  <Line type="monotone" dataKey="bsr" name="BSR" stroke="#f59e0b" dot={false} />
                </LineChart>
              </ChartCard>

              {/* PHR / TA / Drop % combined */}
              <ChartCard title="PHR / Timing Advance / Drop %">
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
              </ChartCard>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Small wrapper to keep chart cards consistent
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="h-64 border rounded-xl p-3 bg-white dark:bg-gray-800 dark:border-gray-700">
      <div className="text-sm font-medium mb-2">{title}</div>
      <ResponsiveContainer width="100%" height="85%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}