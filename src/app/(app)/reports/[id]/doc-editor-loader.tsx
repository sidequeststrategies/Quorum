"use client";

// BlockNote manipulates the DOM directly and can't server-render; load it
// client-side only.
import dynamic from "next/dynamic";

export const DocEditorLoader = dynamic(() => import("./doc-editor").then((m) => m.DocEditor), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center rounded-lg border bg-card text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});
