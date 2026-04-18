"use client";

type Point = {
  month: string;
  paid: number;
  draft: number;
  prev: number;
};

function formatShort(v: number): string {
  if (v <= 0) return "";
  if (v >= 1000) {
    const n = v / 1000;
    return `$${n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)}k`;
  }
  return `$${Math.round(v)}`;
}

export default function MRRChart({
  data,
  prevYear,
}: {
  data: Point[];
  prevYear: number;
}) {
  const width = 720;
  const height = 200;
  const padding = { top: 28, right: 8, bottom: 24, left: 8 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.paid + d.draft, d.prev)),
  );
  const colW = data.length > 0 ? innerW / data.length : 0;
  const barGap = 2;
  const pairW = Math.max(0, colW - 6);
  const prevBarW = pairW * 0.42;
  const curBarW = pairW * 0.58 - barGap;

  return (
    <div style={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: 196 }}
      >
        {data.map((d, i) => {
          const totalCur = d.paid + d.draft;
          const paidH = max > 0 ? (d.paid / max) * innerH : 0;
          const draftH = max > 0 ? (d.draft / max) * innerH : 0;
          const prevH = max > 0 ? (d.prev / max) * innerH : 0;

          const colX = padding.left + i * colW + 3;
          const prevX = colX;
          const curX = colX + prevBarW + barGap;

          const prevY = padding.top + (innerH - prevH);
          const paidY = padding.top + (innerH - paidH);
          const draftY = paidY - draftH;
          const topY = totalCur > 0 ? draftY : padding.top + innerH;
          const labelCx = curX + curBarW / 2;

          const mixed = d.paid > 0 && d.draft > 0;
          const labelColor =
            d.paid === 0 && d.draft > 0
              ? "var(--accent-dark)"
              : "var(--muted)";

          return (
            <g key={d.month}>
              {/* previous year bar — drawn first (behind) */}
              {d.prev > 0 && (
                <rect
                  x={prevX}
                  y={prevY}
                  width={prevBarW}
                  height={prevH}
                  fill="var(--border)"
                  opacity={0.9}
                >
                  <title>
                    {prevYear}: {formatShort(d.prev)}
                  </title>
                </rect>
              )}

              {/* current year paid bar */}
              {d.paid > 0 && (
                <rect
                  x={curX}
                  y={paidY}
                  width={curBarW}
                  height={paidH}
                  fill="var(--accent)"
                />
              )}

              {/* current year draft stacked above paid */}
              {d.draft > 0 && (
                <>
                  <rect
                    x={curX}
                    y={draftY}
                    width={curBarW}
                    height={draftH}
                    fill="var(--accent)"
                    opacity={0.3}
                  />
                  {d.paid > 0 && (
                    <line
                      x1={curX}
                      x2={curX + curBarW}
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
              {totalCur === 0 && d.prev === 0 && (
                <rect
                  x={curX}
                  y={padding.top + innerH - 2}
                  width={curBarW}
                  height={2}
                  fill="var(--border)"
                />
              )}

              {/* value label on top of current year bar only */}
              {totalCur > 0 && (
                <text
                  x={labelCx}
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
                  {formatShort(totalCur)}
                </text>
              )}

              {/* month label */}
              <text
                x={colX + pairW / 2}
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
          flexWrap: "wrap",
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
              background: "var(--border)",
              borderRadius: 2,
              display: "inline-block",
            }}
          />
          {prevYear} paid
        </span>
      </div>
    </div>
  );
}
