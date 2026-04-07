"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { ProfessionVerification } from "@/components/profile/profession-verification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Award, Users, Calendar } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PROFESSION_TOURNAMENTS = [
  { name: "Doctors Championship 2025", date: "Mar 15, 2025", prize: "₹50,000", profession: "DOCTOR", status: "REGISTRATION_OPEN" },
  { name: "Lawyers League", date: "Mar 22, 2025", prize: "₹30,000", profession: "LAWYER", status: "REGISTRATION_OPEN" },
  { name: "CA Cup", date: "Apr 5, 2025", prize: "₹40,000", profession: "CHARTERED_ACCOUNTANT", status: "REGISTRATION_OPEN" },
  { name: "Engineers Open", date: "Apr 12, 2025", prize: "₹25,000", profession: "ENGINEER", status: "DRAFT" },
  { name: "Teachers Trophy", date: "Apr 20, 2025", prize: "₹20,000", profession: "TEACHER", status: "REGISTRATION_OPEN" },
  { name: "Media Masters", date: "May 1, 2025", prize: "₹35,000", profession: "JOURNALIST", status: "REGISTRATION_OPEN" },
];

export default function ProfessionPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";

  return (
    <div className="bg-background min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72 min-h-screen">
        <div className="p-6 max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${sport}/profile`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Profile
            </Button>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Profession Verification */}
            <div className="lg:col-span-2">
              <ProfessionVerification sport={sport} />
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Upcoming Tournaments */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Profession-Exclusive Tournaments
                  </CardTitle>
                  <CardDescription>
                    Tournaments reserved for verified professionals
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {PROFESSION_TOURNAMENTS.map((t) => (
                    <div
                      key={t.name}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {t.profession.replace(/_/g, " ")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{t.date}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("font-bold", primaryTextClass)}>{t.prize}</p>
                          <Badge
                            className={cn(
                              "text-xs",
                              t.status === "REGISTRATION_OPEN" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                            )}
                          >
                            {t.status === "REGISTRATION_OPEN" ? "Open" : "Coming Soon"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Benefits */}
              <Card className={cn("bg-card border-border", primaryBorderClass)}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Verification Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 p-3">
                    <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
                    <span className="text-sm">Access profession-exclusive tournaments</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
                    <span className="text-sm">Claim special rewards and prizes</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
                    <span className="text-sm">Compete with peers in your profession</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
                    <span className="text-sm">Build your professional network</span>
                  </div>
                  <div className="flex items-center gap-3 p-3">
                    <CheckCircle className={cn("h-4 w-4", primaryTextClass)} />
                    <span className="text-sm">Priority registration for tournaments</span>
                  </div>
                </CardContent>
              </Card>

              {/* Help */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Need Help?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    If you need assistance with profession verification:
                  </p>
                  <Link
                    href={`/${sport}/help`}
                    className={cn("text-sm underline", primaryTextClass)}
                  >
                    Contact Support
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
