"use server";
// Manual "Sync from HubSpot" trigger for the funnel section. The scheduled
// path is maybeAutoSyncHubSpotFunnel on financials page views; this action
// exists for the moment after a pipeline review when someone wants the
// numbers current right now.

import { revalidatePath } from "next/cache";
import { canManage, requireMembership } from "@/lib/session";
import { hubspotConfigured, syncHubSpotFunnel } from "@/lib/hubspot";
import { logAccess } from "@/lib/audit";

export async function syncHubSpotFunnelAction() {
  const { user, membership } = await requireMembership();
  if (!canManage(membership.role)) throw new Error("Only owners/admins can sync from HubSpot.");
  if (!hubspotConfigured()) throw new Error("HubSpot is not configured (HUBSPOT_ACCESS_TOKEN is unset).");

  const result = await syncHubSpotFunnel(membership.organizationId);

  await logAccess({
    organizationId: membership.organizationId,
    userId: user.id,
    action: "HUBSPOT_SYNC",
    resource: "funnel",
    detail: `${result.deals} deals → ${result.months} months`,
  });

  revalidatePath("/financials");
}
