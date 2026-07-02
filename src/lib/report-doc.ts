// Report document helpers — pure functions over BlockNote's JSON so both the
// client editor and server renderer share one model. The template's sections
// are the rigid skeleton: headings in the document are matched to canonical
// section titles, and everything under a heading belongs to that section.

import type { TemplateSection } from "@/lib/report-template-defs";

export type InlineNode = {
  type?: string;
  text?: string;
  styles?: Record<string, unknown>;
  content?: InlineNode[];
  href?: string;
};

export type DocBlock = {
  id?: string;
  type: string;
  props?: Record<string, unknown>;
  content?: InlineNode[] | { type: string; rows?: { cells: InlineNode[][] }[] };
  children?: DocBlock[];
};

export function inlineText(content: DocBlock["content"]): string {
  if (!content) return "";
  if (!Array.isArray(content)) return "";
  return content
    .map((n) => (n.text ?? (Array.isArray(n.content) ? inlineText(n.content) : "")) || "")
    .join("");
}

function isHeading(b: DocBlock): boolean {
  return b.type === "heading";
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Build the initial document for a report: one H2 per template section, with
// any existing per-section text converted to paragraphs/bullets underneath.
export function seedDocFromValues(sections: TemplateSection[], values: Record<string, string>): DocBlock[] {
  const blocks: DocBlock[] = [];
  for (const s of sections) {
    blocks.push({
      type: "heading",
      props: { level: 2 },
      content: [{ type: "text", text: s.title, styles: {} }],
    });
    const value = values[s.id]?.trim();
    if (value) {
      for (const rawLine of value.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        const bullet = /^[-•*]\s+/.test(line);
        blocks.push({
          type: bullet ? "bulletListItem" : "paragraph",
          content: [{ type: "text", text: bullet ? line.replace(/^[-•*]\s+/, "") : line, styles: {} }],
        });
      }
    } else if (s.prompt) {
      // Empty section: leave one empty paragraph; the editor shows the prompt
      // in the sidebar so the canvas stays clean.
      blocks.push({ type: "paragraph", content: [] });
    }
  }
  return blocks;
}

// Group the document's top-level blocks by canonical section. Blocks before
// the first recognized heading land in "_preamble"; unrecognized headings and
// their content attach to the previous section (freeform subheadings are fine).
export function groupBlocksBySection(
  blocks: DocBlock[],
  sections: TemplateSection[]
): { bySection: Map<string, DocBlock[]>; preamble: DocBlock[] } {
  const titleToId = new Map(sections.map((s) => [norm(s.title), s.id]));
  const bySection = new Map<string, DocBlock[]>();
  const preamble: DocBlock[] = [];
  let current: string | null = null;

  for (const b of blocks) {
    if (isHeading(b)) {
      const id = titleToId.get(norm(inlineText(b.content)));
      if (id) {
        current = id;
        if (!bySection.has(id)) bySection.set(id, []);
        continue; // canonical headings are re-rendered by the publisher
      }
    }
    if (current) {
      bySection.get(current)!.push(b);
    } else {
      preamble.push(b);
    }
  }
  return { bySection, preamble };
}

// Plain-text projection per section — keeps `values` (used by the board pack
// publisher and Notion sync) in lockstep with the document.
export function extractValuesFromDoc(blocks: DocBlock[], sections: TemplateSection[]): Record<string, string> {
  const { bySection } = groupBlocksBySection(blocks, sections);
  const values: Record<string, string> = {};
  for (const s of sections) {
    const sectionBlocks = bySection.get(s.id);
    if (!sectionBlocks) continue;
    const lines: string[] = [];
    const walk = (bs: DocBlock[], depth = 0) => {
      for (const b of bs) {
        const text = inlineText(b.content).trim();
        if (text) {
          const prefix =
            b.type === "bulletListItem" || b.type === "checkListItem"
              ? `${"  ".repeat(depth)}- `
              : b.type === "numberedListItem"
                ? `${"  ".repeat(depth)}1. `
                : b.type === "heading"
                  ? "## "
                  : "";
          lines.push(prefix + text);
        }
        if (b.children?.length) walk(b.children, depth + 1);
      }
    };
    walk(sectionBlocks);
    const joined = lines.join("\n").trim();
    if (joined) values[s.id] = joined;
  }
  return values;
}

export type SectionStatus = { id: string; title: string; present: boolean; hasContent: boolean };

export function sectionStatuses(blocks: DocBlock[], sections: TemplateSection[]): SectionStatus[] {
  const { bySection } = groupBlocksBySection(blocks, sections);
  return sections.map((s) => {
    const sb = bySection.get(s.id);
    return {
      id: s.id,
      title: s.title,
      present: sb != null,
      hasContent: !!sb && sb.some((b) => inlineText(b.content).trim().length > 0 || b.type === "image"),
    };
  });
}
