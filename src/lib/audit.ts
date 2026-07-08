// Audit trail writer. Fire-and-forget: a logging failure must never break
// the action being logged — errors go to the server log only.

import { db } from "@/lib/db";
import { accessLogs } from "@/db/schema";

export type AuditAction =
  | "FILE_DOWNLOAD"
  | "FILE_UPLOAD"
  | "REPORT_CREATE"
  | "REPORT_DELETE"
  | "DOC_UPLOAD"
  | "DOC_DELETE"
  | "HUBSPOT_SYNC";

export async function logAccess(args: {
  organizationId: string;
  userId?: string | null;
  action: AuditAction;
  resource?: string;
  resourceId?: string;
  detail?: string;
}): Promise<void> {
  try {
    await db.insert(accessLogs).values({
      organizationId: args.organizationId,
      userId: args.userId ?? null,
      action: args.action,
      resource: args.resource ?? null,
      resourceId: args.resourceId ?? null,
      detail: args.detail ?? null,
    });
  } catch (e) {
    console.error("audit log write failed:", (e as Error).message);
  }
}
