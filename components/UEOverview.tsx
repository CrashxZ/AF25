// components/UEOverview.tsx
"use client";

import { useMemo, useState } from "react";
import { useDataStore } from "@/lib/dataStore";

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
  const { snapshots, ueHistory, clear, paused, resume, mode, endpoint } = useDataStore();
  const [selectedRnti, setSelectedRnti] = useState<number | "all">("all");

  // Collect unique RNTIs
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const ue of s.ues) set.add(ue.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  // Flatten snapshots → rows
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
          dlMbps: ue.downlink.bitrate,
          ulMbps: ue.uplink.bitrate,
          dlDrop: ue.downlink.drop_rate,
          ulDrop: ue.uplink.drop_rate
        });
      }
    }
    flat.sort((a, b) => b.t - a.t);
    return flat.slice(0, 200);
  }, [snapshots, selectedRnti]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">UE Overview (Logged)</h2>
          <p className="text-xs text-gray-500">
            Persistent log of UE snapshots. Latest first.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* RNTI Filter */}
          <label className="text-sm text-gray-600 dark:text-gray-300">
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

          {/* Flush & Pause */}
          <button
            onClick={clear}
            className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            Flush &amp; Pause
          </button>

          {/* Resume button when paused */}
          {paused && (
            <button
              onClick={resume}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Resume
            </button>
          )}

          {/* Mode / Paused badge */}
          <span
            className={`text-xs rounded-md border px-2 py-1 ${
              paused
                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30"
                : mode === "api"
                ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-900/30"
                : "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30"
            }`}
          >
            {paused
              ? "Paused"
              : mode === "api"
              ? `API mode (${endpoint || "/api/ingest"})`
              : "Mock mode"}
          </span>
        </div>
      </div>

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
                <td className="p-3 whitespace-nowrap">{new Date(r.t).toLocaleTimeString()}</td>
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
                  {paused
                    ? "Dashboard paused — press Resume to continue"
                    : mode === "api"
                    ? "Waiting for API data… (POST to /api/ingest)"
                    : "No data yet…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}