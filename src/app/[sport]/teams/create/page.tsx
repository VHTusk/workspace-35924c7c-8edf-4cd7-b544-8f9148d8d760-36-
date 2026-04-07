"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  UserPlus,
  X,
  ChevronRight,
  RefreshCw,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  city: string | null;
  state: string | null;
  elo: number;
  points: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  isInTeam: boolean;
  canInvite: boolean;
}

export default function CreateTeamPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  // Form state
  const [teamName, setTeamName] = useState("");
  const [format, setFormat] = useState<"DOUBLES" | "TEAM">("DOUBLES");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PlayerSearchResult[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<PlayerSearchResult[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdTeamId, setCreatedTeamId] = useState<string | null>(null);

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-200" : "border-teal-200";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  // Max partners based on format
  const maxPartners = format === "DOUBLES" ? 1 : 3; // TEAM = 3-4 players total

  // Search for partners
  useEffect(() => {
    const searchPlayers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const sportUpper = sport.toUpperCase();
        const res = await fetch(`/api/teams/search-players?q=${encodeURIComponent(searchQuery)}&sport=${sportUpper}`);
        if (res.ok) {
          const data = await res.json();
          // Filter out already selected partners
          const selectedIds = selectedPartners.map(p => p.id);
          setSearchResults((data.players || []).filter((p: PlayerSearchResult) => !selectedIds.includes(p.id)));
        }
      } catch (err) {
        console.error("Search failed:", err);
      }
    };

    const debounce = setTimeout(searchPlayers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, sport, selectedPartners]);

  // Reset selected partners when format changes to require fewer
  useEffect(() => {
    if (selectedPartners.length > maxPartners) {
      setSelectedPartners(prev => prev.slice(0, maxPartners));
    }
  }, [format, maxPartners]);

  const handleSelectPartner = (player: PlayerSearchResult) => {
    if (!player.canInvite) return;
    if (selectedPartners.length >= maxPartners) return;
    
    setSelectedPartners(prev => [...prev, player]);
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemovePartner = (playerId: string) => {
    setSelectedPartners(prev => prev.filter(p => p.id !== playerId));
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    if (selectedPartners.length === 0) {
      setError(`Please select at least one partner for your ${format === "DOUBLES" ? "doubles" : "team"}`);
      return;
    }

    if (format === "TEAM" && selectedPartners.length < 2) {
      setError("Team format requires at least 2 partners (3+ players total)");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName.trim(),
          sport: sport.toUpperCase(),
          format: format,
          partnerIds: selectedPartners.map(p => p.id),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create team");
      }

      setSuccess(true);
      setCreatedTeamId(data.team.id);
      
      // Redirect to team page after a short delay
      setTimeout(() => {
        router.push(`/${sport}/teams/${data.team.id}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-72">
          <div className="p-6">
            <Card className="bg-white border-gray-100 shadow-sm max-w-md mx-auto mt-12">
              <CardContent className="py-12 text-center">
                <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                  <CheckCircle className={cn("w-8 h-8", primaryTextClass)} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Team Created Successfully!</h2>
                <p className="text-gray-500 mb-4">
                  Your team &quot;{teamName}&quot; has been created. Invitations have been sent to your partner(s).
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  The team will be active once all partners accept their invitations.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" asChild>
                    <Link href={`/${sport}/teams`}>View All Teams</Link>
                  </Button>
                  {createdTeamId && (
                    <Button className={primaryBtnClass} asChild>
                      <Link href={`/${sport}/teams/${createdTeamId}`}>View Team</Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Link href={`/${sport}/teams`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Teams
              </Button>
            </Link>
          </div>

          <div className="max-w-2xl mx-auto">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className={cn("w-5 h-5", primaryTextClass)} />
                  Create New Team
                </CardTitle>
                <CardDescription>
                  Create a team to participate in doubles or team tournaments for {isCornhole ? "Cornhole" : "Darts"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Team Name */}
                <div className="space-y-2">
                  <Label htmlFor="teamName">Team Name *</Label>
                  <Input
                    id="teamName"
                    placeholder="e.g., Cornhole Crushers"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500">{teamName.length}/50 characters</p>
                </div>

                {/* Format Selection */}
                <div className="space-y-2">
                  <Label>Team Format *</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as "DOUBLES" | "TEAM")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DOUBLES">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Doubles (2 players)</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="TEAM">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Team (3-4 players)</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    {format === "DOUBLES" 
                      ? "Doubles: You + 1 partner (2 players total)" 
                      : "Team: You + 2-3 partners (3-4 players total)"}
                  </p>
                </div>

                {/* Partner Selection */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Find Your Partner(s) *</Label>
                    <span className="text-sm text-gray-500">
                      {selectedPartners.length}/{maxPartners} selected
                    </span>
                  </div>
                  
                  <p className="text-xs text-gray-500">
                    Search for players by name or email. They must have a VALORHIVE account for {isCornhole ? "Cornhole" : "Darts"}.
                  </p>

                  {/* Selected Partners */}
                  {selectedPartners.length > 0 && (
                    <div className="space-y-2">
                      {selectedPartners.map((partner) => (
                        <div key={partner.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                                {partner.firstName[0]}{partner.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{partner.firstName} {partner.lastName}</p>
                              <p className="text-xs text-gray-500">
                                ELO: {partner.elo} • Win Rate: {partner.winRate}%
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => handleRemovePartner(partner.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Search Input */}
                  {selectedPartners.length < maxPartners && (
                    <>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          placeholder="Search by name or email..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>

                      {/* Search Results */}
                      {searchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                          {searchResults.map((player) => (
                            <button
                              key={player.id}
                              onClick={() => handleSelectPartner(player)}
                              disabled={!player.canInvite}
                              className={cn(
                                "w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors",
                                !player.canInvite && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarFallback className={cn(primaryBgClass, primaryTextClass)}>
                                    {player.firstName[0]}{player.lastName[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="text-left">
                                  <p className="font-medium text-sm">{player.firstName} {player.lastName}</p>
                                  <p className="text-xs text-gray-500">
                                    ELO: {player.elo} • {player.matchesPlayed} matches
                                  </p>
                                </div>
                              </div>
                              {player.isInTeam ? (
                                <Badge variant="outline" className="text-gray-400">In Team</Badge>
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Info box for format requirements */}
                  {format === "TEAM" && selectedPartners.length === 1 && (
                    <div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>Add at least 1 more partner for team format (minimum 3 players total).</span>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" asChild>
                    <Link href={`/${sport}/teams`}>Cancel</Link>
                  </Button>
                  <Button
                    onClick={handleCreateTeam}
                    disabled={loading || !teamName.trim() || selectedPartners.length === 0}
                    className={cn("text-white", primaryBtnClass)}
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Create Team
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className={cn("mt-4 border", primaryBorderClass, primaryBgClass)}>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <Info className={cn("w-5 h-5 mt-0.5", primaryTextClass)} />
                  <div className="text-sm">
                    <p className="font-medium text-gray-900 mb-1">How it works</p>
                    <ul className="text-gray-600 space-y-1">
                      <li>• You&apos;ll be the team captain and can manage tournament registrations</li>
                      <li>• Invitations expire after 48 hours if not accepted</li>
                      <li>• Team ELO is calculated as the average of all members&apos; ELO</li>
                      <li>• Each player can only be in one team per sport</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
