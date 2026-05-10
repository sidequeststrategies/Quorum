"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Section = {
  id: string;
  title: string;
  kind: "text" | "rich" | "metric" | "checklist";
  prompt?: string;
};

function newId() {
  return Math.random().toString(36).slice(2, 9);
}

export function TemplateBuilder({ action }: { action: (formData: FormData) => void }) {
  const [sections, setSections] = useState<Section[]>([
    { id: newId(), title: "Highlights", kind: "rich", prompt: "What went well? 3-5 bullets." },
  ]);

  function update(i: number, patch: Partial<Section>) {
    setSections((s) => s.map((sec, idx) => (idx === i ? { ...sec, ...patch } : sec)));
  }
  function remove(i: number) {
    setSections((s) => s.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setSections((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function add() {
    setSections((s) => [...s, { id: newId(), title: "New section", kind: "rich" }]);
  }

  return (
    <form action={action} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="CEO Board Update" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" placeholder="What this template is for; when to use it." />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label>Sections</Label>
          <Button type="button" size="sm" variant="outline" onClick={add}>
            <Plus className="mr-1 h-4 w-4" />
            Add section
          </Button>
        </div>
        <div className="space-y-3">
          {sections.map((s, i) => (
            <div key={s.id} className="rounded-md border p-3">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => move(i, 1)}
                    disabled={i === sections.length - 1}
                  >
                    ↓
                  </Button>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <Input
                        placeholder="Section title"
                        value={s.title}
                        onChange={(e) => update(i, { title: e.target.value })}
                      />
                    </div>
                    <Select value={s.kind} onValueChange={(v) => update(i, { kind: v as Section["kind"] })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rich">Long-form</SelectItem>
                        <SelectItem value="text">Short text</SelectItem>
                        <SelectItem value="metric">Metric line</SelectItem>
                        <SelectItem value="checklist">Checklist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    placeholder="Prompt (optional helper text shown to the writer)"
                    value={s.prompt ?? ""}
                    onChange={(e) => update(i, { prompt: e.target.value })}
                  />
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="sectionsJson" value={JSON.stringify(sections)} />
      <div className="flex justify-end">
        <Button type="submit">Save template</Button>
      </div>
    </form>
  );
}
