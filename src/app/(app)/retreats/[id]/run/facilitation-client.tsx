"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Plus, Minus, X, ChevronLeft, ChevronRight } from "lucide-react";

type AgendaItem = {
  id: string;
  order: number;
  title: string;
  description: string | null;
  durationMin: number;
  facilitatorName: string | null;
};

export function FacilitationClient({
  retreatId,
  retreatTitle,
  items,
}: {
  retreatId: string;
  retreatTitle: string;
  items: AgendaItem[];
}) {
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(items[0] ? items[0].durationMin * 60 : 0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = items[idx];
  const upcoming = items[idx + 1];

  // Reset timer when item changes
  useEffect(() => {
    setSecondsLeft(current ? current.durationMin * 60 : 0);
    setRunning(false);
  }, [idx, current]);

  // Tick
  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const next = useCallback(() => {
    setIdx((i) => Math.min(i + 1, items.length - 1));
  }, [items.length]);
  const prev = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);
  const toggleRun = useCallback(() => setRunning((r) => !r), []);
  const addMin = useCallback(() => setSecondsLeft((s) => s + 60), []);
  const subMin = useCallback(() => setSecondsLeft((s) => Math.max(0, s - 60)), []);

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "n") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "p") {
        e.preventDefault();
        prev();
      } else if (e.key === " ") {
        e.preventDefault();
        toggleRun();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        addMin();
      } else if (e.key === "-") {
        e.preventDefault();
        subMin();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, toggleRun, addMin, subMin]);

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white">
        <p className="text-2xl">No agenda yet.</p>
        <Link href={`/retreats/${retreatId}`} className="mt-4 underline">
          Back to retreat
        </Link>
      </div>
    );
  }

  const overTime = secondsLeft === 0;
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const pct = current ? Math.min(100, ((current.durationMin * 60 - secondsLeft) / (current.durationMin * 60)) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[3px] text-white/50">Facilitation</span>
          <span className="text-sm text-white/80">{retreatTitle}</span>
        </div>
        <div className="text-xs font-mono text-white/60">
          Item {idx + 1} of {items.length}
        </div>
        <Link
          href={`/retreats/${retreatId}`}
          className="rounded-md border border-white/20 p-1.5 text-white/70 hover:bg-white/10"
          aria-label="Exit facilitation mode"
        >
          <X className="h-4 w-4" />
        </Link>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full bg-white/5">
        <div
          className={`h-full transition-all ${overTime ? "bg-rose-500" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Main */}
      <div className="grid flex-1 grid-cols-1 gap-8 overflow-y-auto px-12 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col">
          <div className="text-sm uppercase tracking-[3px] text-white/40">Now</div>
          <h1 className="mt-2 text-balance text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            {current.title}
          </h1>
          {current.facilitatorName ? (
            <div className="mt-3 text-sm text-white/60">
              Facilitated by <span className="text-white/90">{current.facilitatorName}</span>
            </div>
          ) : null}
          {current.description ? (
            <p className="mt-6 max-w-2xl whitespace-pre-wrap text-base text-white/80 leading-relaxed">
              {current.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-center text-center">
          <div className={`font-mono font-bold text-7xl tabular-nums md:text-8xl ${overTime ? "text-rose-400" : "text-white"}`}>
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </div>
          <div className="mt-2 text-xs uppercase tracking-[3px] text-white/40">
            {overTime ? "Over time" : running ? "Running" : "Paused"}
          </div>

          <div className="mt-8 flex items-center gap-2">
            <button
              type="button"
              onClick={subMin}
              className="rounded-md border border-white/20 p-2 hover:bg-white/10"
              aria-label="Subtract 1 minute"
            >
              <Minus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleRun}
              className="rounded-md border border-white/20 px-6 py-3 hover:bg-white/10"
            >
              {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={addMin}
              className="rounded-md border border-white/20 p-2 hover:bg-white/10"
              aria-label="Add 1 minute"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {upcoming ? (
            <div className="mt-12 w-full max-w-xs rounded-md border border-white/10 bg-white/5 p-4 text-left">
              <div className="text-xs uppercase tracking-[2px] text-white/40">Up next</div>
              <div className="mt-1 font-medium">{upcoming.title}</div>
              <div className="mt-1 text-xs text-white/60">{upcoming.durationMin} min</div>
            </div>
          ) : (
            <div className="mt-12 text-xs text-white/50">Last item</div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between border-t border-white/10 px-6 py-3">
        <div className="text-xs text-white/40">
          ← / → navigate · Space play · + / − adjust time
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={idx === 0}
            className="flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </button>
          <button
            type="button"
            onClick={next}
            disabled={idx === items.length - 1}
            className="flex items-center gap-1 rounded-md border border-white/20 px-3 py-1.5 text-sm hover:bg-white/10 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
