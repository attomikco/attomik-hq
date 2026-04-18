"use client";

type Point = { month: string; paid: number; draft: number };

function formatShort(v: number): string {
  if (v <= 0) return "";
  if (v >= 1000) {
    const n = v / 1000;
    return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}k`;
  }
  return `$${Math.round(v)}`;
}

export default function MRRChart({ data }: { data: Point[] }) {
  const width = 720;
  const height = 200;
  const padding = { top: 28, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map((d) => d.paid + d.draft));
  const colW = data.length > 0 ? innerW / data.length : 0;
  const barW = Math.max(0, colW - 4);

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 196 }}
      >
        {data.map((d, i) => {
          const totalVal = d.paid + d.draft;
          const paidH = max > 0 ? (d.paid / max) * innerH : 0;
          const draftH = max > 0 ? (d.draft / max) * innerH : 0;
          const x = padding.left + i * colW + 2;
          const paidY = padding.top + (innerH - paidH);
          const draftY = paidY - draftH;
          const topY = totalVal > 0 ? draftY : padding.top + innerH;
          const cx = x + barW / 2;
          const mixed = d.paid > 0 && d.draft > 0;
          const labelColor = d.paid === 0 && d.draft > 0
            ? "var(--accent-dark)"
            : "var(--muted)";
          return (
            <g key={d.month}>
              {totalVal > 0 && (
                <text
                  x={cx}
                  y={topY - 6}
                  textAnchor="middle"
                  fill={labelColor}
                  style={{
                    fontSize: "var(--fs-11)",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <title>
                    {mixed
                      ? `Paid ${formatShort(d.paid)} · Projected ${formatShort(d.draft)}`
                      : d.draft > 0
                        ? `Projected ${formatShort(d.draft)}`
                        : `Paid ${formatShort(d.paid)}`}
                  </title>
                  {formatShort(totalVal)}
                </text>
              )}
              {/* paid bar (solid) */}
              {d.paid > 0 && (
                <rect
                  x={x}
                  y={paidY}
                  width={barW}
                  height={paidH}
                  fill="var(--accent)"
                />
              )}
              {/* draft bar (stacked above, translucent) */}
              {d.draft > 0 && (
                <>
                  <rect
                    x={x}
                    y={draftY}
                    width={barW}
                    height={draftH}
                    fill="var(--accent)"
                    opacity={0.3}
                  />
                  {d.paid > 0 && (
                    <line
                      x1={x}
                      x2={x + barW}
                      y1={paidY}
                      y2={paidY}
                      stroke="var(--accent-dark)"
                      strokeWidth={0.8}
                      strokeDasharray="3 2"
                    />
                  )}
                </>
              )}
              {/* empty-month placeholder */}
              {totalVal === 0 && (
                <rect
                  x={x}
                  y={padding.top + innerH - 2}
                  width={barW}
                  height={2}
                  fill="var(--border)"
                />
              )}
              <text
                x={cx}
                y={height - 8}
                textAnchor="middle"
                fill="var(--muted)"
                style={{
                  fontSize: "var(--fs-10)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {d.month.slice(5)}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "var(--sp-5)",
          marginTop: "var(--sp-3)",
          fontSize: "var(--text-sm)",
          color: "var(--muted)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: "var(--accent)",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Paid + sent
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--sp-2)",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              background: "var(--accent)",
              opacity: 0.3,
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          Projected · drafts
        </span>
      </div>
    </div>
  );
}
