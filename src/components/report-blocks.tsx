// Server-side renderer for the report block document (BlockNote JSON) with
// document-grade typography. Used by the branded published view — the editor
// never touches this, so publish styling stays rigid regardless of how the
// content was written.

import { cn } from "@/lib/utils";
import type { DocBlock, InlineNode } from "@/lib/report-doc";

function InlineContent({ nodes }: { nodes: InlineNode[] | undefined }) {
  if (!nodes) return null;
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === "link") {
          return (
            <a key={i} href={n.href} className="text-brand-blue underline underline-offset-2" target="_blank" rel="noreferrer">
              <InlineContent nodes={n.content} />
            </a>
          );
        }
        const s = (n.styles ?? {}) as Record<string, unknown>;
        let el: React.ReactNode = n.text ?? "";
        if (s.code) el = <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{el}</code>;
        if (s.bold) el = <strong>{el}</strong>;
        if (s.italic) el = <em>{el}</em>;
        if (s.underline) el = <u>{el}</u>;
        if (s.strike) el = <s>{el}</s>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

const CALLOUT_CLS: Record<string, string> = {
  info: "border-brand-teal/50 bg-accent",
  success: "border-emerald-300 bg-emerald-50",
  warning: "border-amber-300 bg-amber-50",
  danger: "border-red-300 bg-red-50",
  idea: "border-brand-blue/40 bg-secondary",
};

type TableContent = { type: string; rows?: { cells: (InlineNode[] | { content: InlineNode[] })[] }[] };

function cellNodes(cell: InlineNode[] | { content: InlineNode[] }): InlineNode[] {
  return Array.isArray(cell) ? cell : (cell.content ?? []);
}

function Table({ content }: { content: TableContent }) {
  const rows = content.rows ?? [];
  if (rows.length === 0) return null;
  const [head, ...body] = rows;
  return (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-primary/70 bg-secondary text-left">
            {head.cells.map((c, i) => (
              <th key={i} className="px-3 py-2 font-semibold">
                <InlineContent nodes={cellNodes(c)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="border-b last:border-0">
              {r.cells.map((c, ci) => (
                <td key={ci} className="px-3 py-2 align-top">
                  <InlineContent nodes={cellNodes(c)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Block({ b }: { b: DocBlock }) {
  const inline = Array.isArray(b.content) ? b.content : undefined;
  const children = b.children?.length ? (
    <div className="ml-5">
      <Blocks blocks={b.children} />
    </div>
  ) : null;

  switch (b.type) {
    case "heading": {
      const level = Number(b.props?.level ?? 2);
      if (level <= 2)
        return (
          <h3 className="mt-5 text-base font-bold uppercase tracking-wide text-primary">
            <InlineContent nodes={inline} />
          </h3>
        );
      return (
        <h4 className="mt-4 text-sm font-semibold text-foreground">
          <InlineContent nodes={inline} />
        </h4>
      );
    }
    case "paragraph": {
      const empty = !inline || inline.every((n) => !(n.text ?? "").trim());
      if (empty) return null;
      return (
        <p className="my-2 text-sm leading-relaxed">
          <InlineContent nodes={inline} />
        </p>
      );
    }
    case "bulletListItem":
      return (
        <li className="my-1 ml-5 list-disc text-sm leading-relaxed marker:text-brand-teal">
          <InlineContent nodes={inline} />
          {children}
        </li>
      );
    case "numberedListItem":
      return (
        <li className="my-1 ml-5 list-decimal text-sm leading-relaxed marker:font-semibold marker:text-primary">
          <InlineContent nodes={inline} />
          {children}
        </li>
      );
    case "checkListItem":
      return (
        <li className="my-1 flex items-start gap-2 text-sm leading-relaxed">
          <span
            className={cn(
              "mt-0.5 inline-block h-3.5 w-3.5 shrink-0 rounded-sm border",
              b.props?.checked ? "border-brand-teal bg-brand-teal" : "border-muted-foreground"
            )}
          />
          <span className={b.props?.checked ? "text-muted-foreground line-through" : ""}>
            <InlineContent nodes={inline} />
          </span>
        </li>
      );
    case "quote":
      return (
        <blockquote className="my-3 border-l-4 border-brand-teal pl-4 text-sm italic text-muted-foreground">
          <InlineContent nodes={inline} />
        </blockquote>
      );
    case "callout": {
      const kind = String(b.props?.kind ?? "info");
      return (
        <div className={cn("my-3 rounded-md border p-3 text-sm leading-relaxed", CALLOUT_CLS[kind] ?? CALLOUT_CLS.info)}>
          <InlineContent nodes={inline} />
        </div>
      );
    }
    case "divider":
      return <hr className="my-4 border-border" />;
    case "image": {
      const url = String(b.props?.url ?? "");
      if (!url) return null;
      const caption = String(b.props?.caption ?? "");
      return (
        <figure className="my-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={caption || "Report image"} className="mx-auto max-h-[480px] rounded-md border" />
          {caption ? <figcaption className="mt-1 text-center text-xs text-muted-foreground">{caption}</figcaption> : null}
        </figure>
      );
    }
    case "codeBlock":
      return (
        <pre className="my-3 overflow-x-auto rounded-md bg-primary p-3 text-xs text-primary-foreground">
          <code>{inline?.map((n) => n.text ?? "").join("")}</code>
        </pre>
      );
    case "table":
      return <Table content={(b.content ?? {}) as TableContent} />;
    case "toggleListItem":
      return (
        <div className="my-1 text-sm leading-relaxed">
          <span className="font-medium">
            <InlineContent nodes={inline} />
          </span>
          {children}
        </div>
      );
    default: {
      if (!inline) return null;
      return (
        <p className="my-2 text-sm leading-relaxed">
          <InlineContent nodes={inline} />
        </p>
      );
    }
  }
}

// Groups consecutive list items into proper <ul>/<ol> containers.
export function Blocks({ blocks }: { blocks: DocBlock[] }) {
  const out: React.ReactNode[] = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === "bulletListItem" || b.type === "checkListItem") {
      const group: DocBlock[] = [];
      const t = b.type;
      while (i < blocks.length && blocks[i].type === t) group.push(blocks[i++]);
      out.push(
        <ul key={`ul-${i}`} className="my-2">
          {group.map((g, gi) => (
            <Block key={g.id ?? gi} b={g} />
          ))}
        </ul>
      );
      continue;
    }
    if (b.type === "numberedListItem") {
      const group: DocBlock[] = [];
      while (i < blocks.length && blocks[i].type === "numberedListItem") group.push(blocks[i++]);
      out.push(
        <ol key={`ol-${i}`} className="my-2">
          {group.map((g, gi) => (
            <Block key={g.id ?? gi} b={g} />
          ))}
        </ol>
      );
      continue;
    }
    out.push(<Block key={b.id ?? i} b={b} />);
    i++;
  }
  return <>{out}</>;
}
