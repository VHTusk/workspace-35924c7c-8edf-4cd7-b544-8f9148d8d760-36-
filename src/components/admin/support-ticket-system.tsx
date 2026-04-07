"use client";

import Link from "next/link";
import { LifeBuoy, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function SupportTicketSystem() {
  return (
    <Card className="mx-auto max-w-3xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <LifeBuoy className="h-7 w-7 text-muted-foreground" />
        </div>
        <CardTitle>Support ticket inbox unavailable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 font-medium text-foreground">
          <ShieldAlert className="h-4 w-4" />
          Sample support tickets have been removed from this repository.
        </div>
        <p>
          Connect this screen to a live support backend before enabling it again.
        </p>
        <Link href="/help">
          <Button>Go to help</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
