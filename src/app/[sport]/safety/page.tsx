"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertTriangle,
  Ban,
  Eye,
  Lock,
  UserX,
  MessageSquare,
  HelpCircle,
  FileText,
  ChevronRight,
  ShieldAlert,
  Scale,
  HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SiteFooter from "@/components/layout/site-footer";

export default function SafetyCenterPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  const safetyTopics = [
    {
      icon: AlertTriangle,
      title: "Report Abuse",
      description: "Report players who violate community guidelines",
      href: `/${sport}/dashboard`,
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-900/30",
    },
    {
      icon: Ban,
      title: "Block Players",
      description: "Block or mute players to prevent interactions",
      href: `/${sport}/dashboard/blocked`,
      color: "text-amber-500",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
    {
      icon: Eye,
      title: "Privacy Controls",
      description: "Control who can see your profile and information",
      href: `/${sport}/dashboard/settings`,
      color: "text-blue-500",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      icon: Lock,
      title: "Account Security",
      description: "Enable 2FA and manage your sessions",
      href: `/${sport}/dashboard/security`,
      color: "text-purple-500",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      icon: Scale,
      title: "Appeal Decisions",
      description: "Appeal bans, warnings, or other moderation actions",
      href: `/${sport}/safety/appeal`,
      color: "text-emerald-500",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/30",
    },
    {
      icon: HelpCircle,
      title: "Get Help",
      description: "Contact support for assistance with safety issues",
      href: `/${sport}/contact`,
      color: "text-cyan-500",
      bgColor: "bg-cyan-100 dark:bg-cyan-900/30",
    },
  ];

  const communityGuidelines = [
    { title: "Be Respectful", description: "Treat all players with respect and courtesy" },
    { title: "No Harassment", description: "Harassment, threats, and bullying are not tolerated" },
    { title: "Fair Play", description: "Play fairly without cheating or exploiting bugs" },
    { title: "Authentic Identity", description: "Use your real identity, no impersonation" },
    { title: "Safe Content", description: "Keep all content appropriate and non-offensive" },
    { title: "Report Violations", description: "Help keep the community safe by reporting issues" },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
        <div className="max-w-4xl space-y-8">
          {/* Hero */}
          <div className="text-center py-8">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
              isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30"
            )}>
              <Shield className={cn("w-10 h-10", primaryTextClass)} />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Safety Center
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Your safety is our priority. Learn about our safety features and how to protect yourself.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {safetyTopics.map((topic) => (
              <Link key={topic.title} href={topic.href}>
                <Card className="bg-card border-border/50 shadow-sm hover:shadow-md hover:border-primary/30 transition-all h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className={cn("p-3 rounded-lg", topic.bgColor)}>
                        <topic.icon className={cn("w-5 h-5", topic.color)} />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-foreground">{topic.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {topic.description}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Community Guidelines */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HeartHandshake className={cn("w-5 h-5", primaryTextClass)} />
                Community Guidelines
              </CardTitle>
              <CardDescription>
                Rules that keep our community safe and welcoming
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {communityGuidelines.map((guideline) => (
                  <div key={guideline.title} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5",
                      primaryBtnClass
                    )}>
                      ✓
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{guideline.title}</p>
                      <p className="text-sm text-muted-foreground">{guideline.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* What Happens When You Report */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className={cn("w-5 h-5", primaryTextClass)} />
                What Happens When You Report?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                      primaryBtnClass
                    )}>1</div>
                    <div className="w-px h-full bg-border mt-2" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-foreground">Report Submitted</p>
                    <p className="text-sm text-muted-foreground">
                      Your report is sent to our moderation team for review
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                      primaryBtnClass
                    )}>2</div>
                    <div className="w-px h-full bg-border mt-2" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-foreground">Investigation</p>
                    <p className="text-sm text-muted-foreground">
                      We review the report and gather evidence
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                      primaryBtnClass
                    )}>3</div>
                    <div className="w-px h-full bg-border mt-2" />
                  </div>
                  <div className="pb-4">
                    <p className="font-medium text-foreground">Action Taken</p>
                    <p className="text-sm text-muted-foreground">
                      Appropriate action is taken based on our guidelines
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold",
                      primaryBtnClass
                    )}>4</div>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Notification</p>
                    <p className="text-sm text-muted-foreground">
                      You receive an update on the action taken (reports are anonymous)
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card className="bg-muted/30 border-border/50">
            <CardContent className="p-6 text-center">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-semibold text-foreground mb-2">
                Need Immediate Help?
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Our support team is here to help with any safety concerns
              </p>
              <Link href={`/${sport}/contact`}>
                <Button className={cn("text-white", primaryBtnClass)}>
                  Contact Support
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
