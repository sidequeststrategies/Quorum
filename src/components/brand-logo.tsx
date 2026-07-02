import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

// AssetCool droplet logomark — navy→teal gradient, matching the brand guide.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-7 w-7", className)} role="img" aria-label={`${brand.name} logo`}>
      <defs>
        <linearGradient id="brandDrop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-navy))" />
          <stop offset="100%" stopColor="hsl(var(--brand-teal-bright))" />
        </linearGradient>
      </defs>
      <path
        d="M12 2.2c3.6 4.6 7 8.3 7 12.3a7 7 0 1 1-14 0c0-4 3.4-7.7 7-12.3Z"
        fill="url(#brandDrop)"
      />
      <path
        d="M9.2 14.8a3.4 3.4 0 0 0 3.1 3.4"
        stroke="white"
        strokeOpacity="0.85"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold", className)}>
      <BrandMark />
      <span className="leading-tight">
        {brand.name}
        <span className="ml-1.5 font-normal text-muted-foreground">{brand.product}</span>
      </span>
    </span>
  );
}
