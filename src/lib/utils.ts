import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string | null | undefined, fallback = "?") {
  if (!name) return fallback;
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...opts,
  }).format(date);
}

export function formatDateOnly(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(date);
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Reporting periods are stored as the first day of the month (UTC-agnostic,
// matching financial snapshots). Form inputs use <input type="month"> → "YYYY-MM".
export function currentPeriodString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function periodFromString(s: string) {
  return new Date(s + "-01");
}

export function formatPeriod(d: Date | string) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

export function genToken(prefix = "") {
  // 18-char alphanumeric token. Sufficient for unguessable share links.
  const a = Math.random().toString(36).slice(2, 12);
  const b = Math.random().toString(36).slice(2, 10);
  return prefix + a + b;
}
