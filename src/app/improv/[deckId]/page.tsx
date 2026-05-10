import { notFound } from "next/navigation";
import { PITCH_DECK_IMPROV } from "@/db/seed-content";
import { DeckPlayer } from "./deck-player";

export const dynamic = "force-static";

export default async function DeckPage({ params }: { params: Promise<{ deckId: string }> }) {
  const { deckId } = await params;
  const deck = PITCH_DECK_IMPROV.find((d) => d.id === deckId);
  if (!deck) notFound();
  return <DeckPlayer deck={deck} />;
}
