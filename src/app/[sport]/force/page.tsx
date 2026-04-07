"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function ForceListPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <ShieldAlert className="h-6 w-6" />
            Forces Are Not Part of the MVP Launch
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The forces and restricted leaderboard experience is being finished after the first production launch.
          </p>
          <p>
            Core tournament discovery, registration, and dashboards remain available.
          </p>
          <Link href={`/${sport}/tournaments`}>
            <Button>Browse Tournaments</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
