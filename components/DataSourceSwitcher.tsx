// components/DataSourceSwitcher.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useDataStore } from "@/lib/dataStore";

/**
 * Simple control to choose between:
 * - Mock mode (local generator)
 * - API mode (fetch snapshots from teammate endpoint)
 *
 * Stores selection + endpoint in localStorage via DataStore.
 * Include this in NavBar or Overview header to let judges switch sources.
 */

export default function DataSourceSwitcher({ className = "" }: { className?: string }) {
  const { mode, setDataMode, endpoint, setEndpoint } = useDataStore();

  const [localEndpoint, setLocalEndpoint] = useState(endpoint);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<null | { ok: boolean; msg: string }>(null);

  // Keep local input in sync if store changes elsewhere
  useEffect(() => setLocalEndpoint(endpoint), [endpoint]);

  // Quick presets you can click (handy during the hackathon)
  const presets = useMemo(
    () =>
      [
        { label: "Use /api/data (Vercel)", value: "/api/data" },
        // Example LAN endpoints — update/remove as needed
        { label: "http://localhost:3000/data", value: "http://localhost:3000/data" },
        { label: "http://192.168.1.50:3000/data", value: "http://192.168.1.50:3000/data" }
      ] as const,
    []
  );

  async function testAndSave() {
    if (!localEndpoint) {
      setStatus({ ok: false, msg: "Please enter an endpoint URL." });
      return;
    }
    setTesting(true);
    setStatus(null);

    // Small fetch with timeout; expects a single snapshot or array of snapshots
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(localEndpoint, { cache: "no-store", signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Very light shape check
      const candidate = Array.isArray(json) ? json[json.length - 1] : json;
      if (!candidate || typeof candidate.timestamp !== "number" || !Array.isArray(candidate.ues)) {
        throw new Error("Response does not match expected snapshot shape.");
      }

      // Save to store so polling loop uses it
      setEndpoint(localEndpoint);
      setDataMode("api");
      setStatus({ ok: true, msg: "Endpoint looks good. Switched to API mode." });
    } catch (e: any) {
      setStatus({
        ok: false,
        msg:
          e?.name === "AbortError"
            ? "Timed out while fetching endpoint (5s)."
            : e?.message || "Failed to fetch endpoint."
      });
    } finally {
      clearTimeout(id);
      setTesting(false);
    }
  }

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end gap-3 rounded-xl border p-3 bg-white dark:bg-gray-800 dark:border-gray-700 ${className}`}
    >
      {/* Mode select */}
      <label className="text-sm text-gray-700 dark:text-gray-200">
        Mode
        <select
          className="ml-2 rounded-md border px-2 py-1 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
          value={mode}
          onChange={(e) => setDataMode(e.target.value as "mock" | "api")}
        >
          <option value="mock">Mock</option>
          <option value="api">API</option>
        </select>
      </label>

      {/* Endpoint input (active in API mode) */}
      <div className="flex-1">
        <label className="block text-sm text-gray-700 dark:text-gray-200">
          API Endpoint
        </label>
        <input
          type="url"
          placeholder="https://host:port/data  or  /api/data"
          className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-gray-900 dark:border-gray-700"
          value={localEndpoint}
          onChange={(e) => setLocalEndpoint(e.target.value)}
          disabled={mode !== "api" && localEndpoint === ""}
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {presets.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setLocalEndpoint(p.value)}
              className="rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Test & Save */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={testAndSave}
          className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={testing || !localEndpoint}
          title="Fetch the endpoint once, validate the JSON, and save"
        >
          {testing ? "Testing..." : "Test & Save"}
        </button>
      </div>

      {/* Status line */}
      {status && (
        <div
          className={`sm:ml-auto text-xs px-2 py-1 rounded-md border ${
            status.ok
              ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-900/30"
              : "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/20 dark:border-red-900/30"
          }`}
        >
          {status.msg}
        </div>
      )}

      {/* Tiny hint */}
      <div className="text-[11px] text-gray-500 sm:ml-auto">
        Ensure your endpoint returns the agreed snapshot JSON and allows CORS from your Vercel domain.
      </div>
    </div>
  );
}