import Link from "next/link";
import { Vote } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Vote className="h-4 w-4" />
            </div>
            Quorum
          </Link>
        </div>
      </header>
      <main className="container flex flex-1 items-center justify-center py-12">{children}</main>
    </div>
  );
}
