import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PITCH_DECK_IMPROV } from "@/db/seed-content";

export const dynamic = "force-static";

export default function ImprovHubPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(135deg, #061230 0%, #0a1f44 50%, #1e3a8a 100%)" }}>
      <div className="container max-w-5xl py-16 text-white">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3 border-white/30 bg-white/10 text-white/80">
            Retreat warm-up
          </Badge>
          <h1 className="font-bold text-5xl tracking-tight" style={{ fontFamily: "system-ui" }}>
            Pitch Deck Improv
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/80">
            Six absurd startups, fully built decks. Volunteer pitches cold. Sharks ask hard questions. Room votes IN or OUT.
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-4 rounded-md border border-white/20 bg-black/30 px-6 py-3 text-sm">
            <span><strong className="text-cyan-300">90s</strong> skim</span>
            <span><strong className="text-cyan-300">3 min</strong> pitch</span>
            <span><strong className="text-cyan-300">4 min</strong> Q&amp;A</span>
            <span><strong className="text-cyan-300">1 min</strong> vote</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PITCH_DECK_IMPROV.map((deck, i) => (
            <Link
              key={deck.id}
              href={`/improv/${deck.id}`}
              className="group rounded-2xl border border-white/15 p-6 transition-all hover:-translate-y-1 hover:border-white/30"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))" }}
            >
              <div
                className="font-bold text-5xl leading-none"
                style={{ color: deck.themeColor, textShadow: `0 0 20px ${deck.themeColor}` }}
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="mt-3 text-2xl font-bold tracking-wide">{deck.name}</div>
              <p className="mt-2 text-sm italic text-white/70">{deck.tagline}</p>
              <div className="mt-4 border-t border-white/10 pt-3 text-xs uppercase tracking-wider text-white/50">
                {deck.slides.length} slides · click to launch
              </div>
            </Link>
          ))}
        </div>

        <Card className="mt-10 border-cyan-500/30 bg-black/30 text-white">
          <CardHeader>
            <CardTitle className="text-cyan-300">How to run it</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm">
              <li>1. Open this hub on the projector. Show the six titles. Watch the room react.</li>
              <li>2. Volunteer steps up. Click their deck. Use ← → keys (or Space) to navigate.</li>
              <li>3. After the pitch, three colleagues play sharks. Specific questions only.</li>
              <li>4. Room votes IN or OUT by show of hands. Tally on a whiteboard.</li>
              <li>5. 30-second debrief: one thing the pitcher did well, one thing to steal.</li>
              <li>6. ESC returns to this hub.</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
