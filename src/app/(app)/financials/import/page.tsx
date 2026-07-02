import { redirect } from "next/navigation";
import { canManage, requireMembership } from "@/lib/session";
import { ImportClient } from "./import-client";

export default async function ImportFinancialsPage() {
  const { membership } = await requireMembership();
  if (!canManage(membership.role)) redirect("/financials");
  return <ImportClient />;
}
