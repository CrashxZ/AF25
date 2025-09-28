// components/NavBar.tsx
"use client";

interface NavBarProps {
  activeView: string;
  setActiveView: (view: string) => void;
}

// Simple navigation bar for switching dashboard views
export default function NavBar({ activeView, setActiveView }: NavBarProps) {
  const views = ["UE Overview", "Downlink", "Uplink", "Inferences"];

  return (
    <nav className="flex items-center space-x-4 border-b pb-3">
      {views.map((view) => (
        <button
          key={view}
          onClick={() => setActiveView(view)}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeView === view
              ? "bg-brand text-white shadow"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          {view}
        </button>
      ))}
    </nav>
  );
}