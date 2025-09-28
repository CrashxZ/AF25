// components/InferencesView.tsx
"use client";

import { useMemo, useState } from "react";
import { useDataStore } from "@/lib/dataStore";
import { evaluateUEInferences, Inference, Severity } from "@/lib/inferences";

/**
 * Inferences (logged):
 * - Uses the centralized DataStore (snapshots persisted to localStorage)
 * - Shows CURRENT per-UE status (highest severity right now)
 * - Shows a ROLLING EVENT LOG of recent warnings/alerts derived from snapshots
 * - Simple filters: by RNTI and by severity
 */

type EventRow = {
  t: number;
  pci: number;
  rnti: number;
  code: string;
  title: string;
  message: string;
  severity: Severity;
};

export default function InferencesView() {
  const { snapshots, latest, ueHistory } = useDataStore();

  // Build RNTI list for filter
  const rntis = useMemo(() => {
    const set = new Set<number>();
    for (const s of snapshots) for (const ue of s.ues) set.add(ue.rnti);
    return Array.from(set).sort((a, b) => a - b);
  }, [snapshots]);

  const [selectedRnti, setSelectedRnti] = useState<number | "all">("all");
  const [onlyProblems, setOnlyProblems] = useState<boolean>(true); // filter out "info"

  // ---- Current status table (by UE on the latest snapshot)
  const currentRows = useMemo(() => {
    if (!latest) return [];
    const rows = latest.ues
      .filter((ue) => (selectedRnti === "all" ? true : ue.rnti === selectedRnti))
      .map((ue) => {
        const hist = ueHistory(ue.rnti, 10);
        const infs = evaluateUEInferences(ue, hist);
        const highest: Severity = infs.some((i) => i.severity === "alert")
          ? "alert"
          : infs.some((i) => i.severity === "warning")
          ? "warning"
          : "info";
        return { ue, highest, infs };
      });
    return rows;
  }, [latest, selectedRnti, ueHistory]);

  // ---- Rolling event log from recent snapshots
  // Walk through the last ~120 snapshots (~6 min @ 3s cadence)
  const eventRows: EventRow[] = useMemo(() => {
    const recent = snapshots.slice(-120);
    const out: EventRow[] = [];
    for (const snap of recent) {
      for (const ue of snap.ues) {
        if (selectedRnti !== "all" && ue.rnti !== selectedRnti) continue;
        const infs: Inference[] = evaluateUEInferences(ue, ueHistory(ue.rnti, 10));
        for (const inf of infs) {
          if (onlyProblems && inf.severity === "info") continue; // hide infos if toggled
          out.push({
            t: snap.timestamp,
            pci: ue.pci,
            rnti: ue.rnti,
            code: inf.code,
            title: inf.title,
            message: inf.message,
            severity: inf.severity
          });
        }
      }
    }
    // newest first & cap to 300 rows for speed
    out.sort((a, b) => b.t - a.t);
    return out.slice(0, 300);
  }, [snapshots, selectedRnti, onlyProblems, ueHistory]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Inferences (Logged)</h2>
          <p className="text-xs text-gray-500">
            Derived from the rolling snapshot log (persisted locally). New items appear every few seconds.
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          {/* Severity Filter */}
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={onlyProblems}
              onChange={(e) => setOnlyProblems(e.target.checked)}
            />
            Only warnings/alerts
          </label>
        </div>
      </div>

      {/* CURRENT STATUS (latest snapshot) */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-900">
          Current Status (Latest Sample {latest ? new Date(latest.timestamp).toLocaleTimeString() : ""})
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-3">PCI</th>
              <th className="p-3">RNTI</th>
              <th className="p-3">Summary</th>
              <th className="p-3">Key Notes</th>
            </tr>
          </thead>
          <tbody>
            {currentRows.map(({ ue, highest, infs }) => (
              <tr key={ue.rnti} className="border-t dark:border-gray-700">
                <td className="p-3">{ue.pci}</td>
                <td className="p-3">{ue.rnti}</td>
                <td className="p-3">
                  <SeverityBadge level={highest} />
                </td>
                <td className="p-3">
                  {infs.length === 0 ? (
                    <span className="text-gray-500">No issues detected</span>
                  ) : (
                    <ul className="space-y-1">
                      {infs
                        .filter((i) => (onlyProblems ? i.severity !== "info" : true))
                        .map((inf) => (
                          <li key={inf.code} className="flex items-start gap-2">
                            <Dot severity={inf.severity} />
                            <span>
                              <span className="font-medium">{inf.title}:</span>{" "}
                              <span className="text-gray-700 dark:text-gray-200">
                                {inf.message}
                              </span>
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
            {currentRows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Waiting for data…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EVENT LOG (rolling) */}
      <div className="rounded-2xl border overflow-hidden">
        <div className="px-3 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-900">
          Inference Events (Recent)
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left">
              <th className="p-3">Time</th>
              <th className="p-3">PCI</th>
              <th className="p-3">RNTI</th>
              <th className="p-3">Severity</th>
              <th className="p-3">Title</th>
              <th className="p-3">Message</th>
            </tr>
          </thead>
          <tbody>
            {eventRows.map((e, idx) => (
              <tr key={`${e.rnti}-${e.code}-${e.t}-${idx}`} className="border-t dark:border-gray-700">
                <td className="p-3 whitespace-nowrap">{new Date(e.t).toLocaleTimeString()}</td>
                <td className="p-3">{e.pci}</td>
                <td className="p-3">{e.rnti}</td>
                <td className="p-3">
                  <SeverityBadge level={e.severity} />
                </td>
                <td className="p-3">{e.title}</td>
                <td className="p-3">{e.message}</td>
              </tr>
            ))}
            {eventRows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No inference events yet…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
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

// Small colored dot for list items
function Dot({ severity }: { severity: Severity }) {
  const cls =
    severity === "alert"
      ? "bg-red-500"
      : severity === "warning"
      ? "bg-amber-500"
      : "bg-sky-500";
  return <span className={`mt-1 inline-block h-2 w-2 rounded-full ${cls}`} />;
}

// Reusable severity badge
function SeverityBadge({ level }: { level: Severity }) {
  const styles =
    level === "alert"
      ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/30"
      : level === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/30"
      : "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-300 dark:border-sky-900/30";
  const label = level === "alert" ? "Alert" : level === "warning" ? "Warning" : "Info";
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-1 text-xs ${styles}`}>
      {label}
    </span>
  );
}