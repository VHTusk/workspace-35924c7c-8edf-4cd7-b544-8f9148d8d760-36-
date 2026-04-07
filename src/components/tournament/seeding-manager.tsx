"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings,
  Loader2,
  Users,
  Trophy,
  AlertTriangle,
  GripVertical,
  RefreshCw,
  CheckCircle,
  Info,
} from "lucide-react";

interface SeedingPlayer {
  seed: number;
  userId: string;
  playerName: string;
  elo: number;
  org: string | null;
  orgId: string | null;
  reason: string;
}

interface SeedingStats {
  playerCount: number;
  eloRange: number;
  avgElo: number;
  topElo: number;
  bottomElo: number;
}

interface SeedingCollision {
  orgId: string;
  seeds: number[];
  warning: string;
}

interface SeedingData {
  success: boolean;
  data: {
    tournamentId: string;
    format: string;
    sport: string;
    method: string;
    playerCount: number;
    bracketExists: boolean;
    options: {
      antiCollision: boolean;
      topSeedProtection: boolean;
      topN: number;
    };
    players: SeedingPlayer[];
    stats: SeedingStats;
    validation: {
      valid: boolean;
      issues: string[];
    };
    collisions?: SeedingCollision[];
    recommendations: string[];
  };
}

interface SeedingManagerProps {
  tournamentId: string;
  sport: string;
  onSeedingApplied?: () => void;
}

export function SeedingManager({ tournamentId, sport, onSeedingApplied }: SeedingManagerProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [seedingData, setSeedingData] = useState<SeedingData | null>(null);
  const [error, setError] = useState("");

  // Seeding options
  const [method, setMethod] = useState<string>("ELO");
  const [antiCollision, setAntiCollision] = useState(true);
  const [topSeedProtection, setTopSeedProtection] = useState(true);
  const [topN, setTopN] = useState(8);
  const [forceRegenerate, setForceRegenerate] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchSeedingPreview = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        method,
        antiCollision: antiCollision.toString(),
        topSeedProtection: topSeedProtection.toString(),
        topN: topN.toString(),
      });
      
      const response = await fetch(`/api/tournaments/${tournamentId}/seeding?${params}`);
      const data = await response.json();
      
      if (response.ok) {
        setSeedingData(data);
      } else {
        setError(data.error || "Failed to load seeding preview");
      }
    } catch (err) {
      setError("Failed to load seeding preview");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setShowDialog(true);
    fetchSeedingPreview();
  };

  const handleApplySeeding = async () => {
    setApplying(true);
    setError("");
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/seeding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          antiCollision,
          topSeedProtection,
          topN,
          forceRegenerate: seedingData?.data?.bracketExists || false,
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setShowDialog(false);
        onSeedingApplied?.();
      } else {
        setError(data.error || "Failed to apply seeding");
      }
    } catch (err) {
      setError("Failed to apply seeding");
    } finally {
      setApplying(false);
    }
  };

  const getMethodDescription = (m: string) => {
    switch (m) {
      case "ELO":
        return "Seed players by ELO rating (highest vs lowest in first round)";
      case "RANDOM":
        return "Randomly assign seeds to all players";
      case "HYBRID":
        return "Top N players seeded by ELO, rest randomly distributed";
      default:
        return "";
    }
  };

  return (
    <>
      <Button variant="outline" onClick={handleOpenDialog} className="gap-2">
        <Settings className="w-4 h-4" />
        Manage Seeding
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Tournament Seeding
            </DialogTitle>
            <DialogDescription>
              Configure and preview player seeding before bracket generation
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertTriangle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : seedingData && (
            <div className="space-y-6">
              {/* Seeding Options */}
              <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Seeding Options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Seeding Method</Label>
                      <Select value={method} onValueChange={(v) => { setMethod(v); fetchSeedingPreview(); }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ELO">ELO Based</SelectItem>
                          <SelectItem value="RANDOM">Random</SelectItem>
                          <SelectItem value="HYBRID">Hybrid (Top N + Random)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">{getMethodDescription(method)}</p>
                    </div>

                    {method === "HYBRID" && (
                      <div className="space-y-2">
                        <Label>Top N Players by ELO</Label>
                        <Select value={topN.toString()} onValueChange={(v) => { setTopN(parseInt(v)); fetchSeedingPreview(); }}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="4">Top 4</SelectItem>
                            <SelectItem value="8">Top 8</SelectItem>
                            <SelectItem value="16">Top 16</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="antiCollision"
                        checked={antiCollision}
                        onCheckedChange={(checked) => { setAntiCollision(checked); fetchSeedingPreview(); }}
                      />
                      <Label htmlFor="antiCollision" className="text-sm">
                        Anti-collision (spread same-org players)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="topSeedProtection"
                        checked={topSeedProtection}
                        onCheckedChange={(checked) => { setTopSeedProtection(checked); fetchSeedingPreview(); }}
                      />
                      <Label htmlFor="topSeedProtection" className="text-sm">
                        Top seed protection
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold">{seedingData.data.playerCount}</p>
                    <p className="text-xs text-muted-foreground">Players</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <Trophy className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                    <p className="text-lg font-bold">{seedingData.data.stats.topElo}</p>
                    <p className="text-xs text-muted-foreground">Top ELO</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="w-5 h-5 mx-auto mb-1 font-bold text-primary">{seedingData.data.stats.avgElo}</p>
                    <p className="text-lg font-bold">{seedingData.data.stats.avgElo}</p>
                    <p className="text-xs text-muted-foreground">Avg ELO</p>
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-3 text-center">
                    <p className="w-5 h-5 mx-auto mb-1 font-bold text-red-400">{seedingData.data.stats.eloRange}</p>
                    <p className="text-lg font-bold">{seedingData.data.stats.eloRange}</p>
                    <p className="text-xs text-muted-foreground">ELO Range</p>
                  </CardContent>
                </Card>
              </div>

              {/* Recommendations */}
              {seedingData.data.recommendations.length > 0 && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1">
                      {seedingData.data.recommendations.map((rec, i) => (
                        <li key={i} className="text-sm">{rec}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Collisions */}
              {seedingData.data.collisions && seedingData.data.collisions.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Potential Early Collisions:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {seedingData.data.collisions.map((c, i) => (
                        <li key={i} className="text-sm">{c.warning}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Players List */}
              <div>
                <h4 className="font-medium mb-3">Seeding Preview</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-1">
                    {seedingData.data.players.map((player) => (
                      <div
                        key={player.userId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50"
                      >
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {player.seed}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{player.playerName}</p>
                          {player.org && (
                            <p className="text-xs text-muted-foreground">{player.org}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{player.elo}</p>
                          <p className="text-xs text-muted-foreground">ELO</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Bracket Exists Warning */}
              {seedingData.data.bracketExists && (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Bracket already exists. Applying new seeding will regenerate the bracket.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              className={`${primaryBgClass} text-white`}
              onClick={handleApplySeeding} 
              disabled={applying || loading || !seedingData?.success}
            >
              {applying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Apply Seeding
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
