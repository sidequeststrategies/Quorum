"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_ORG_COOKIE_NAME, findMembership, requireUser } from "@/lib/session";

export async function switchOrganization(formData: FormData) {
  const user = await requireUser();
  const orgId = String(formData.get("orgId"));
  const m = await findMembership(user.id, orgId);
  if (!m) throw new Error("Not a member of that organization");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE_NAME, orgId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function clearActiveOrg() {
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORG_COOKIE_NAME);
}
