// components/NavBar.tsx
"use client";

import DataSourceSwitcher from "@/components/DataSourceSwitcher";

interface NavBarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

// Navigation with data source controls (Mock/API + endpoint)
export default function NavBar({ activeView, setActiveView }: NavBarProps) {
  const views = ["UE Overview", "Downlink", "Uplink", "Inferences"];

  return (
    <div className="flex flex-col gap-3">
      {/* Top row: tabs */}
      <nav className="flex items-center justify-between">
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
      </nav>

      {/* Bottom row: data source switcher */}
      <DataSourceSwitcher />
    </div>
  );
}