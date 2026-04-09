"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Users,
  Trophy,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Eye,
  Target,
  Calendar,
  UserPlus,
  Edit,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  classId?: string;
  className?: string;
  houseId?: string;
  houseName?: string;
  isVerified: boolean;
  status: string;
}

interface TeamMember {
  id: string;
  studentId: string;
  role: 'CAPTAIN' | 'PLAYER';
  isActive: boolean;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface SchoolTeam {
  id: string;
  name: string;
  description?: string;
  status: string;
  formedAt: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  tournamentsParticipated: number;
  tournamentsWon: number;
  members?: TeamMember[];
  _count?: {
    members: number;
    registrations: number;
  };
}

interface Organization {
  id: string;
  name: string;
  type: string;
}

export default function SchoolTeamsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<SchoolTeam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTeamDialog, setShowTeamDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<SchoolTeam | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchOrg = useCallback(async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/home`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  }, [sport, router]);

  const fetchTeams = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      // Use school teams API (not rep-squads)
      const response = await fetch(`/api/orgs/${org.id}/school-teams?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
      } else {
        setError("Failed to load teams");
      }
    } catch (err) {
      console.error("Failed to fetch teams:", err);
      setError("Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [org?.id, sport]);

  const fetchStudents = useCallback(async () => {
    if (!org?.id) return;
    try {
      const response = await fetch(`/api/orgs/${org.id}/students?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
    }
  }, [org?.id, sport]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (org?.id) {
      fetchTeams();
      fetchStudents();
    }
  }, [org?.id, fetchTeams, fetchStudents]);

  const handleCreateTeam = async () => {
    if (!formData.name.trim()) {
      setError("Please enter a team name");
      return;
    }

    if (!org?.id) {
      setError("Organization not found");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/orgs/${org.id}/school-teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create team");
        return;
      }

      setSuccess("Team created successfully!");
      setShowCreateDialog(false);
      setFormData({ name: "", description: "" });
      fetchTeams();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openTeamDialog = (team: SchoolTeam) => {
    setSelectedTeam(team);
    setShowTeamDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-green-100 text-green-700",
      INACTIVE: "bg-gray-100 text-gray-700",
      DISBANDED: "bg-red-100 text-red-700",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-700"}>
        {status}
      </Badge>
    );
  };

  const totalMembers = teams.reduce((sum, t) => sum + (t._count?.members || t.members?.length || 0), 0);
  const totalRegistrations = teams.reduce((sum, t) => sum + (t._count?.registrations || 0), 0);
  const totalWins = teams.reduce((sum, t) => sum + t.wins, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Teams</h1>
          <p className="text-gray-500 mt-1">
            Manage teams for inter-school tournaments - students only, no contract players
          </p>
        </div>
        <Button
          className={cn("text-white", primaryBtnClass)}
          onClick={() => {
            setFormData({ name: "", description: "" });
            setShowCreateDialog(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Team
        </Button>
      </div>

      {/* Alerts */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {success && (
        <Alert className="bg-emerald-50 border-emerald-200 text-emerald-700">
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Shield className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
            <p className="text-2xl font-bold text-gray-900">{teams.length}</p>
            <p className="text-xs text-gray-500">Teams</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
            <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
            <p className="text-xs text-gray-500">Team Members</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-purple-500" />
            <p className="text-2xl font-bold text-gray-900">{totalRegistrations}</p>
            <p className="text-xs text-gray-500">Registrations</p>
          </CardContent>
        </Card>
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-4 text-center">
            <Trophy className="w-8 h-8 mx-auto mb-2 text-amber-500" />
            <p className="text-2xl font-bold text-gray-900">{totalWins}</p>
            <p className="text-xs text-gray-500">Total Wins</p>
          </CardContent>
        </Card>
      </div>

      {/* Important Notice */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900">Student-Only Teams</h3>
              <p className="text-sm text-blue-700 mt-1">
                School teams can only include students from your school. Contract players are not allowed.
                Each team member must be a verified student in your roster.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : teams.length === 0 ? (
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardContent className="p-12 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No teams created yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first school team to participate in inter-school tournaments
            </p>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Team
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teams.map((team) => (
            <Card 
              key={team.id} 
              className="bg-white border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => openTeamDialog(team)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{team.name}</p>
                      {team.description && (
                        <p className="text-sm text-gray-500 line-clamp-1">{team.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {team._count?.members || team.members?.length || 0} players
                        </span>
                        <span className="flex items-center gap-1">
                          <Trophy className="w-3 h-3" />
                          {team.wins}W - {team.losses}L
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(team.status)}
                    <ArrowRight className="w-5 h-5 text-gray-300" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create School Team</DialogTitle>
            <DialogDescription>
              Create a new team for inter-school tournaments
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Team Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., School A Team, Senior Team"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the team..."
                className="min-h-[80px]"
              />
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <Shield className="w-4 h-4 text-blue-600" />
              <AlertDescription className="text-blue-700 text-sm">
                After creating the team, you can add students from your roster as team members.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleCreateTeam}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Team Details Dialog */}
      <Dialog open={showTeamDialog} onOpenChange={setShowTeamDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              {selectedTeam?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTeam?.description || "Team roster and management"}
            </DialogDescription>
          </DialogHeader>

          {selectedTeam && (
            <div className="space-y-4">
              {/* Team Stats */}
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-lg font-bold text-gray-900">
                    {selectedTeam._count?.members || selectedTeam.members?.length || 0}
                  </p>
                  <p className="text-xs text-gray-500">Players</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-lg font-bold text-gray-900">
                    {selectedTeam.matchesPlayed}
                  </p>
                  <p className="text-xs text-gray-500">Matches</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-lg font-bold text-gray-900">
                    {selectedTeam.wins}
                  </p>
                  <p className="text-xs text-gray-500">Wins</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-gray-50">
                  <p className="text-lg font-bold text-gray-900">
                    {selectedTeam.tournamentsWon}
                  </p>
                  <p className="text-xs text-gray-500">Trophies</p>
                </div>
              </div>

              {/* Captain */}
              {selectedTeam.members && selectedTeam.members.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Captain</Label>
                  {selectedTeam.members.filter(m => m.role === 'CAPTAIN').map(captain => (
                    <div key={captain.id} className="flex items-center gap-3 mt-2 p-3 rounded-lg bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <Crown className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {captain.student.firstName} {captain.student.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{captain.student.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Players List */}
              {selectedTeam.members && selectedTeam.members.length > 0 && (
                <div>
                  <Label className="text-sm text-gray-500">Team Members</Label>
                  <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                    {selectedTeam.members.filter(m => m.role === 'PLAYER').map(member => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                          {member.student.firstName[0]}{member.student.lastName[0]}
                        </div>
                        <span className="text-sm text-gray-700">
                          {member.student.firstName} {member.student.lastName}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowTeamDialog(false);
                    router.push(`/${sport}/org/school/inter/teams/${selectedTeam.id}`);
                  }}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Roster
                </Button>
                <Button
                  className={cn("flex-1 text-white", primaryBtnClass)}
                  onClick={() => {
                    setShowTeamDialog(false);
                    router.push(`/${sport}/org/school/inter/tournaments?teamId=${selectedTeam.id}`);
                  }}
                >
                  <Trophy className="w-4 h-4 mr-2" />
                  Register
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
