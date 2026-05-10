import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { db } from "@/lib/db";
import { coachingClients, coachingPrograms } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { initials, formatDateOnly } from "@/lib/utils";

export default async function ClientsPage() {
  const user = await requireUser();

  const clients = await db
    .select({
      c: coachingClients,
      programTitle: coachingPrograms.title,
    })
    .from(coachingClients)
    .leftJoin(coachingPrograms, eq(coachingClients.programId, coachingPrograms.id))
    .where(eq(coachingClients.ownerId, user.id))
    .orderBy(desc(coachingClients.updatedAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">Your coaching roster — relationships, programs, and notes.</p>
        </div>
        <Button asChild>
          <Link href="/coaching/clients/new">Add client</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active & past clients</CardTitle>
          <CardDescription>{clients.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <ul className="divide-y">
              {clients.map(({ c, programTitle }) => (
                <li key={c.id}>
                  <Link
                    href={`/coaching/clients/${c.id}`}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-3 hover:bg-accent"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.role}
                          {c.company ? ` · ${c.company}` : ""}
                          {programTitle ? ` · ${programTitle}` : ""}
                          {c.startDate ? ` · since ${formatDateOnly(c.startDate)}` : ""}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={c.status === "ACTIVE" ? "success" : c.status === "COMPLETED" ? "outline" : "secondary"}
                    >
                      {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
