"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquareOff } from "lucide-react";

export default function TournamentChatPage() {
  const params = useParams();
  const sport = params.sport as string;
  const tournamentId = params.id as string;

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <MessageSquareOff className="h-6 w-6" />
            Tournament Chat Is Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Live tournament chat is not enabled for the MVP deployment yet.
          </p>
          <p>
            You can still view tournament details and brackets from the tournament page.
          </p>
          <Link href={`/${sport}/tournaments/${tournamentId}`}>
            <Button>Back to Tournament</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
