"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Users2,
  FileText,
  Search,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";


interface RepSquad {
  id: string;
  name: string;
  description?: string;
  status: string;
  playerCount: number;
  contractPlayerCount: number;
  wins: number;
  losses: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
  formedAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InterSquadsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [squads, setSquads] = useState<RepSquad[]>([]);
  const [filteredSquads, setFilteredSquads] = useState<RepSquad[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSquad, setNewSquad] = useState({
    name: "",
    description: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
    fetchSquads();
  }, [sport]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredSquads(squads.filter((s) => s.name.toLowerCase().includes(query)));
    } else {
      setFilteredSquads(squads);
    }
  }, [searchQuery, squads]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchSquads = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const response = await fetch(`/api/orgs/${orgData.id}/rep-squads?sport=${sport.toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          setSquads(data.squads || []);
          setFilteredSquads(data.squads || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch squads:", err);
      setError("Failed to load squads");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSquad = async () => {
    if (!newSquad.name) {
      setError("Please enter a squad name");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org?.id}/rep-squads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newSquad,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create squad");
        return;
      }

      setSuccess("Squad created successfully!");
      setShowCreateDialog(false);
      setNewSquad({ name: "", description: "" });
      fetchSquads();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const activeSquads = squads.filter((s) => s.status === "ACTIVE").length;
  const totalWins = squads.reduce((acc, s) => acc + s.wins, 0);
  const totalLosses = squads.reduce((acc, s) => acc + s.losses, 0);

  return (
    <OrganizationLayoutWrapper>
      <div className="space-y-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/corporate/inter`)}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <Shield className="w-4 h-4" />
                  <span>External</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rep Squads</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your representation squads for inter-corporate tournaments</p>
              </div>
              <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowCreateDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Squad
              </Button>
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{squads.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Squads</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeSquads}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Squads</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users2 className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {squads.reduce((acc, s) => acc + s.playerCount, 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Players</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <FileText className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {squads.reduce((acc, s) => acc + s.contractPlayerCount, 0)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contract Players</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search squads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Squads List */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Representation Squads</CardTitle>
              <CardDescription>Squads representing your organization in inter-corporate tournaments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredSquads.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{searchQuery ? "No squads match your search" : "No squads created yet"}</p>
                  <p className="text-sm">Create a squad to participate in inter-corporate tournaments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSquads.map((squad) => (
                    <div
                      key={squad.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => router.push(`/${sport}/org/corporate/inter/squads/${squad.id}`)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-lg bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{squad.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{squad.description || "No description"}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            <span>{squad.playerCount} players</span>
                            <span>•</span>
                            <span>{squad.contractPlayerCount} contract</span>
                            <span>•</span>
                            <span>W:{squad.wins} L:{squad.losses}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={squad.status === "ACTIVE" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"}>
                          {squad.status}
                        </Badge>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      {/* Create Squad Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Rep Squad</DialogTitle>
            <DialogDescription>Create a new representation squad for inter-corporate tournaments</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Squad Name *</label>
              <Input
                value={newSquad.name}
                onChange={(e) => setNewSquad((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Team Alpha"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={newSquad.description}
                onChange={(e) => setNewSquad((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of this squad"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleCreateSquad} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Squad
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrganizationLayoutWrapper>
  );
}
