"use client";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import type { ImprovDeck, ImprovSlide } from "@/db/seed-content";

export function DeckPlayer({ deck }: { deck: ImprovDeck }) {
  const [idx, setIdx] = useState(0);
  const total = deck.slides.length;

  const next = useCallback(() => setIdx((i) => Math.min(i + 1, total - 1)), [total]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "n") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "p") {
        e.preventDefault();
        prev();
      } else if (e.key === "Escape") {
        e.preventDefault();
        window.location.href = "/improv";
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const slide = deck.slides[idx];

  return (
    <div className="fixed inset-0 select-none overflow-hidden text-white" style={{ background: deck.themeBg }}>
      <div
        className="absolute left-8 top-6 text-xs font-bold uppercase tracking-[3px] text-white/50"
        style={{ fontFamily: "system-ui" }}
      >
        {deck.name}
      </div>

      <Link
        href="/improv"
        className="absolute right-32 top-6 z-20 rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10"
      >
        ← All decks
      </Link>

      <div className="absolute right-8 top-6 z-20 rounded-md bg-black/40 px-3 py-1.5 text-xs font-mono text-white/70">
        {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </div>

      <SlideView slide={slide} accent={deck.themeColor} />

      {/* Nav controls */}
      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        <button
          type="button"
          onClick={prev}
          disabled={idx === 0}
          className="rounded-md border border-white/20 bg-black/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={next}
          disabled={idx === total - 1}
          className="rounded-md border border-white/20 bg-black/40 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 disabled:opacity-40"
        >
          Next →
        </button>
      </div>

      <div className="absolute bottom-3 right-8 text-[10px] text-white/30">
        ← / → or Space to navigate · ESC for hub
      </div>
    </div>
  );
}

function SlideView({ slide, accent }: { slide: ImprovSlide; accent: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-12 text-center">
      {slide.tag ? (
        <span
          className="mb-6 inline-block rounded-full px-4 py-1 text-xs font-bold uppercase tracking-[2px] text-white"
          style={{ background: accent }}
        >
          {slide.tag}
        </span>
      ) : null}

      <h2
        className="font-bold leading-tight tracking-tight"
        style={{
          fontSize: "clamp(40px, 7vw, 96px)",
          color: "white",
          maxWidth: "1200px",
          fontFamily: "system-ui",
        }}
      >
        {slide.title}
      </h2>

      {slide.body && slide.body.length > 0 ? (
        <div className="mt-8 max-w-3xl space-y-3 text-lg leading-relaxed text-white/85" style={{ fontSize: "clamp(16px, 1.6vw, 22px)" }}>
          {slide.body.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      ) : null}

      {slide.stats ? (
        <div className="mt-10 flex flex-wrap justify-center gap-6">
          {slide.stats.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/15 bg-white/5 px-7 py-5"
              style={{ minWidth: "180px" }}
            >
              <div className="text-5xl font-bold leading-none" style={{ color: accent, fontFamily: "system-ui" }}>
                {s.num}
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {slide.team ? (
        <div className="mt-10 grid w-full max-w-5xl grid-cols-1 gap-4 text-left sm:grid-cols-3">
          {slide.team.map((t, i) => (
            <div key={i} className="rounded-xl border border-white/15 bg-white/5 p-5">
              <div className="font-bold">{t.name}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-white/60">{t.role}</div>
              <p className="mt-2 text-sm text-white/80">{t.bio}</p>
              <p className="mt-2 text-xs italic" style={{ color: accent }}>
                {t.cred}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {slide.table ? (
        <div className="mt-8 w-full max-w-4xl overflow-x-auto">
          <table className="mx-auto border-collapse text-sm">
            <thead>
              <tr>
                {slide.table.headers.map((h, i) => (
                  <th
                    key={i}
                    className={`border border-white/15 px-4 py-3 text-center ${
                      i === slide.table!.usCol ? "bg-white/10 font-bold" : "bg-white/5"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slide.table.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className={`border border-white/15 px-4 py-3 ${
                        ci === slide.table!.usCol ? "bg-white/10 font-bold" : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {slide.ask ? (
        <div className="mt-8 max-w-3xl">
          <div className="font-bold leading-none" style={{ fontSize: "clamp(80px, 12vw, 160px)", color: accent, fontFamily: "system-ui" }}>
            {slide.ask.headline}
          </div>
          <p className="mt-3 text-xl text-white/90">{slide.ask.sub}</p>
          <div className="mt-6 grid gap-3 text-left sm:grid-cols-2">
            {slide.ask.lines.map((l, i) => (
              <div key={i} className="rounded-lg border border-white/10 bg-white/5 p-3 text-sm">
                <span className="font-bold" style={{ color: accent }}>{l.amt}</span>{" "}
                <span className="text-white/85">— {l.what}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
