"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  filterSuggestionItems,
} from "@blocknote/core";
import {
  SuggestionMenuController,
  createReactBlockSpec,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { AlertTriangle, CheckCircle2, Circle, Info, Lightbulb, OctagonAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveReportDocument } from "@/lib/actions/reports";
import { sectionStatuses, type DocBlock } from "@/lib/report-doc";
import type { TemplateSection } from "@/lib/report-template-defs";

// ── Branded callout block (Notion-style) ────────────────────────────────────

const CALLOUT_STYLES: Record<string, { icon: React.ReactNode; cls: string }> = {
  info: { icon: <Info className="h-4 w-4" />, cls: "border-brand-teal/40 bg-accent text-accent-foreground" },
  success: { icon: <CheckCircle2 className="h-4 w-4" />, cls: "border-emerald-300 bg-emerald-50 text-emerald-900" },
  warning: { icon: <AlertTriangle className="h-4 w-4" />, cls: "border-amber-300 bg-amber-50 text-amber-900" },
  danger: { icon: <OctagonAlert className="h-4 w-4" />, cls: "border-red-300 bg-red-50 text-red-900" },
  idea: { icon: <Lightbulb className="h-4 w-4" />, cls: "border-brand-blue/40 bg-secondary text-secondary-foreground" },
};

const Callout = createReactBlockSpec(
  {
    type: "callout",
    propSchema: {
      kind: { default: "info", values: ["info", "success", "warning", "danger", "idea"] },
    },
    content: "inline",
  },
  {
    render: (props) => {
      const kind = (props.block.props.kind as string) ?? "info";
      const style = CALLOUT_STYLES[kind] ?? CALLOUT_STYLES.info;
      return (
        <div className={cn("my-1 flex w-full items-start gap-2.5 rounded-md border p-3 text-sm", style.cls)}>
          <button
            type="button"
            contentEditable={false}
            className="mt-0.5 shrink-0 opacity-80 hover:opacity-100"
            title="Change callout type"
            onClick={() => {
              const kinds = Object.keys(CALLOUT_STYLES);
              const next = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
              props.editor.updateBlock(props.block, { props: { kind: next } } as never);
            }}
          >
            {style.icon}
          </button>
          <div ref={props.contentRef} className="min-w-0 flex-1" />
        </div>
      );
    },
  }
);

const schema = BlockNoteSchema.create({
  blockSpecs: { ...defaultBlockSpecs, callout: Callout() },
});

// ── Editor ──────────────────────────────────────────────────────────────────

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DocEditor({
  reportId,
  sections,
  initialDocument,
  editable,
}: {
  reportId: string;
  sections: TemplateSection[];
  initialDocument: DocBlock[];
  editable: boolean;
}) {
  const [saveState, setSaveState] = useState<"saved" | "saving" | "dirty" | "error">("saved");
  const [doc, setDoc] = useState<DocBlock[]>(initialDocument);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useCreateBlockNote({
    schema,
    initialContent: initialDocument.length > 0 ? (initialDocument as never) : undefined,
    uploadFile: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(`${BASE_PATH}/api/uploads`, { method: "POST", body });
      if (!res.ok) throw new Error("Upload failed");
      const json = (await res.json()) as { url: string };
      return json.url;
    },
  });

  const persist = useCallback(() => {
    const blocks = editor.document as unknown as DocBlock[];
    setSaveState("saving");
    startTransition(async () => {
      try {
        await saveReportDocument(reportId, JSON.stringify(blocks));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    });
  }, [editor, reportId]);

  const onChange = useCallback(() => {
    setDoc(editor.document as unknown as DocBlock[]);
    if (!editable) return;
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(persist, 1200);
  }, [editor, editable, persist]);

  const statuses = useMemo(() => sectionStatuses(doc, sections), [doc, sections]);

  const jumpToSection = useCallback(
    (title: string) => {
      const target = (editor.document as unknown as DocBlock[]).find(
        (b) =>
          b.type === "heading" &&
          Array.isArray(b.content) &&
          b.content.map((c) => c.text ?? "").join("").trim().toLowerCase() === title.trim().toLowerCase()
      );
      if (!target?.id) return;
      document.querySelector(`[data-id="${target.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [editor]
  );

  const restoreSection = useCallback(
    (title: string) => {
      const blocks = editor.document;
      const last = blocks[blocks.length - 1];
      editor.insertBlocks(
        [
          { type: "heading", props: { level: 2 }, content: title },
          { type: "paragraph", content: "" },
        ] as never[],
        last ?? (undefined as never),
        "after"
      );
      onChange();
    },
    [editor, onChange]
  );

  return (
    <div className="flex gap-6">
      {/* Document canvas */}
      <div className="min-w-0 flex-1 rounded-lg border bg-card py-6">
        <BlockNoteView
          editor={editor}
          editable={editable}
          theme="light"
          onChange={onChange}
          slashMenu={false}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                [
                  ...getDefaultReactSlashMenuItems(editor),
                  {
                    title: "Callout",
                    subtext: "Highlight a key point for the board",
                    aliases: ["callout", "note", "highlight"],
                    group: "Basic blocks",
                    icon: <Info className="h-4 w-4" />,
                    onItemClick: () => {
                      const current = editor.getTextCursorPosition().block;
                      const isEmpty =
                        current.type === "paragraph" &&
                        (!Array.isArray(current.content) || current.content.length === 0);
                      if (isEmpty) {
                        editor.updateBlock(current, { type: "callout" } as never);
                      } else {
                        editor.insertBlocks([{ type: "callout" } as never], current, "after");
                      }
                    },
                  },
                ],
                query
              )
            }
          />
        </BlockNoteView>
      </div>

      {/* Section outline — the rigid skeleton */}
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Report sections</p>
            <SaveBadge state={saveState} />
          </div>
          <ol className="space-y-1">
            {statuses.map((s, i) => {
              const section = sections.find((x) => x.id === s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => (s.present ? jumpToSection(s.title) : undefined)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                      !s.present && "opacity-70"
                    )}
                    title={section?.prompt}
                  >
                    {s.hasContent ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate">
                        {i + 1}. {s.title}
                      </span>
                      {!s.present && editable ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-amber-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreSection(s.title);
                          }}
                        >
                          Section missing — restore
                        </Button>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="px-2 text-xs text-muted-foreground">
            Type <kbd className="rounded border bg-muted px-1">/</kbd> for blocks: headings, lists, callouts,
            images, tables. Keep the section headings — they anchor the published layout.
          </p>
        </div>
      </aside>
    </div>
  );
}

function SaveBadge({ state }: { state: "saved" | "saving" | "dirty" | "error" }) {
  const label = state === "saved" ? "Saved" : state === "saving" ? "Saving…" : state === "dirty" ? "Editing…" : "Save failed";
  const cls =
    state === "saved"
      ? "text-emerald-700"
      : state === "error"
        ? "text-red-700"
        : "text-muted-foreground";
  return <span className={cn("text-xs font-medium", cls)}>{label}</span>;
}
