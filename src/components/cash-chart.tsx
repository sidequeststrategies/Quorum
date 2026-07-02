type CashCurve = {
  name: string;
  color: string;
  values: number[]; // ending cash by month
};

type Props = {
  curves: CashCurve[];
  height?: number;
  // y-axis floor; if undefined, autoscale
  zeroLine?: boolean;
};

export function CashChart({ curves, height = 220, zeroLine = true }: Props) {
  const padding = { top: 16, right: 16, bottom: 28, left: 56 };
  const innerW = 800;
  const innerH = height - padding.top - padding.bottom;

  if (curves.length === 0) return null;
  const months = Math.max(...curves.map((c) => c.values.length));
  if (months < 2) return null;

  const allVals = curves.flatMap((c) => c.values);
  let yMin = Math.min(...allVals, 0);
  let yMax = Math.max(...allVals, 0);
  if (yMax === yMin) yMax = yMin + 1;
  const yPadding = (yMax - yMin) * 0.05;
  yMin -= yPadding;
  yMax += yPadding;

  const xStep = innerW / (months - 1);
  function x(i: number) {
    return padding.left + i * xStep;
  }
  function y(v: number) {
    return padding.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  }

  // Y ticks
  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => yMin + (i * (yMax - yMin)) / ticks);

  function fmt(v: number) {
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
    return `$${v.toFixed(0)}`;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${padding.left + innerW + padding.right} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Ending cash by month for each scenario"
      >
        {/* Grid + y-axis labels */}
        {tickVals.map((tv, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              y1={y(tv)}
              x2={padding.left + innerW}
              y2={y(tv)}
              stroke="hsl(var(--border))"
              strokeDasharray={tv === 0 ? "0" : "2 4"}
              strokeWidth={tv === 0 ? 1.5 : 1}
            />
            <text
              x={padding.left - 8}
              y={y(tv)}
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
              textAnchor="end"
              dominantBaseline="middle"
            >
              {fmt(tv)}
            </text>
          </g>
        ))}

        {/* Zero line emphasis if range crosses 0 */}
        {zeroLine && yMin < 0 && yMax > 0 ? (
          <line
            x1={padding.left}
            y1={y(0)}
            x2={padding.left + innerW}
            y2={y(0)}
            stroke="hsl(var(--destructive))"
            strokeDasharray="4 3"
            strokeWidth="1.5"
          />
        ) : null}

        {/* X-axis ticks: every ~6 months */}
        {Array.from({ length: months }).map((_, i) =>
          i % 6 === 0 || i === months - 1 ? (
            <text
              key={i}
              x={x(i)}
              y={padding.top + innerH + 16}
              fill="hsl(var(--muted-foreground))"
              fontSize="10"
              textAnchor="middle"
            >
              M{i + 1}
            </text>
          ) : null
        )}

        {/* Curves */}
        {curves.map((c, ci) => {
          const points = c.values
            .map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`)
            .join(" ");
          return (
            <polyline
              key={ci}
              points={points}
              fill="none"
              stroke={c.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              className="chart-line-animate"
              style={{ animationDelay: `${ci * 150}ms` }}
            />
          );
        })}

        {/* Last-point dots + labels */}
        {curves.map((c, ci) => {
          const i = c.values.length - 1;
          return (
            <g key={ci}>
              <circle cx={x(i)} cy={y(c.values[i])} r="3.5" fill={c.color} />
            </g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {curves.map((c) => (
          <div key={c.name} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c.color }} />
            <span>{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny inline sparkline for the comparison row
export function Sparkline({
  values,
  color,
  width = 80,
  height = 24,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(" ");
  const lastY = height - ((values[values.length - 1] - min) / range) * height;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="inline-block">
      {min < 0 && max > 0 ? (
        <line
          x1={0}
          y1={height - ((-min) / range) * height}
          x2={width}
          y2={height - ((-min) / range) * height}
          stroke="hsl(var(--destructive))"
          strokeDasharray="2 2"
          strokeWidth="1"
        />
      ) : null}
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2" fill={color} />
    </svg>
  );
}
