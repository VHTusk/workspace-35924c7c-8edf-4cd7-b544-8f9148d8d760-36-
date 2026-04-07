"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

export default function ForceDetailPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <ShieldAlert className="h-6 w-6" />
            Force Detail Is Temporarily Disabled
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This restricted force experience depends on an unfinished client session layer and is not included in the production MVP.
          </p>
          <Link href={`/${sport}/force`}>
            <Button variant="outline">Back to Forces</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
