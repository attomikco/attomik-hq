"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
] as const;

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // next-themes only knows the resolved theme on the client; avoid a
  // hydration mismatch by not highlighting any option until mounted.
  useEffect(() => setMounted(true), []);
  const active = mounted ? (theme ?? "system") : undefined;

  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const isActive = active === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            className={`theme-toggle-btn${isActive ? " active" : ""}`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
