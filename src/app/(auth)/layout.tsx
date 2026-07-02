import Link from "next/link";
import { BrandWordmark } from "@/components/brand-logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container flex h-16 items-center">
          <Link href="/">
            <BrandWordmark />
          </Link>
        </div>
      </header>
      <main className="container flex flex-1 items-center justify-center py-12">{children}</main>
    </div>
  );
}
