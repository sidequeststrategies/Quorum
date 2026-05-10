"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  FileText,
  Home,
  LineChart,
  MessageSquare,
  Settings,
  Sparkles,
  Tent,
  Users,
  Vote,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof Home };
type NavSection = { label: string; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: "Boardroom",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: Home },
      { href: "/meetings", label: "Meetings", icon: Calendar },
      { href: "/resolutions", label: "Resolutions", icon: Vote },
      { href: "/reports", label: "Reports", icon: ClipboardList },
      { href: "/financials", label: "Financials", icon: LineChart },
      { href: "/documents", label: "Board pack", icon: FileText },
      { href: "/action-items", label: "Action items", icon: CheckSquare },
      { href: "/members", label: "Members", icon: Users },
      { href: "/chat", label: "AI assistant", icon: MessageSquare },
    ],
  },
  {
    label: "Coaching",
    items: [
      { href: "/coaching", label: "Programs", icon: Sparkles },
      { href: "/coaching/clients", label: "Clients", icon: Users },
    ],
  },
  {
    label: "Retreats",
    items: [
      { href: "/retreats", label: "Sessions", icon: Tent },
      { href: "/retreats/activities", label: "Activity library", icon: ClipboardList },
    ],
  },
  {
    label: "",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];

export function AppNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-4 p-3">
      {sections.map((section) => (
        <div key={section.label || "_"}>
          {section.label ? (
            <div className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {section.label}
            </div>
          ) : null}
          <div className="flex flex-col gap-0.5">
            {section.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
