// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

// Metadata for SEO / Hackathon presentation
export const metadata: Metadata = {
  title: "5G RAN Dashboard",
  description: "Visualize srsRAN / OAI data in real time"
};

// Root layout wrapper
export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-gray-50 text-gray-900">
      <body className="min-h-screen flex flex-col">
        {/* Main content container */}
        <main className="flex-1 container py-6">{children}</main>
      </body>
    </html>
  );
}