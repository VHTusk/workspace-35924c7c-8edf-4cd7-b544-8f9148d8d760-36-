"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Trophy,
  Users,
  IndianRupee,
  BarChart3,
  Clock,
  Target,
  Medal,
  ChevronRight,
} from "lucide-react";

interface SeriesTournament {
  id: string;
  name: string;
  startDate: string;
  status: string;
  seriesPoints: number | null;
}

interface SeriesStanding {
  id: string;
  rank: number;
  userId: string;
  teamId: string | null;
  totalPoints: number;
  tournamentsPlayed: number;
  wins: number;
  playerName: string;
}

interface TournamentSeries {
  id: string;
  name: string;
  sport: string;
  description: string | null;
  seriesType: string;
  scoringSystem: string;
  startDate: string;
  endDate: string;
  status: string;
  participationPoints: number;
  winPoints: number;
  maxTournamentsCounted: number | null;
  totalPrizePool: number | null;
  isPublic: boolean;
  tournaments: SeriesTournament[];
  standings: SeriesStanding[];
  templates: { id: string; name: string }[];
}

export default function TournamentSeriesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportType = sport.toUpperCase() as "CORNHOLE" | "DARTS";

  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<TournamentSeries[]>([]);
  const [error, setError] = useState("");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<TournamentSeries | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    seriesType: "SEASON",
    scoringSystem: "POINTS",
    startDate: "",
    endDate: "",
    registrationDeadline: "",
    participationPoints: 1,
    winPoints: 3,
    placementPoints: "",
    maxTournamentsCounted: null as number | null,
    totalPrizePool: null as number | null,
    isPublic: true,
  });

  useEffect(() => {
    fetchSeries();
  }, [sport]);

  const fetchSeries = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournament-series?sport=${sportType}`);
      if (response.ok) {
        const data = await response.json();
        setSeries(data.series || []);
      } else if (response.status === 401) {
        router.push(`/${sport}/org/login`);
      } else {
        setError("Failed to load series");
      }
    } catch (err) {
      setError("Failed to load series");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      seriesType: "SEASON",
      scoringSystem: "POINTS",
      startDate: "",
      endDate: "",
      registrationDeadline: "",
      participationPoints: 1,
      winPoints: 3,
      placementPoints: "",
      maxTournamentsCounted: null,
      totalPrizePool: null,
      isPublic: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate) {
      setError("Name, start date, and end date are required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tournament-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sport: sportType,
          placementPoints: formData.placementPoints ? JSON.parse(formData.placementPoints) : null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSeries([data.series, ...series]);
        setShowCreateDialog(false);
        resetForm();
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create series");
      }
    } catch (err) {
      setError("Failed to create series");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedSeries || !formData.name) {
      setError("Series name is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/tournament-series/${selectedSeries.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setSeries(series.map((s) => (s.id === selectedSeries.id ? { ...s, ...data.series } : s)));
        setShowEditDialog(false);
        setSelectedSeries(null);
        resetForm();
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to update series");
      }
    } catch (err) {
      setError("Failed to update series");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (seriesId: string) => {
    if (!confirm("Are you sure you want to delete this series?")) return;

    try {
      const response = await fetch(`/api/tournament-series/${seriesId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setSeries(series.filter((s) => s.id !== seriesId));
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to delete series");
      }
    } catch (err) {
      setError("Failed to delete series");
    }
  };

  const openEditDialog = (s: TournamentSeries) => {
    setSelectedSeries(s);
    setFormData({
      name: s.name,
      description: s.description || "",
      seriesType: s.seriesType,
      scoringSystem: s.scoringSystem,
      startDate: s.startDate.split("T")[0],
      endDate: s.endDate.split("T")[0],
      registrationDeadline: "",
      participationPoints: s.participationPoints,
      winPoints: s.winPoints,
      placementPoints: "",
      maxTournamentsCounted: s.maxTournamentsCounted,
      totalPrizePool: s.totalPrizePool,
      isPublic: s.isPublic,
    });
    setShowEditDialog(true);
  };

  const openDetailDialog = (s: TournamentSeries) => {
    setSelectedSeries(s);
    setShowDetailDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      UPCOMING: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      ACTIVE: "bg-green-500/10 text-green-400 border-green-500/30",
      COMPLETED: "bg-muted text-muted-foreground border-border",
      CANCELLED: "bg-red-500/10 text-red-400 border-red-500/30",
    };
    return colors[status] || "bg-muted text-muted-foreground border-border";
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tournament Series</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage tournament seasons with cumulative standings
            </p>
          </div>
          <Button className={`${primaryBgClass} text-white`} onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Create Series
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Series Grid */}
        {series.length === 0 ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="py-12 text-center">
              <Trophy className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Series Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create tournament series to track cumulative standings across multiple events
              </p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className={`${primaryBgClass} text-white`}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Series
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {series.map((s) => (
              <Card key={s.id} className="bg-gradient-card border-border/50 cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openDetailDialog(s)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{s.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getStatusBadge(s.status)} variant="outline">
                          {s.status}
                        </Badge>
                        <Badge variant="outline" className="bg-muted/50">
                          {s.seriesType}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(s)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-500"
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(s.startDate).toLocaleDateString()} - {new Date(s.endDate).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Trophy className="w-4 h-4" />
                      <span>{s.tournaments.length} tournaments</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{s.standings.length} players</span>
                    </div>
                  </div>

                  {s.totalPrizePool && (
                    <div className="flex items-center gap-1 text-sm">
                      <IndianRupee className="w-4 h-4 text-amber-500" />
                      <span className="font-medium">{(s.totalPrizePool / 1000).toFixed(0)}K prize pool</span>
                    </div>
                  )}

                  {/* Top 3 Standings Preview */}
                  {s.standings.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs text-muted-foreground mb-2">Top Standings</p>
                      <div className="space-y-1">
                        {s.standings.slice(0, 3).map((standing, idx) => (
                          <div key={standing.id} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-xs font-medium">
                                {idx + 1}
                              </span>
                              <span>{standing.playerName}</span>
                            </div>
                            <span className="font-medium">{standing.totalPoints} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="text-primary">
                      View Details <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Series Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create Tournament Series</DialogTitle>
              <DialogDescription>
                Create a new tournament season with cumulative standings
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Series Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Summer Championship Series"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="Brief description of the series"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Series Type</Label>
                  <Select value={formData.seriesType} onValueChange={(v) => setFormData({ ...formData, seriesType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEASON">Season</SelectItem>
                      <SelectItem value="LEAGUE">League</SelectItem>
                      <SelectItem value="CIRCUIT">Circuit</SelectItem>
                      <SelectItem value="CHAMPIONSHIP">Championship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scoring System</Label>
                  <Select value={formData.scoringSystem} onValueChange={(v) => setFormData({ ...formData, scoringSystem: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POINTS">Points Based</SelectItem>
                      <SelectItem value="ELO">ELO Based</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Participation Points</Label>
                  <Input
                    type="number"
                    value={formData.participationPoints}
                    onChange={(e) => setFormData({ ...formData, participationPoints: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Win Points</Label>
                  <Input
                    type="number"
                    value={formData.winPoints}
                    onChange={(e) => setFormData({ ...formData, winPoints: parseInt(e.target.value) || 3 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Tournaments Counted</Label>
                  <Input
                    type="number"
                    value={formData.maxTournamentsCounted || ""}
                    onChange={(e) => setFormData({ ...formData, maxTournamentsCounted: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="All tournaments"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Total Prize Pool (₹)</Label>
                  <Input
                    type="number"
                    value={formData.totalPrizePool || ""}
                    onChange={(e) => setFormData({ ...formData, totalPrizePool: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Series
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Series Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Series</DialogTitle>
              <DialogDescription>
                Update series settings
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-name">Series Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Input
                    id="edit-description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Series Type</Label>
                  <Select value={formData.seriesType} onValueChange={(v) => setFormData({ ...formData, seriesType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEASON">Season</SelectItem>
                      <SelectItem value="LEAGUE">League</SelectItem>
                      <SelectItem value="CIRCUIT">Circuit</SelectItem>
                      <SelectItem value="CHAMPIONSHIP">Championship</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scoring System</Label>
                  <Select value={formData.scoringSystem} onValueChange={(v) => setFormData({ ...formData, scoringSystem: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="POINTS">Points Based</SelectItem>
                      <SelectItem value="ELO">ELO Based</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date *</Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date *</Label>
                  <Input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleEdit} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Series Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{selectedSeries?.name}</DialogTitle>
              <DialogDescription>
                {selectedSeries?.description || "Series details and standings"}
              </DialogDescription>
            </DialogHeader>
            {selectedSeries && (
              <Tabs defaultValue="standings" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="standings" className="flex-1">Standings</TabsTrigger>
                  <TabsTrigger value="tournaments" className="flex-1">Tournaments</TabsTrigger>
                  <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
                </TabsList>
                
                <TabsContent value="standings" className="mt-4">
                  <ScrollArea className="h-[40vh]">
                    {selectedSeries.standings.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No standings yet</p>
                        <p className="text-sm">Standings will appear after tournaments are completed</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedSeries.standings.map((standing, idx) => (
                          <div key={standing.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                              idx === 0 ? "bg-amber-500/20 text-amber-500" :
                              idx === 1 ? "bg-muted text-muted-foreground" :
                              idx === 2 ? "bg-orange-500/20 text-orange-500" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              {idx + 1}
                            </div>
                            <Avatar className="w-8 h-8">
                              <AvatarFallback>
                                {standing.playerName.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <p className="font-medium">{standing.playerName}</p>
                              <p className="text-xs text-muted-foreground">
                                {standing.tournamentsPlayed} tournaments • {standing.wins} wins
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-lg">{standing.totalPoints}</p>
                              <p className="text-xs text-muted-foreground">points</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="tournaments" className="mt-4">
                  <ScrollArea className="h-[40vh]">
                    {selectedSeries.tournaments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No tournaments in series</p>
                        <p className="text-sm">Add tournaments to this series from tournament settings</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedSeries.tournaments.map((tournament) => (
                          <div key={tournament.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                            <div>
                              <p className="font-medium">{tournament.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(tournament.startDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getStatusBadge(tournament.status)} variant="outline">
                                {tournament.status}
                              </Badge>
                              {tournament.seriesPoints && (
                                <span className="text-sm text-muted-foreground">
                                  {tournament.seriesPoints} pts
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="settings" className="mt-4">
                  <ScrollArea className="h-[40vh]">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground">Scoring System</p>
                          <p className="font-medium">{selectedSeries.scoringSystem}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground">Series Type</p>
                          <p className="font-medium">{selectedSeries.seriesType}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground">Participation Points</p>
                          <p className="font-medium">{selectedSeries.participationPoints}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/30">
                          <p className="text-xs text-muted-foreground">Win Points</p>
                          <p className="font-medium">{selectedSeries.winPoints}</p>
                        </div>
                        {selectedSeries.maxTournamentsCounted && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">Max Tournaments Counted</p>
                            <p className="font-medium">{selectedSeries.maxTournamentsCounted}</p>
                          </div>
                        )}
                        {selectedSeries.totalPrizePool && (
                          <div className="p-3 rounded-lg bg-muted/30">
                            <p className="text-xs text-muted-foreground">Total Prize Pool</p>
                            <p className="font-medium">₹{(selectedSeries.totalPrizePool / 1000).toFixed(0)}K</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
