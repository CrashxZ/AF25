// components/UEOverview.tsx
"use client";

import { useMemo, useState } from "react";
import { useDataStore } from "@/lib/dataStore";

/**
 * UE Overview (logged):
 * - Reads rolling snapshots from the central DataStore (persisted in localStorage)
 * - Renders a time-series table (multiple rows) instead of only the latest sample
 * - Simple filter by RNTI + quick actions (clear log)
 */

type Row = {
  t: number;
  pci: number;
  rnti: number;
  cqi: number;
  dlMbps: number;
  ulMbps: number;
  dlDrop: number;
  ulDrop: number;
};

export default function UEOverview() {
  const { snapshots, ueHistory, clear } = useDataStore();

  // Build a list of known RNTIs for filtering
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const ue of s.ues) set.add(ue.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  const [selectedRnti, setSelectedRnti] = useState<number | "all">("all");

  // Flatten snapshots → rows (latest first). Keep the last ~200 rows for speed.
  const rows: Row[] = useMemo(() => {
    const flat: Row[] = [];
    for (const s of snapshots) {
      for (const ue of s.ues) {
        if (selectedRnti !== "all" && ue.rnti !== selectedRnti) continue;
        flat.push({
          t: s.timestamp,
          pci: ue.pci,
          rnti: ue.rnti,
          cqi: ue.downlink.cqi,
          dlMbps: ue.downlink.bitrate / 1e6,
          ulMbps: ue.uplink.bitrate / 1e6,
          dlDrop: ue.downlink.drop_rate,
          ulDrop: ue.uplink.drop_rate
        });
      }
    }
    // newest first
    flat.sort((a, b) => b.t - a.t);
    return flat.slice(0, 200);
  }, [snapshots, selectedRnti]);

  // A tiny per-UE mini-summary (last 5 samples) when a specific RNTI is chosen
  const miniSummary = useMemo(() => {
    if (selectedRnti === "all") return null;
    const hist = ueHistory(selectedRnti, 5);
    if (hist.length === 0) return null;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const dl = hist.map((u) => u.downlink.bitrate / 1e6);
    const ul = hist.map((u) => u.uplink.bitrate / 1e6);
    const cqi = hist.map((u) => u.downlink.cqi);
    return {
      avgDl: avg(dl),
      avgUl: avg(ul),
      avgCqi: avg(cqi)
    };
  }, [selectedRnti, ueHistory]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">UE Overview (Logged)</h2>
          <p className="text-xs text-gray-500">
            Showing recent samples from the persistent log (auto-saved in your browser).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* RNTI Filter */}
          <label className="text-sm text-gray-600">
            RNTI:&nbsp;
            <select
              className="rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
              value={selectedRnti === "all" ? "all" : String(selectedRnti)}
              onChange={(e) =>
                setSelectedRnti(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">All</option>
              {rntis.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          {/* Clear log (handy during demos) */}
          <button
            onClick={clear}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
            title="Clear locally stored samples"
          >
            Clear Log
          </button>
        </div>
      </div>

      {/* Mini summary when focused on one UE */}
      {miniSummary && (
        <div className="rounded-xl border p-3 text-sm bg-white dark:bg-gray-800 dark:border-gray-700">
          <div className="flex gap-6">
            <div>
              <span className="text-gray-500">Avg DL</span>
              <div className="font-medium">{miniSummary.avgDl.toFixed(2)} Mbps</div>
            </div>
            <div>
              <span className="text-gray-500">Avg UL</span>
              <div className="font-medium">{miniSummary.avgUl.toFixed(2)} Mbps</div>
            </div>
            <div>
              <span className="text-gray-500">Avg CQI</span>
              <div className="font-medium">{miniSummary.avgCqi.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left dark:bg-gray-900">
              <th className="p-3">Time</th>
              <th className="p-3">PCI</th>
              <th className="p-3">RNTI</th>
              <th className="p-3">CQI</th>
              <th className="p-3">DL (Mbps)</th>
              <th className="p-3">UL (Mbps)</th>
              <th className="p-3">DL Drop %</th>
              <th className="p-3">UL Drop %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.rnti}-${r.t}-${i}`} className="border-t dark:border-gray-700">
                <td className="p-3 whitespace-nowrap">
                  {new Date(r.t).toLocaleTimeString()}
                </td>
                <td className="p-3">{r.pci}</td>
                <td className="p-3">{r.rnti}</td>
                <td className="p-3">{r.cqi}</td>
                <td className="p-3">{r.dlMbps.toFixed(2)}</td>
                <td className="p-3">{r.ulMbps.toFixed(2)}</td>
                <td className="p-3">{r.dlDrop}</td>
                <td className="p-3">{r.ulDrop}</td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td className="p-6 text-center text-gray-500" colSpan={8}>
                  Waiting for data…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tiny hint for judges */}
      <p className="text-xs text-gray-500">
        Data persists locally in your browser (no server DB needed). Refresh-safe.
      </p>
    </div>
  );
}