"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  ArrowLeft,
  Sparkles,
  TrophyIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TrophyCabinet } from "@/components/profile/trophy-cabinet";

export default function TrophiesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Primary colors based on sport
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${sport}/profile`)}
              className="mb-4 text-muted-foreground"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Profile
            </Button>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center",
                  primaryBgClass
                )}>
                  <Trophy className={cn("w-7 h-7", primaryTextClass)} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    Trophy Cabinet
                  </h1>
                  <p className="text-muted-foreground">
                    Your tournament achievements and accolades
                  </p>
                </div>
              </div>
              
              <Button
                variant="outline"
                onClick={() => router.push(`/${sport}/tournaments`)}
                className="hidden sm:flex"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Find Tournaments
              </Button>
            </div>
          </div>

          {/* Info Card */}
          <Card className="mb-6 bg-gradient-to-r from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200/50 dark:border-amber-800/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center flex-shrink-0">
                  <TrophyIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">How to Earn Trophies</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Finish in the top 3 of any tournament to automatically earn a trophy. 
                    Gold for 1st place, Silver for 2nd, and Bronze for 3rd. 
                    Feature your best achievements to showcase them on your profile!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Trophy Cabinet Component */}
          <TrophyCabinet showFilters className="min-h-[400px]" />

          {/* Mobile CTA */}
          <div className="sm:hidden mt-6">
            <Button
              className={cn("w-full text-white", primaryBtnClass)}
              onClick={() => router.push(`/${sport}/tournaments`)}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Find Tournaments to Win
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
