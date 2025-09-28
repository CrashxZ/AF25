// components/UEOverview.tsx
"use client";

import { useEffect, useState } from "react";
import { generateMockData } from "@/lib/mockData";

interface UE {
  pci: number;
  rnti: number;
  downlink: {
    cqi: number;
    ri: number;
    mcs: number;
    bitrate: number;
    packets_ok: number;
    packets_nok: number;
    drop_rate: number;
    buffer_status: number;
  };
  uplink: {
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
}

export default function UEOverview() {
  const [ues, setUEs] = useState<UE[]>([]);

  useEffect(() => {
    // generate mock data every 3 seconds
    const interval = setInterval(() => {
      const data = generateMockData();
      setUEs(data.ues);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">UE Overview</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2">PCI</th>
            <th className="p-2">RNTI</th>
            <th className="p-2">CQI</th>
            <th className="p-2">DL Bitrate (Mbps)</th>
            <th className="p-2">UL Bitrate (Mbps)</th>
            <th className="p-2">DL Drop %</th>
            <th className="p-2">UL Drop %</th>
          </tr>
        </thead>
        <tbody>
          {ues.map((ue, idx) => (
            <tr key={idx} className="border-t">
              <td className="p-2">{ue.pci}</td>
              <td className="p-2">{ue.rnti}</td>
              <td className="p-2">{ue.downlink.cqi}</td>
              <td className="p-2">{(ue.downlink.bitrate / 1e6).toFixed(2)}</td>
              <td className="p-2">{(ue.uplink.bitrate / 1e6).toFixed(2)}</td>
              <td className="p-2">{ue.downlink.drop_rate}%</td>
              <td className="p-2">{ue.uplink.drop_rate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}