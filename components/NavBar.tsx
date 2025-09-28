// components/NavBar.tsx
"use client";

import { useEffect, useState } from "react";
import { useDataStore } from "@/lib/dataStore";
import DataSourceSwitcher from "@/components/DataSourceSwitcher";
import DarkModeToggle from "@/components/DarkModeToggle";

interface NavBarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

// elapsed time helper
function formatElapsed(ms: number) {
  if (ms < 1000) return "just now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s ago`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ago`;
}

export default function NavBar({ activeView, setActiveView }: NavBarProps) {
  const views = ["UE Overview", "Downlink", "Uplink", "Inferences"];
  const { latestSource, lastReceivedAt, paused } = useDataStore();

  const [elapsed, setElapsed] = useState<string>("—");
  const [showControls, setShowControls] = useState(false); // toggles Data Controls panel

  // update elapsed every second
  useEffect(() => {
    const id = setInterval(() => {
      if (paused) setElapsed("paused");
      else if (lastReceivedAt) setElapsed(formatElapsed(Date.now() - lastReceivedAt));
      else setElapsed("—");
    }, 1000);
    return () => clearInterval(id);
  }, [lastReceivedAt, paused]);

  return (
    <div className="flex flex-col gap-3">
      {/* Tabs + status row */}
      <nav className="flex items-center justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          {views.map((view) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                activeView === view
                  ? "bg-brand text-white shadow"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              {view}
            </button>
          ))}
        </div>

        {/* Right side: status + toggles */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-4 text-xs text-gray-600 dark:text-gray-300">
            <div>
              Source: <span className="font-medium">{latestSource ?? "—"}</span>
            </div>
            <div>
              Last transmission: <span className="font-medium">{elapsed}</span>
            </div>
            {paused && (
              <span className="px-2 py-1 rounded-md border text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-900/30">
                Paused
              </span>
            )}
          </div>

          {/* Dark mode toggle */}
          <DarkModeToggle />

          {/* Data Controls toggle button */}
          <button
            onClick={() => setShowControls((v) => !v)}
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800"
            aria-expanded={showControls}
            aria-controls="data-controls"
            title="Show/Hide data source controls"
          >
            {showControls ? "Hide Data Controls ▲" : "Data Controls ▼"}
          </button>
        </div>
      </nav>

      {/* Collapsible Data Controls panel */}
      {showControls && (
        <div id="data-controls">
          <DataSourceSwitcher className="mt-1" />
        </div>
      )}
    </div>
  );
}