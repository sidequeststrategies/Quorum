"use server";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { getSupabaseServer, supabaseConfigured } from "@/lib/supabase";

export async function logoutAction() {
  if (supabaseConfigured) {
    const supabase = await getSupabaseServer();
    await supabase.auth.signOut();
    redirect("/");
  }
  await signOut({ redirectTo: "/" });
}
