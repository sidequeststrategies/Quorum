import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth } from "@/auth";
import { CheckCircle2, Vote, FileText, Calendar, Users, ShieldCheck } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const features = [
    { icon: Calendar, title: "Board meetings", body: "Schedule, agenda, attendees, minutes — one source of truth." },
    { icon: Vote, title: "Resolutions & voting", body: "Run formal votes or unanimous written consents with a full audit trail." },
    { icon: FileText, title: "Board packs", body: "Distribute decks and financials securely to directors and observers." },
    { icon: Users, title: "Member directory", body: "Investor directors, independents, observers — with roles and term tracking." },
    { icon: CheckCircle2, title: "Action items", body: "Capture follow-ups in the meeting; chase them down between meetings." },
    { icon: ShieldCheck, title: "Quorum logic", body: "Built-in rules for quorum and majority — never miscount a vote again." },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Vote className="h-4 w-4" />
            </div>
            Quorum
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-balance text-5xl font-bold tracking-tight sm:text-6xl">
              Board management,
              <br />
              built for startups.
            </h1>
            <p className="mt-6 text-pretty text-lg text-muted-foreground">
              Quorum gives founders, investor directors, and corporate secretaries one place to run meetings,
              track resolutions, and keep governance airtight as you scale from seed to IPO.
            </p>
            <div className="mt-10 flex items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/signup">Start your board</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">I already have an account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="border-t bg-muted/30">
          <div className="container py-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-lg border bg-card p-6">
                  <Icon className="h-6 w-6 text-primary" />
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
          <span>© {new Date().getFullYear()} Quorum</span>
          <span>Built for startup boards.</span>
        </div>
      </footer>
    </div>
  );
}
