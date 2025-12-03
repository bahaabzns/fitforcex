"use client";

import { useTheme } from "@/lib/ThemeContext";

export default function ThemeToggle() {
  const { theme } = useTheme();

  return (
    <button
      className="p-2 rounded-lg hover:bg-gray-800/50 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 cursor-not-allowed opacity-50"
      aria-label="Theme toggle (dark mode only)"
      disabled
    >
      <svg
        className="w-5 h-5 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    </button>
  );
}
