// components/DownlinkView.tsx
"use client";

import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useDataStore } from "@/lib/dataStore";

// Helper: convert UE history to chart-friendly array
function makeSeries(ueHistory: ReturnType<typeof useDataStore>["ueHistory"], rnti: number) {
  return ueHistory(rnti, 50).map((ue) => ({
    time: new Date().toLocaleTimeString(),
    cqi: ue.downlink.cqi,
    bitrate: ue.downlink.bitrate / 1e6,
    drop: ue.downlink.drop_rate,
    buffer: ue.downlink.buffer_status
  }));
}

export default function DownlinkView() {
  const { snapshots, ueHistory } = useDataStore();

  if (!snapshots.length) {
    return <p className="text-gray-500 text-sm">No downlink data yet…</p>;
  }

  const rntis = Array.from(new Set(snapshots.flatMap((s) => s.ues.map((u) => u.rnti))));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Downlink Metrics</h2>

      {rntis.map((rnti) => {
        const series = makeSeries(ueHistory, rnti);

        return (
          <div key={rnti} className="space-y-4">
            <h3 className="font-medium text-sm text-gray-600 dark:text-gray-300">UE {rnti}</h3>

            {/* Responsive grid for charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CQI */}
              <div className="h-60 border rounded-xl p-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 15]} />
                    <Tooltip />
                    <Line type="monotone" dataKey="cqi" stroke="#3b82f6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-1">CQI</p>
              </div>

              {/* Bitrate */}
              <div className="h-60 border rounded-xl p-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="bitrate" stroke="#10b981" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-1">Bitrate (Mbps)</p>
              </div>

              {/* Drop Rate */}
              <div className="h-60 border rounded-xl p-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="drop" stroke="#ef4444" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-1">Drop Rate (%)</p>
              </div>

              {/* Buffer Status */}
              <div className="h-60 border rounded-xl p-2 bg-white dark:bg-gray-800 dark:border-gray-700">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" hide />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="buffer" stroke="#f59e0b" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
                <p className="text-xs text-center mt-1">Buffer Status</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}