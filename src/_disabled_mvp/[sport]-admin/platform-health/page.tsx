"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlatformHealthPage() {
  const params = useParams();
  const sport = params.sport as string;

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
        <Card className="w-full border-gray-200 shadow-sm">
          <CardHeader className="space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Platform Health Is Postponed</CardTitle>
              <CardDescription>
                Super-admin monitoring, alert rules, and alert history are not included in the MVP deployment.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4" />
                Coming back later
              </div>
              This keeps the launch build stable while the monitoring backend is finished against the live Prisma schema.
            </div>

            <Button asChild variant="outline">
              <Link href={`/${sport}/admin/dashboard`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Admin Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
