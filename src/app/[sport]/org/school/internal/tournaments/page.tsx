"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Trophy,
  Plus,
  Calendar,
  Users,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Eye,
  BookOpen,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Tournament {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  location: string;
  city?: string;
  state?: string;
  maxPlayers: number;
  currentParticipants: number;
  prizePool?: number;
  createdAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function SchoolTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    regDeadline: "",
    location: "",
    city: "",
    state: "",
    maxPlayers: "32",
    prizePool: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
    fetchTournaments();
  }, [sport]);

  const fetchOrg = async () => {
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
  };

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/org/tournaments?type=INTRA_ORG`);
      if (response.ok) {
        const data = await response.json();
        const intraOrgTournaments = (data.tournaments || []).filter(
          (t: Tournament) => t.type === "INTRA_ORG"
        );
        setTournaments(intraOrgTournaments);
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
      setError("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.regDeadline || !formData.location) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/org/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate || formData.startDate,
          regDeadline: formData.regDeadline,
          location: formData.location,
          city: formData.city,
          state: formData.state,
          maxPlayers: parseInt(formData.maxPlayers) || 32,
          prizePool: formData.prizePool ? parseFloat(formData.prizePool) : 0,
          type: "INTRA_ORG",
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create tournament");
        return;
      }

      setSuccess("Internal tournament created successfully!");
      setShowCreateDialog(false);
      setFormData({
        name: "",
        description: "",
        startDate: "",
        endDate: "",
        regDeadline: "",
        location: "",
        city: "",
        state: "",
        maxPlayers: "32",
        prizePool: "",
      });
      fetchTournaments();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: "bg-gray-100 text-gray-700",
      REGISTRATION_OPEN: "bg-green-100 text-green-700",
      REGISTRATION_CLOSED: "bg-amber-100 text-amber-700",
      IN_PROGRESS: "bg-blue-100 text-blue-700",
      COMPLETED: "bg-purple-100 text-purple-700",
      CANCELLED: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      DRAFT: "Draft",
      REGISTRATION_OPEN: "Open",
      REGISTRATION_CLOSED: "Closed",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed",
      CANCELLED: "Cancelled",
    };
    return (
      <Badge className={styles[status] || "bg-gray-100 text-gray-700"}>
        {labels[status] || status}
      </Badge>
    );
  };

  const activeCount = tournaments.filter((t) => t.status === "REGISTRATION_OPEN" || t.status === "IN_PROGRESS").length;
  const completedCount = tournaments.filter((t) => t.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/school/internal`)}
            className="mb-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Internal School</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Internal Tournaments</h1>
              <p className="text-gray-500">Internal tournaments for students of your school only</p>
            </div>
            <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Tournament
            </Button>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Trophy className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Internal School Tournaments</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Only students from your school can participate. Students can compete by class, section, house, or as individuals.
                  No external or contract players allowed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {success && (
          <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-gray-900">{tournaments.length}</p>
              <p className="text-xs text-gray-500">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-500">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">
                {tournaments.reduce((acc, t) => acc + t.currentParticipants, 0)}
              </p>
              <p className="text-xs text-gray-500">Participants</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-gray-900">{completedCount}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Tournaments List */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Internal Tournaments</CardTitle>
            <CardDescription>Internal tournaments for students of your school</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : tournaments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No internal school tournaments yet</p>
                <p className="text-sm">Create your first internal tournament for students</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tournaments.map((tournament) => (
                  <div
                    key={tournament.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center", primaryBgClass)}>
                        <Trophy className={cn("w-6 h-6", primaryTextClass)} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{tournament.name}</p>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(tournament.startDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {tournament.currentParticipants}/{tournament.maxPlayers}
                          </span>
                          {(tournament.city || tournament.state) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {[tournament.city, tournament.state].filter(Boolean).join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(tournament.status)}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/${sport}/tournaments/${tournament.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Create Tournament Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Internal Tournament</DialogTitle>
            <DialogDescription>Create an internal tournament for students of your school</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tournament Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Annual School Championship 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Tournament description..."
                className="min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Deadline *</Label>
              <Input
                type="datetime-local"
                value={formData.regDeadline}
                onChange={(e) => setFormData((prev) => ({ ...prev, regDeadline: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Location/Venue *</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., School Sports Complex"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData((prev) => ({ ...prev, city: e.target.value }))}
                  placeholder="Mumbai"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData((prev) => ({ ...prev, state: e.target.value }))}
                  placeholder="Maharashtra"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Participants</Label>
                <Input
                  type="number"
                  value={formData.maxPlayers}
                  onChange={(e) => setFormData((prev) => ({ ...prev, maxPlayers: e.target.value }))}
                  placeholder="32"
                />
              </div>
              <div className="space-y-2">
                <Label>Prize Pool (₹)</Label>
                <Input
                  type="number"
                  value={formData.prizePool}
                  onChange={(e) => setFormData((prev) => ({ ...prev, prizePool: e.target.value }))}
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleCreateTournament} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
