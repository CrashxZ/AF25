// components/DarkModeToggle.tsx
"use client";

// Simple dark mode toggle: toggles `dark` class on <html> and persists to localStorage("theme")

import { useEffect, useState } from "react";

export default function DarkModeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean | null>(null);

  // Init from localStorage or prefers-color-scheme
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      const prefersDark =
        typeof window !== "undefined" &&
        window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      const initial = stored ? stored === "dark" : !!prefersDark;
      setIsDark(initial);
      const html = document.documentElement;
      if (initial) html.classList.add("dark");
      else html.classList.remove("dark");
    } catch {
      setIsDark(false);
    }
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    const html = document.documentElement;
    if (next) {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  // Avoid hydration mismatch: render disabled while initializing
  if (isDark === null) {
    return (
      <button
        className={`rounded-md border px-3 py-1.5 text-sm opacity-60 ${className}`}
        aria-label="Toggle dark mode (loading)"
        disabled
      >
        🌓
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-800 ${className}`}
      aria-label="Toggle dark mode"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      <span className="mr-2">{isDark ? "🌙" : "☀️"}</span>
      {isDark ? "Dark" : "Light"}
    </button>
  );
}