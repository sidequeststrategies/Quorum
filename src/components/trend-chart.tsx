// Line chart for monthly metric series with an optional forecast region.
// Values may be null (gaps break the line). Everything after `actualCount`
// points is drawn dashed and lighter, with a divider marking where actuals
// end and the uploaded pack's forecast begins.

type TrendCurve = {
  name: string;
  color: string;
  values: (number | null)[];
};

type Props = {
  months: string[]; // YYYY-MM labels, one per point
  curves: TrendCurve[];
  actualCount?: number; // points ≤ this index-1 are actuals; rest forecast
  height?: number;
  money?: boolean;
  pct?: boolean;
};

function fmtTick(v: number, money: boolean, pct: boolean) {
  if (pct) return `${v.toFixed(0)}%`;
  if (!money) return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0);
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(0)}k`;
  return `$${v.toFixed(0)}`;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtMonthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return `${MONTH_NAMES[mo - 1]} ${String(y).slice(2)}`;
}

// Split a series into contiguous non-null runs, each tagged actual/forecast.
// The first forecast run is anchored to the last actual point so the dashed
// line continues from the solid one.
function segments(values: (number | null)[], actualCount: number) {
  const out: { pts: { i: number; v: number }[]; forecast: boolean }[] = [];
  let run: { i: number; v: number }[] = [];
  let runForecast = false;
  const flush = () => {
    if (run.length > 0) out.push({ pts: run, forecast: runForecast });
    run = [];
  };
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    const forecast = i >= actualCount;
    if (v == null) {
      flush();
      continue;
    }
    if (run.length > 0 && forecast !== runForecast) {
      const last = run[run.length - 1];
      flush();
      run = [last]; // anchor the dashed run to the last solid point
    }
    runForecast = forecast;
    run.push({ i, v });
  }
  flush();
  return out.filter((s) => s.pts.length >= 2);
}

export function TrendChart({ months, curves, actualCount, height = 200, money = true, pct = false }: Props) {
  const n = months.length;
  if (n < 2 || curves.length === 0) return null;
  const ac = actualCount ?? n;

  const padding = { top: 16, right: 16, bottom: 30, left: 56 };
  const innerW = 800;
  const innerH = height - padding.top - padding.bottom;

  const allVals = curves.flatMap((c) => c.values).filter((v): v is number => v != null);
  if (allVals.length === 0) return null;
  let yMin = Math.min(...allVals, 0);
  let yMax = Math.max(...allVals, 0);
  if (yMax === yMin) yMax = yMin + 1;
  const yPad = (yMax - yMin) * 0.06;
  yMin -= yPad;
  yMax += yPad;

  const xStep = innerW / (n - 1);
  const x = (i: number) => padding.left + i * xStep;
  const y = (v: number) => padding.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => yMin + (i * (yMax - yMin)) / ticks);
  const labelEvery = Math.max(1, Math.ceil(n / 10));
  const hasForecast = ac < n;

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${padding.left + innerW + padding.right} ${height}`}
        className="w-full"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${curves.map((c) => c.name).join(", ")} by month`}
      >
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
            <text x={padding.left - 8} y={y(tv)} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="end" dominantBaseline="middle">
              {fmtTick(tv, money, pct)}
            </text>
          </g>
        ))}

        {/* Actuals → forecast divider */}
        {hasForecast && ac >= 1 ? (
          <g>
            <line
              x1={x(ac - 1)}
              y1={padding.top}
              x2={x(ac - 1)}
              y2={padding.top + innerH}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="3 3"
              strokeWidth="1"
              opacity="0.6"
            />
            <text x={x(ac - 1) + 4} y={padding.top + 10} fill="hsl(var(--muted-foreground))" fontSize="9">
              forecast →
            </text>
          </g>
        ) : null}

        {/* X labels */}
        {months.map((m, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={padding.top + innerH + 16} fill="hsl(var(--muted-foreground))" fontSize="10" textAnchor="middle">
              {fmtMonthLabel(m)}
            </text>
          ) : null
        )}

        {/* Curves */}
        {curves.map((c, ci) =>
          segments(c.values, ac).map((seg, si) => (
            <polyline
              key={`${ci}-${si}`}
              points={seg.pts.map((p) => `${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")}
              fill="none"
              stroke={c.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={seg.forecast ? "5 4" : undefined}
              opacity={seg.forecast ? 0.75 : 1}
              className="chart-line-animate"
              style={{ animationDelay: `${ci * 150}ms` }}
            />
          ))
        )}

        {/* Last-actual dots */}
        {curves.map((c, ci) => {
          let lastIdx = -1;
          for (let i = Math.min(ac, c.values.length) - 1; i >= 0; i--) {
            if (c.values[i] != null) {
              lastIdx = i;
              break;
            }
          }
          if (lastIdx < 0) return null;
          return <circle key={ci} cx={x(lastIdx)} cy={y(c.values[lastIdx]!)} r="3.5" fill={c.color} />;
        })}
      </svg>
      {curves.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {curves.map((c) => (
            <div key={c.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: c.color }} />
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
