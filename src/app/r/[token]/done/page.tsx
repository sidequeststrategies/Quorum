import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function IntakeThanksPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Thanks — you&apos;re in.</CardTitle>
          <CardDescription>
            Your responses have been delivered to the organizer. See you at the retreat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You can close this tab.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
