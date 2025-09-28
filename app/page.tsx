// app/page.tsx
"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import UEOverview from "@/components/UEOverview";
import DownlinkView from "@/components/DownlinkView";
import UplinkView from "@/components/UplinkView";
import InferencesView from "@/components/InferencesView";

// Main dashboard shell
export default function DashboardPage() {
  const [activeView, setActiveView] = useState("UE Overview");

  const renderView = () => {
    switch (activeView) {
      case "UE Overview":
        return <UEOverview />;
      case "Downlink":
        return <DownlinkView />;
      case "Uplink":
        return <UplinkView />;
      case "Inferences":
        return <InferencesView />;
      default:
        return <UEOverview />;
    }
  };

  return (
    <div className="flex flex-col space-y-6">
      {/* Navigation bar */}
      <NavBar activeView={activeView} setActiveView={setActiveView} />

      {/* Dynamic content area */}
      <div className="bg-white shadow-card rounded-2xl p-6">{renderView()}</div>
    </div>
  );
}