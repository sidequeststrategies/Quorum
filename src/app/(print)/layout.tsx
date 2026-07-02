// Minimal chrome for print-grade pages (published reports): no app nav or
// header — the document is the whole page.
export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white text-foreground">{children}</div>;
}
