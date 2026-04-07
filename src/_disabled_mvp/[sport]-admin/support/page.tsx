"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SupportTicketSystem } from "@/components/admin/support-ticket-system";
import { MassCommunicationTool } from "@/components/admin/mass-communication-tool";
import {
  Ticket,
  Megaphone,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiteFooter from "@/components/layout/site-footer";

export default function SupportPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Activity className={cn("w-6 h-6", primaryTextClass)} />
              Support & Communication
            </h1>
            <p className="text-muted-foreground">Manage support tickets and send mass communications</p>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="tickets" className="space-y-6">
            <TabsList>
              <TabsTrigger value="tickets" className="gap-2">
                <Ticket className="w-4 h-4" />
                Support Tickets
              </TabsTrigger>
              <TabsTrigger value="communications" className="gap-2">
                <Megaphone className="w-4 h-4" />
                Mass Communication
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tickets">
              <SupportTicketSystem />
            </TabsContent>

            <TabsContent value="communications">
              <MassCommunicationTool />
            </TabsContent>
          </Tabs>
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
