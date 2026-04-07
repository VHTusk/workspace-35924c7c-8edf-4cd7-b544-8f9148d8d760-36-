"use client";

import Link from "next/link";
import { Building2, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CorporateModeDashboard() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="mx-auto max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-2xl">Corporate dashboard unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2 font-medium text-foreground">
              <ShieldAlert className="h-4 w-4" />
              Demo organization data has been removed from this project.
            </div>
            <p>
              This dashboard needs a connected organization account and live corporate data before it can be shown safely.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Link href="/">
                <Button>Back to home</Button>
              </Link>
              <Link href="/help">
                <Button variant="outline">Contact support</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
