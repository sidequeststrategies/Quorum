"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";

type Message = {
  id: string;
  role: string;
  content: string;
  createdAt: Date;
};

type Props = {
  threadId: string;
  initialMessages: Message[];
  orgName: string;
};

export function ChatClient({ threadId, initialMessages, orgName }: Props) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  const [, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, streamedText]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || streaming) return;

    // Optimistic user message
    const tempUserId = `tmp_user_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text, createdAt: new Date() },
    ]);
    setInput("");
    setStreaming(true);
    setStreamedText("");

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: text }),
      });

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => "Unknown error");
        setStreamedText(`⚠️ ${errText}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        acc += chunk;
        setStreamedText(acc);
      }
      // Final decoder flush
      acc += decoder.decode();
      setStreamedText(acc);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStreamedText(`⚠️ Network error: ${msg}`);
    } finally {
      setStreaming(false);
      // Refresh the server-rendered messages so the optimistic ones get
      // replaced with the canonical persisted versions.
      startTransition(() => {
        router.refresh();
      });
      // Refocus for the next message
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {messages.length === 0 && !streaming ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Ask anything about {orgName}&apos;s board pack, finances, or recent meetings.
            </CardContent>
          </Card>
        ) : (
          messages.map((m) => (
            <Card key={m.id} className={m.role === "user" ? "ml-12 bg-primary/5" : "mr-12"}>
              <CardContent className="py-4">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {m.role === "user" ? "You" : "Claude"} · {formatDate(m.createdAt)}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
              </CardContent>
            </Card>
          ))
        )}

        {streaming || streamedText ? (
          <Card className="mr-12">
            <CardContent className="py-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Claude · {streaming ? "thinking…" : "just now"}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {streamedText || (
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "150ms" }} />
                    <span className="h-2 w-2 animate-pulse rounded-full bg-primary" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <Card className="sticky bottom-4 mt-4">
        <CardContent className="py-4">
          <form onSubmit={handleSubmit} className="space-y-2">
            <Textarea
              ref={textareaRef}
              required
              rows={3}
              placeholder={streaming ? "Streaming response…" : "Ask a question about this company…"}
              className="resize-none"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              autoFocus
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Claude has read access to {orgName}&apos;s data only. ⌘/Ctrl + Enter to send.
              </p>
              <Button type="submit" disabled={streaming || !input.trim()}>
                {streaming ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
