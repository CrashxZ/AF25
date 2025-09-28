// components/InferencesView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { generateMockData } from "@/lib/mockData";
import { evaluateUEInferences, Inference, Severity } from "@/lib/inferences";

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

type History = Record<number, UE[]>; // rnti -> recent snapshots

export default function InferencesView() {
  const [snapshot, setSnapshot] = useState<{ timestamp: number; ues: UE[] }>({
    timestamp: Date.now(),
    ues: []
  });

  // keep short rolling history per UE (last 12 samples ~ 36s if mock @ 3s)
  const historyRef = useRef<History>({});

  useEffect(() => {
    const id = setInterval(() => {
      const mock = generateMockData();
      const hist = historyRef.current;
      mock.ues.forEach((ue) => {
        const arr = hist[ue.rnti] ?? [];
        const next = [...arr.slice(-11), ue];
        hist[ue.rnti] = next;
      });
      setSnapshot({ timestamp: mock.timestamp, ues: mock.ues });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    return snapshot.ues.map((ue) => {
      const inferences: Inference[] = evaluateUEInferences(ue, historyRef.current[ue.rnti] ?? []);
      // Explicitly type the union to satisfy TS
      const highestSeverity: Severity = inferences.some((i) => i.severity === "alert")
        ? "alert"
        : inferences.some((i) => i.severity === "warning")
        ? "warning"
        : "info";
      return { ue, inferences, highestSeverity };
    });
  }, [snapshot]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Inferences</h2>
        <span className="text-xs text-gray-500">
          Updated: {new Date(snapshot.timestamp).toLocaleTimeString()}
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-3">PCI</th>
              <th className="p-3">RNTI</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ue, inferences, highestSeverity }) => (
              <tr key={ue.rnti} className="border-t">
                <td className="p-3">{ue.pci}</td>
                <td className="p-3">{ue.rnti}</td>
                <td className="p-3">
                  <SeverityBadge level={highestSeverity} />
                </td>
                <td className="p-3">
                  {inferences.length === 0 ? (
                    <span className="text-gray-500">No issues detected</span>
                  ) : (
                    <ul className="space-y-1">
                      {inferences.map((inf) => (
                        <li key={inf.code} className="flex items-start gap-2">
                          <span
                            className={`mt-1 inline-block h-2 w-2 rounded-full ${
                              inf.severity === "alert"
                                ? "bg-red-500"
                                : inf.severity === "warning"
                                ? "bg-amber-500"
                                : "bg-sky-500"
                            }`}
                          />
                          <span>
                            <span className="font-medium">{inf.title}:</span>{" "}
                            <span className="text-gray-700">{inf.message}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={4}>
                  Waiting for data…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Small legend for judges */}
      <div className="text-xs text-gray-500">
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> alert
        </span>
        <span className="inline-flex items-center gap-1 mr-3">
          <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> warning
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500 inline-block" /> info
        </span>
      </div>
    </div>
  );
}

// visual badge for highest severity on a row
function SeverityBadge({ level }: { level: Severity }) {
  const styles =
    level === "alert"
      ? "bg-red-50 text-red-700 border-red-200"
      : level === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-sky-50 text-sky-700 border-sky-200";
  const label = level === "alert" ? "Alert" : level === "warning" ? "Warning" : "Info";
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs ${styles}`}>
      {label}
    </span>
  );
}