"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Trophy,
  Plus,
  Calendar,
  Users,
  MapPin,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Clock,
  Eye,
  Edit,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Tournament {
  id: string;
  name: string;
  description?: string;
  type: string;
  status: string;
  startDate: string;
  endDate?: string;
  registrationDeadline: string;
  city?: string;
  state?: string;
  maxParticipants: number;
  currentParticipants: number;
  prizePool?: number;
  isRegistered?: boolean;
  registrationStatus?: string | null;
  createdAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function InternalTournamentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
        
        // Redirect if not a school
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchTournaments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/org/tournaments", {
        credentials: "include",
      });
      
      if (response.ok) {
        const data = await response.json();
        // Filter to only show INTRA_ORG tournaments
        const internalTournaments = (data.tournaments || []).filter(
          (t: Tournament) => t.type === "INTRA_ORG"
        );
        setTournaments(internalTournaments);
      } else {
        toast.error("Failed to load tournaments");
      }
    } catch (err) {
      console.error("Failed to fetch tournaments:", err);
      toast.error("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async () => {
    if (!formData.name || !formData.startDate || !formData.endDate || !formData.regDeadline || !formData.location) {
      toast.error("Please fill in all required fields (name, start date, end date, location, registration deadline)");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/org/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          startDate: formData.startDate,
          endDate: formData.endDate,
          regDeadline: formData.regDeadline,
          location: formData.location,
          city: formData.city,
          state: formData.state,
          maxPlayers: parseInt(formData.maxPlayers) || 32,
          prizePool: parseInt(formData.prizePool) || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create tournament");
      }

      toast.success("Tournament created successfully! It will be reviewed by admin before going live.");
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
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred");
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/school-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Internal Tournaments</h1>
                <p className="text-gray-500">INTRA_ORG tournaments for your students</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Tournament
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{tournaments.length}</p>
                <p className="text-xs text-gray-500">Total Tournaments</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Calendar className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {tournaments.filter(t => t.status === "REGISTRATION_OPEN").length}
                </p>
                <p className="text-xs text-gray-500">Open for Registration</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {tournaments.filter(t => t.status === "IN_PROGRESS").length}
                </p>
                <p className="text-xs text-gray-500">In Progress</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {tournaments.filter(t => t.status === "COMPLETED").length}
                </p>
                <p className="text-xs text-gray-500">Completed</p>
              </CardContent>
            </Card>
          </div>

          {/* Tournaments List */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Internal Tournaments</CardTitle>
              <CardDescription>Tournaments for your students only (INTRA_ORG)</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : tournaments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No internal tournaments yet</p>
                  <p className="text-sm">Create a tournament for your students</p>
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
                              {tournament.currentParticipants}/{tournament.maxParticipants}
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
        </div>
      </main>

      {/* Create Tournament Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Internal Tournament</DialogTitle>
            <DialogDescription>
              Create an INTRA_ORG tournament for your students
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tournament Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Annual School Sports Day 2024"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Deadline *</Label>
              <Input
                type="datetime-local"
                value={formData.regDeadline}
                onChange={(e) => setFormData(prev => ({ ...prev, regDeadline: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Location/Venue *</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="e.g., School Sports Complex"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Mumbai"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
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
                  onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: e.target.value }))}
                  placeholder="32"
                />
              </div>
              <div className="space-y-2">
                <Label>Prize Pool (₹)</Label>
                <Input
                  type="number"
                  value={formData.prizePool}
                  onChange={(e) => setFormData(prev => ({ ...prev, prizePool: e.target.value }))}
                  placeholder="10000"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleCreateTournament}
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
