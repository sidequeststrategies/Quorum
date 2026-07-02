import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { hasActiveSession } from "@/lib/session";
import { brand } from "@/lib/brand";
import { BrandMark } from "@/components/brand-logo";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  LineChart,
  Rocket,
  Users,
  Vote,
} from "lucide-react";

export default async function HomePage() {
  if (await hasActiveSession()) redirect("/dashboard");

  const features = [
    {
      icon: FileSpreadsheet,
      title: "Financials from a spreadsheet",
      body: "Upload the monthly Excel and get summaries, charts, and runway scenarios — no re-keying.",
    },
    {
      icon: Rocket,
      title: "Key projects & milestones",
      body: "Write-ups per initiative, tracked month over month, with milestone status the board can scan.",
    },
    {
      icon: AlertTriangle,
      title: "Living risk register",
      body: "Risks carry over meeting to meeting with a review trail — nothing falls off the radar.",
    },
    {
      icon: Users,
      title: "Team & customer updates",
      body: "Hires, departures, open roles, and key-account health in a consistent monthly format.",
    },
    {
      icon: LineChart,
      title: "Sales & go-to-market",
      body: "Pipeline, wins, and new ARR alongside the GTM narrative, period over period.",
    },
    {
      icon: Calendar,
      title: "Meetings, minutes & decisions",
      body: "Agendas, minutes, votes, and action items linked to the monthly board pack.",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <BrandMark className="h-8 w-8" />
            {brand.name}
            <span className="font-normal text-muted-foreground">{brand.product}</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild>
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-5xl font-bold tracking-tight text-primary sm:text-6xl">
              The monthly board pack,
              <br />
              <span className="text-brand-teal">without the monthly scramble.</span>
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground">
              {brand.name}&rsquo;s board reporting portal keeps financials, projects, risks, team, customers,
              and go-to-market in one consistent format — so management reports in minutes and the board
              sees the same picture every month.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/login">Sign in to the boardroom</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="container py-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border bg-card p-6">
                  <Icon className="h-6 w-6 text-brand-teal" />
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="container flex h-14 items-center justify-between text-sm text-muted-foreground">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <span className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Vote className="h-3.5 w-3.5" /> Decisions tracked
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Consistent every month
            </span>
          </span>
        </div>
      </footer>
    </div>
  );
}
