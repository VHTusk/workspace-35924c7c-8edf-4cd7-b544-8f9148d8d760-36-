"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  MapPin,
  Calendar,
  Trophy,
  Users,
  Clock,
  ChevronRight,
  ExternalLink,
  Phone,
  MessageCircle,
  User,
  Lock,
  Map,
} from "lucide-react";
import { TournamentStatusBadge, getTournamentCardClasses } from "@/components/tournament/tournament-status-badge";
import { cn } from "@/lib/utils";

// WhatsApp link generator helper
const getWhatsAppLink = (phone: string, message?: string) => {
  // Remove any spaces, dashes, or other characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  
  // Format phone number
  let formattedPhone: string;
  if (cleaned.startsWith('+')) {
    formattedPhone = cleaned.substring(1);
  } else if (cleaned.startsWith('0')) {
    formattedPhone = '91' + cleaned.substring(1);
  } else if (cleaned.length === 10) {
    formattedPhone = '91' + cleaned;
  } else {
    formattedPhone = cleaned;
  }
  
  const encodedMessage = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${formattedPhone}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
};

// Contact details component - only shown to registered players
function ContactDetails({ 
  isRegistered, 
  managerName, 
  managerPhone, 
  managerWhatsApp,
  contactPersonName,
  contactPersonPhone,
  contactPersonWhatsApp,
  tournamentName 
}: { 
  isRegistered: boolean;
  managerName: string;
  managerPhone: string;
  managerWhatsApp: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonWhatsApp: string | null;
  tournamentName: string;
}) {
  if (!isRegistered) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm p-3 bg-muted/30 rounded-lg">
        <Lock className="w-4 h-4" />
        <span>Contact details available after registration</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Tournament Manager */}
      <div className="p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Tournament Manager</span>
          <Badge variant="outline" className="text-xs">Primary</Badge>
        </div>
        <p className="font-semibold">{managerName}</p>
        <div className="flex items-center gap-2 mt-2">
          <a 
            href={`tel:${managerPhone}`}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{managerPhone}</span>
          </a>
        </div>
        <div className="flex gap-2 mt-2">
          <a
            href={getWhatsAppLink(
              managerWhatsApp || managerPhone,
              `Hi ${managerName}, I have a query about ${tournamentName} tournament.`
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-full transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Contact Person (if exists) */}
      {contactPersonName && contactPersonPhone && (
        <div className="p-3 bg-card border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <User className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">Contact Person</span>
          </div>
          <p className="font-semibold">{contactPersonName}</p>
          <div className="flex items-center gap-2 mt-2">
            <a 
              href={`tel:${contactPersonPhone}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{contactPersonPhone}</span>
            </a>
          </div>
          {(contactPersonWhatsApp || contactPersonPhone) && (
            <div className="flex gap-2 mt-2">
              <a
                href={getWhatsAppLink(
                  contactPersonWhatsApp || contactPersonPhone,
                  `Hi ${contactPersonName}, I have a query about ${tournamentName} tournament.`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-full transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface EnhancedTournamentCardProps {
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
    venueGoogleMapsUrl: string | null;
    managerName: string;
    managerPhone: string;
    managerWhatsApp: string | null;
    contactPersonName: string | null;
    contactPersonPhone: string | null;
    contactPersonWhatsApp: string | null;
    hostOrg: {
      id: string;
      name: string;
      logoUrl: string | null;
    } | null;
    earlyBirdFee: number | null;
    earlyBirdDeadline: string | null;
  };
  isRegistered?: boolean; // Whether current user is registered for this tournament
  isAuthenticated?: boolean; // Whether user is logged in
}

export function EnhancedTournamentCard({ 
  tournament, 
  isRegistered = false,
  isAuthenticated = false 
}: EnhancedTournamentCardProps) {
  const [showContactDialog, setShowContactDialog] = useState(false);
  
  const isCornhole = tournament.sport === "CORNHOLE";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";
  
  // Get status-based card styling
  const { cardClass: statusCardClass, statusInfo } = getTournamentCardClasses(
    tournament.startDate,
    tournament.endDate,
    tournament.status
  );
  
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

  // Dim completed tournaments
  const isCompleted = statusInfo.status === 'completed';

  return (
    <Card className={cn(
      "hover:shadow-lg transition-all duration-200 cursor-pointer border-2 group border-border",
      statusCardClass,
      isCompleted && "opacity-75 hover:opacity-100"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge variant="outline" className={cn(primaryBgClass, primaryTextClass, primaryBorderClass)}>
                {isCornhole ? "Cornhole" : "Darts"}
              </Badge>
              {tournament.scope && (
                <Badge variant="secondary" className="text-xs">
                  {getScopeLabel(tournament.scope)}
                </Badge>
              )}
              {/* Centralized Status Badge */}
              <TournamentStatusBadge
                startDate={tournament.startDate}
                endDate={tournament.endDate}
                dbStatus={tournament.status}
                size="sm"
              />
              {isRegistered && (
                <Badge className="bg-blue-500 text-xs">Registered</Badge>
              )}
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
          <div className="flex items-start gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="truncate block">{tournament.location}</span>
              {tournament.venueGoogleMapsUrl && (
                <a
                  href={tournament.venueGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Map className="w-3 h-3" />
                  <span>View on Map</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              )}
            </div>
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
            <Trophy className={cn("w-5 h-5", primaryTextClass)} />
            <div>
              <p className="text-xs text-muted-foreground">Prize Pool</p>
              <p className="font-bold text-lg">{formatCurrency(tournament.prizePool)}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Entry Fee</p>
            {isEarlyBird && tournament.earlyBirdFee ? (
              <div>
                <p className="font-semibold line-through text-muted-foreground text-sm">
                  {formatCurrency(tournament.entryFee)}
                </p>
                <p className={cn("font-bold", primaryTextClass)}>
                  {formatCurrency(tournament.earlyBirdFee)}
                  <span className="text-xs ml-1 text-amber-500">Early Bird</span>
                </p>
              </div>
            ) : (
              <p className="font-bold">{formatCurrency(tournament.entryFee)}</p>
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
            className={cn("h-2", registrationPercent >= 90 && "bg-red-100 dark:bg-red-950/30")}
          />
        </div>

        {/* Tournament Manager Quick Info */}
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="w-4 h-4" />
              <span className="truncate">
                Manager: <span className="font-medium text-foreground">{tournament.managerName}</span>
              </span>
            </div>
            
            {/* Contact Dialog */}
            <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowContactDialog(true);
                  }}
                >
                  <Phone className="w-3 h-3 mr-1" />
                  Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
                <DialogHeader>
                  <DialogTitle>Contact Information</DialogTitle>
                  <DialogDescription>
                    {isRegistered 
                      ? "Reach out to the tournament officials for any queries."
                      : "Contact details are only visible to registered players."}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <ContactDetails 
                    isRegistered={isRegistered}
                    managerName={tournament.managerName}
                    managerPhone={tournament.managerPhone}
                    managerWhatsApp={tournament.managerWhatsApp}
                    contactPersonName={tournament.contactPersonName}
                    contactPersonPhone={tournament.contactPersonPhone}
                    contactPersonWhatsApp={tournament.contactPersonWhatsApp}
                    tournamentName={tournament.name}
                  />
                </div>
                {tournament.venueGoogleMapsUrl && (
                  <div className="pt-4 border-t">
                    <a
                      href={tournament.venueGoogleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Map className="w-4 h-4" />
                      <span>Get Directions to Venue</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Host Organization */}
        {tournament.hostOrg && (
          <div className="pt-2 border-t border-border text-xs text-muted-foreground">
            Hosted by <span className="font-medium text-foreground">{tournament.hostOrg.name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
