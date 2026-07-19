import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

// Quorum logomark — seats around a table forming a Q. Seven navy seats plus
// one cyan seat (the one that makes the quorum), whose tail completes the Q.
export function BrandMark({ className }: { className?: string }) {
  const cx = 11.5;
  const cy = 11.5;
  const r = 6.6;
  const seats = [270, 315, 0, 90, 135, 180, 225].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  });
  // The accent seat sits at 45° (lower right), where the tail extends.
  const accent = {
    x: cx + r * Math.cos(Math.PI / 4),
    y: cy + r * Math.sin(Math.PI / 4),
  };
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7", className)} role="img" aria-label={`${brand.name} logo`}>
      {seats.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={1.9} fill="hsl(var(--brand-navy))" />
      ))}
      <path
        d={`M${accent.x} ${accent.y} L20.6 20.6`}
        stroke="hsl(var(--brand-teal))"
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <circle cx={accent.x} cy={accent.y} r={1.9} fill="hsl(var(--brand-teal))" />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <BrandMark />
      <span className="font-display leading-tight tracking-tight">
        {brand.name}
        <span className="ml-1.5 font-normal text-muted-foreground">{brand.product}</span>
      </span>
    </span>
  );
}
