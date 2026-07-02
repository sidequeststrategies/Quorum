// Two-way sync between board reports and Notion pages.
//
// Push: writes the report as a Notion page (one heading per template section,
// paragraphs underneath) under the page configured by NOTION_REPORTS_PAGE_ID.
// Pull: reads the page back, mapping headings to sections, so edits made in
// Notion — by hand or via Claude through the Notion MCP server — flow into
// the app.
//
// Setup (one-time): create an internal Notion integration, share the target
// parent page with it, then set:
//   NOTION_TOKEN=ntn_...            (integration secret)
//   NOTION_REPORTS_PAGE_ID=<id of the "Board Reports" page>

import { Client } from "@notionhq/client";
import type { Report } from "@/db/schema";
import type { TemplateSection } from "@/lib/report-template-defs";

export const notionConfigured = !!process.env.NOTION_TOKEN && !!process.env.NOTION_REPORTS_PAGE_ID;

function notion() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

type Block = Record<string, unknown>;

// Notion caps rich_text content at 2000 chars per block.
function chunk(text: string, size = 1900): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out.length ? out : [""];
}

function paragraphBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const isBullet = /^[-•*]\s+/.test(trimmed);
    const content = isBullet ? trimmed.replace(/^[-•*]\s+/, "") : trimmed;
    for (const piece of chunk(content)) {
      blocks.push(
        isBullet
          ? { object: "block", type: "bulleted_list_item", bulleted_list_item: { rich_text: [{ type: "text", text: { content: piece } }] } }
          : { object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: piece } }] } }
      );
    }
  }
  return blocks;
}

function reportBlocks(sections: TemplateSection[], values: Record<string, string>): Block[] {
  const blocks: Block[] = [];
  for (const s of sections) {
    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: [{ type: "text", text: { content: s.title } }] },
    });
    const value = values[s.id];
    if (value?.trim()) {
      blocks.push(...paragraphBlocks(value));
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content: "—" }, annotations: { color: "gray" } }] },
      });
    }
  }
  return blocks;
}

async function clearPageChildren(client: Client, pageId: string) {
  let cursor: string | undefined;
  const ids: string[] = [];
  do {
    const res = await client.blocks.children.list({ block_id: pageId, start_cursor: cursor, page_size: 100 });
    ids.push(...res.results.map((b) => b.id));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  for (const id of ids) {
    await client.blocks.delete({ block_id: id });
  }
}

// Returns the Notion page id (created or updated).
export async function pushReportToNotion(
  report: Report,
  sections: TemplateSection[],
  values: Record<string, string>
): Promise<string> {
  const client = notion();
  const blocks = reportBlocks(sections, values);

  if (report.notionPageId) {
    try {
      await client.pages.update({
        page_id: report.notionPageId,
        properties: { title: { title: [{ type: "text", text: { content: report.title } }] } },
      });
      await clearPageChildren(client, report.notionPageId);
      // Notion caps children per append call at 100.
      for (let i = 0; i < blocks.length; i += 90) {
        await client.blocks.children.append({
          block_id: report.notionPageId,
          children: blocks.slice(i, i + 90) as never[],
        });
      }
      return report.notionPageId;
    } catch {
      // Page deleted/moved out of reach — fall through and create fresh.
    }
  }

  const page = await client.pages.create({
    parent: { page_id: process.env.NOTION_REPORTS_PAGE_ID! },
    properties: { title: { title: [{ type: "text", text: { content: report.title } }] } },
    children: blocks.slice(0, 90) as never[],
  });
  for (let i = 90; i < blocks.length; i += 90) {
    await client.blocks.children.append({ block_id: page.id, children: blocks.slice(i, i + 90) as never[] });
  }
  return page.id;
}

function blockText(b: Record<string, unknown>): string | null {
  const type = b.type as string;
  const data = b[type] as { rich_text?: { plain_text?: string }[] } | undefined;
  if (!data?.rich_text) return null;
  const text = data.rich_text.map((t) => t.plain_text ?? "").join("");
  if (type === "bulleted_list_item" || type === "numbered_list_item") return `- ${text}`;
  return text;
}

// Reads the Notion page and maps headings back to section values.
export async function pullReportFromNotion(
  notionPageId: string,
  sections: TemplateSection[]
): Promise<Record<string, string>> {
  const client = notion();
  const byTitle = new Map(sections.map((s) => [s.title.toLowerCase().trim(), s.id]));

  const values: Record<string, string> = {};
  let currentSectionId: string | null = null;
  let cursor: string | undefined;

  do {
    const res = await client.blocks.children.list({
      block_id: notionPageId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const raw of res.results) {
      const b = raw as unknown as Record<string, unknown>;
      const type = b.type as string;
      const text = blockText(b);
      if (text == null) continue;
      if (type.startsWith("heading")) {
        currentSectionId = byTitle.get(text.toLowerCase().trim()) ?? null;
        continue;
      }
      if (!currentSectionId) continue;
      const cleaned = text.trim();
      if (!cleaned || cleaned === "—") continue;
      values[currentSectionId] = values[currentSectionId] ? `${values[currentSectionId]}\n${cleaned}` : cleaned;
    }
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return values;
}
