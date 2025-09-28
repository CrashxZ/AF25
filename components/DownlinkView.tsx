// components/DownlinkView.tsx
"use client";

import { useEffect, useState } from "react";
import { generateMockData } from "@/lib/mockData";
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

interface DownlinkMetrics {
  timestamp: number;
  cqi: number;
  bitrate: number;
  buffer_status: number;
  drop_rate: number;
}

export default function DownlinkView() {
  const [data, setData] = useState<DownlinkMetrics[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const mock = generateMockData();
      const ue = mock.ues[0]; // show first UE for simplicity
      setData((prev) => [
        ...prev.slice(-19), // keep last 20 points
        {
          timestamp: mock.timestamp,
          cqi: ue.downlink.cqi,
          bitrate: ue.downlink.bitrate / 1e6, // Mbps
          buffer_status: ue.downlink.buffer_status,
          drop_rate: ue.downlink.drop_rate
        }
      ]);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Downlink Metrics</h2>

      {/* Bitrate Chart */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">Bitrate (Mbps)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="bitrate" stroke="#0ea5e9" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* CQI Chart */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">CQI</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="cqi" stroke="#10b981" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Buffer Status Chart */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">Buffer Status</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="buffer_status" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}