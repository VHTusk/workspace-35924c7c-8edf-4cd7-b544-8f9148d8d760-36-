"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  MapPin,
  Calendar,
  Trophy,
  Users,
  Clock,
  IndianRupee,
  ChevronRight,
} from "lucide-react";
import { TournamentStatusBadge } from "@/components/tournament/tournament-status-badge";

interface TournamentCardProps {
  tournament: {
    id: string;
    name: string;
    sport: string;
    type: string;
    scope: string | null;
    location: string;
    city: string | null;
    state: string | null;
    startDate: string;
    endDate: string;
    regDeadline: string;
    prizePool: number;
    entryFee: number;
    maxPlayers: number;
    currentRegistrations: number;
    status: string;
    bracketFormat: string | null;
    hostOrg: {
      id: string;
      name: string;
      logoUrl: string | null;
    } | null;
    earlyBirdFee: number | null;
    earlyBirdDeadline: string | null;
  };
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const isCornhole = tournament.sport === "CORNHOLE";
  const primaryColor = isCornhole ? "green" : "teal";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";
  
  const registrationPercent = Math.min(
    (tournament.currentRegistrations / tournament.maxPlayers) * 100,
    100
  );

  const startDate = new Date(tournament.startDate);
  const endDate = new Date(tournament.endDate);
  const regDeadline = new Date(tournament.regDeadline);
  const now = new Date();

  const isRegistrationOpen = tournament.status === "REGISTRATION_OPEN" && 
    regDeadline > now &&
    tournament.currentRegistrations < tournament.maxPlayers;

  const isEarlyBird = tournament.earlyBirdDeadline && 
    new Date(tournament.earlyBirdDeadline) > now;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getScopeLabel = (scope: string | null) => {
    if (!scope) return null;
    return scope.charAt(0) + scope.slice(1).toLowerCase();
  };

  return (
    <Link href={`/tournaments/${tournament.id}`}>
      <Card className={`hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:${primaryBorderClass} group`}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className={`${primaryBgClass} ${primaryTextClass} ${primaryBorderClass}`}>
                  {isCornhole ? "Cornhole" : "Darts"}
                </Badge>
                {tournament.scope && (
                  <Badge variant="secondary" className="text-xs">
                    {getScopeLabel(tournament.scope)}
                  </Badge>
                )}
                <TournamentStatusBadge
                  startDate={tournament.startDate}
                  endDate={tournament.endDate}
                  dbStatus={tournament.status}
                  size="sm"
                />
              </div>
              <CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                {tournament.name}
              </CardTitle>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Location & Date */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 shrink-0" />
              <span className="truncate">{tournament.location}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>
                {formatDate(startDate)}
                {startDate.toDateString() !== endDate.toDateString() && (
                  <span> - {formatDate(endDate)}</span>
                )}
              </span>
            </div>
          </div>

          {/* Prize Pool & Entry Fee */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className={`w-5 h-5 ${primaryTextClass}`} />
              <div>
                <p className="text-xs text-muted-foreground">Prize Pool</p>
                <p className="font-bold text-lg text-foreground">{formatCurrency(tournament.prizePool)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Entry Fee</p>
              {isEarlyBird && tournament.earlyBirdFee ? (
                <div>
                  <p className="font-semibold line-through text-muted-foreground text-sm">
                    {formatCurrency(tournament.entryFee)}
                  </p>
                  <p className={`font-bold ${primaryTextClass}`}>
                    {formatCurrency(tournament.earlyBirdFee)}
                    <span className="text-xs ml-1 text-amber-500">Early Bird</span>
                  </p>
                </div>
              ) : (
                <p className="font-bold text-foreground">{formatCurrency(tournament.entryFee)}</p>
              )}
            </div>
          </div>

          {/* Registration Progress */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{tournament.currentRegistrations} / {tournament.maxPlayers}</span>
              </div>
              {isRegistrationOpen && (
                <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Reg ends {formatDate(regDeadline)}</span>
                </div>
              )}
            </div>
            <Progress 
              value={registrationPercent} 
              className={`h-2 ${registrationPercent >= 90 ? "bg-red-100 dark:bg-red-950/30" : ""}`}
            />
          </div>

          {/* Host Organization */}
          {tournament.hostOrg && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Hosted by <span className="font-medium text-foreground">{tournament.hostOrg.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
