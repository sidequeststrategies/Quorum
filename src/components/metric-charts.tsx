// Animated SVG mini-charts for board metrics. Server-renderable (pure SVG +
// CSS animations from globals.css; respects prefers-reduced-motion).

function fmtCompact(v: number) {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

export function TrendBars({
  points,
  height = 160,
  color = "hsl(var(--brand-teal))",
  money = true,
}: {
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
  money?: boolean;
}) {
  if (points.length === 0) return null;
  const pad = { top: 18, right: 8, bottom: 22, left: 8 };
  const innerW = 640;
  const innerH = height - pad.top - pad.bottom;
  const max = Math.max(...points.map((p) => p.value), 1);
  const bw = innerW / points.length;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${innerW + pad.left + pad.right} ${height}`} className="w-full" role="img">
        {points.map((p, i) => {
          const h = Math.max((p.value / max) * innerH, p.value > 0 ? 2 : 0);
          const x = pad.left + i * bw + bw * 0.15;
          const y = pad.top + innerH - h;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={bw * 0.7}
                height={h}
                rx={3}
                fill={color}
                className="chart-bar-animate"
                style={{ animationDelay: `${i * 60}ms` }}
              />
              <text
                x={x + bw * 0.35}
                y={y - 5}
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >
                {money ? fmtCompact(p.value) : p.value}
              </text>
              <text
                x={x + bw * 0.35}
                y={pad.top + innerH + 14}
                textAnchor="middle"
                fontSize="10"
                fill="hsl(var(--muted-foreground))"
              >
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function TrendLine({
  series,
  height = 200,
  money = true,
}: {
  series: { name: string; color: string; points: { label: string; value: number }[] }[];
  height?: number;
  money?: boolean;
}) {
  const first = series[0];
  if (!first || first.points.length < 2) return null;
  const pad = { top: 14, right: 14, bottom: 24, left: 52 };
  const innerW = 720;
  const innerH = height - pad.top - pad.bottom;
  const n = first.points.length;

  const all = series.flatMap((s) => s.points.map((p) => p.value));
  let yMin = Math.min(...all, 0);
  let yMax = Math.max(...all, 1);
  if (yMax === yMin) yMax = yMin + 1;
  const span = yMax - yMin;
  yMin -= span * 0.05;
  yMax += span * 0.05;

  const x = (i: number) => pad.left + (i * innerW) / (n - 1);
  const y = (v: number) => pad.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const ticks = Array.from({ length: 4 }, (_, i) => yMin + ((i + 1) * (yMax - yMin)) / 4);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${innerW + pad.left + pad.right} ${height}`} className="w-full" role="img">
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={pad.left} y1={y(tv)} x2={pad.left + innerW} y2={y(tv)} stroke="hsl(var(--border))" strokeDasharray="2 4" />
            <text x={pad.left - 6} y={y(tv)} fontSize="10" textAnchor="end" dominantBaseline="middle" fill="hsl(var(--muted-foreground))">
              {money ? fmtCompact(tv) : Math.round(tv)}
            </text>
          </g>
        ))}
        {first.points.map((p, i) => (
          <text key={i} x={x(i)} y={pad.top + innerH + 16} fontSize="10" textAnchor="middle" fill="hsl(var(--muted-foreground))">
            {p.label}
          </text>
        ))}
        {series.map((s, si) => (
          <g key={si}>
            <polyline
              points={s.points.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              className="chart-line-animate"
              style={{ animationDelay: `${si * 200}ms` }}
            />
            <circle cx={x(s.points.length - 1)} cy={y(s.points[s.points.length - 1].value)} r={3.5} fill={s.color} />
          </g>
        ))}
      </svg>
      {series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
