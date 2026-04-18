"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export default function YearSelector({
  years,
  selected,
}: {
  years: number[];
  selected: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function choose(year: number) {
    if (year === selected) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("year", String(year));
    startTransition(() => {
      router.replace(`?${sp.toString()}`, { scroll: false });
    });
  }

  return (
    <div
      className="toggle-group"
      style={{
        display: "inline-flex",
        gap: 0,
        border: "1px solid var(--border)",
        borderRadius: "var(--r-sm)",
        overflow: "hidden",
        background: "var(--paper)",
        opacity: pending ? 0.6 : 1,
        transition: "opacity var(--t-base)",
      }}
    >
      {years.map((y, i) => {
        const active = y === selected;
        return (
          <button
            key={y}
            type="button"
            onClick={() => choose(y)}
            disabled={pending}
            className="mono"
            style={{
              padding: "6px 12px",
              fontSize: "var(--text-sm)",
              fontWeight: active
                ? "var(--fw-bold)"
                : "var(--fw-semibold)",
              letterSpacing: "var(--ls-wide)",
              background: active ? "var(--accent)" : "transparent",
              color: active ? "var(--ink)" : "var(--muted)",
              border: "none",
              borderLeft:
                i === 0 ? "none" : "1px solid var(--border)",
              cursor: active ? "default" : "pointer",
              transition:
                "background var(--t-base), color var(--t-base)",
            }}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}
