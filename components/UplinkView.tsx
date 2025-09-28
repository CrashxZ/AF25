// components/UplinkView.tsx
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

interface UplinkMetrics {
  timestamp: number;
  sinr: number; // pusch_sinr
  rsrp: number;
  bitrate: number; // Mbps
  bsr: number;
  drop_rate: number;
  phr: number;
  timing_advance: number;
}

export default function UplinkView() {
  const [data, setData] = useState<UplinkMetrics[]>([]);

  useEffect(() => {
    // Append a new point every 3s from mock stream (first UE for demo)
    const id = setInterval(() => {
      const mock = generateMockData();
      const ue = mock.ues[0];
      setData((prev) => [
        ...prev.slice(-19),
        {
          timestamp: mock.timestamp,
          sinr: ue.uplink.pusch_sinr,
          rsrp: ue.uplink.rsrp,
          bitrate: ue.uplink.bitrate / 1e6, // to Mbps
          bsr: ue.uplink.bsr,
          drop_rate: ue.uplink.drop_rate,
          phr: ue.uplink.phr,
          timing_advance: ue.uplink.timing_advance
        }
      ]);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Uplink Metrics</h2>

      {/* Bitrate */}
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

      {/* SINR & RSRP */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">SINR (dB) & RSRP (dBm)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="sinr" name="SINR" stroke="#10b981" dot={false} />
            <Line type="monotone" dataKey="rsrp" name="RSRP" stroke="#ef4444" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Buffer Status Report (BSR) */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">BSR (bytes)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="bsr" stroke="#f59e0b" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* PHR / Timing / Drops */}
      <div className="h-64 bg-white rounded-xl shadow-card p-4">
        <h3 className="text-sm font-medium mb-2">PHR / Timing Advance / Drop %</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" tick={false} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="phr" name="PHR" stroke="#6366f1" dot={false} />
            <Line type="monotone" dataKey="timing_advance" name="TA" stroke="#22c55e" dot={false} />
            <Line type="monotone" dataKey="drop_rate" name="Drop %" stroke="#a855f7" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}