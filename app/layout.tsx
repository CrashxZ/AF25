// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { DataStoreProvider } from "@/lib/dataStore";

// SEO / title
export const metadata: Metadata = {
  title: "5G RAN Dashboard",
  description: "Visualize srsRAN / OAI data in real time"
};

// Small inline script to set dark mode before paint (no flicker)
// Chooses: localStorage.theme = 'dark'|'light', else prefers-color-scheme
const themeBootstrap = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var isDark = stored ? stored === 'dark' : prefersDark;
    var html = document.documentElement;
    if (isDark) html.classList.add('dark'); else html.classList.remove('dark');
  } catch (e) {}
})();
`;

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    // Hydration warning suppressed because we set `class` via inline script before React mounts
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Ensure theme applied ASAP to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="min-h-screen flex flex-col">
        {/* Global client-side data store: logs snapshots & persists to localStorage */}
        <DataStoreProvider>
          <main className="flex-1 container py-6">{children}</main>
        </DataStoreProvider>
      </body>
    </html>
  );
}