// app/page.tsx
"use client";

import { useState } from "react";
import NavBar from "@/components/NavBar";
import UEOverview from "@/components/UEOverview";
import DownlinkView from "@/components/DownlinkView";
import UplinkView from "@/components/UplinkView";
import InferencesView from "@/components/InferencesView";
import GeneralView from "@/components/GeneralView";

// Dashboard shell: adds "General" view alongside others.
export default function Page() {
  const [activeView, setActiveView] = useState<string>("UE Overview");

  return (
    <div className="space-y-6">
      <NavBar activeView={activeView} setActiveView={setActiveView} />
      {activeView === "UE Overview" && <UEOverview />}
      {activeView === "General" && <GeneralView />}
      {activeView === "Downlink" && <DownlinkView />}
      {activeView === "Uplink" && <UplinkView />}
      {activeView === "Inferences" && <InferencesView />}
    </div>
  );
}