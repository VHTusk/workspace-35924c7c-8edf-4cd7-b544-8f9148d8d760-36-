"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import {
  Building2,
  MapPin,
  Mail,
  Phone,
  Trophy,
  Users,
  Target,
  TrendingUp,
  Award,
  Calendar,
  CheckCircle,
  Edit2,
  Save,
  X,
  Loader2,
  AlertCircle,
  Crown,
  Medal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgProfile {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  type: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  logoUrl?: string;
  planTier: string;
  createdAt: string;
  ranking: {
    rank: number | null;
    totalOrganizations: number;
    percentile: number;
    totalPoints: number;
    avgPoints: number;
    avgElo: number;
  };
  stats: {
    totalMembers: number;
    totalWins: number;
    totalLosses: number;
    winRate: number;
    tournamentsHosted: number;
    completedTournaments: number;
  };
  roster: Array<{
    id: string;
    userId: string;
    name: string;
    points: number;
    elo: number;
    wins: number;
    losses: number;
    city?: string;
    joinedAt: string;
  }>;
  subscription?: {
    status: string;
    startDate: string;
    endDate: string;
  } | null;
}

const orgTypeLabels: Record<string, string> = {
  CLUB: "Club",
  SCHOOL: "School",
  CORPORATE: "Corporate",
  ACADEMY: "Academy",
};

const orgTypeColors: Record<string, string> = {
  CLUB: "bg-blue-100 text-blue-700 border-blue-200",
  SCHOOL: "bg-green-100 text-green-700 border-green-200",
  CORPORATE: "bg-purple-100 text-purple-700 border-purple-200",
  ACADEMY: "bg-amber-100 text-amber-700 border-amber-200",
};

const planTierColors: Record<string, string> = {
  BASIC: "text-gray-500",
  PRO: "text-blue-500",
  ELITE: "text-purple-500",
};

export default function OrgProfilePage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<OrgProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    type: "",
    city: "",
    district: "",
    state: "",
    pinCode: "",
    phone: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchProfile();
  }, [sport]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/org/profile");
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditForm({
          name: data.name || "",
          type: data.type || "CLUB",
          city: data.city || "",
          district: data.district || "",
          state: data.state || "",
          pinCode: data.pinCode || "",
          phone: data.phone || "",
        });
      } else {
        setError("Failed to load profile");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/org/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setSuccess("Profile updated successfully!");
        setIsEditing(false);
        fetchProfile();
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update profile");
      }
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    if (profile) {
      setEditForm({
        name: profile.name || "",
        type: profile.type || "CLUB",
        city: profile.city || "",
        district: profile.district || "",
        state: profile.state || "",
        pinCode: profile.pinCode || "",
        phone: profile.phone || "",
      });
    }
    setIsEditing(false);
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  // Get rank badge color
  const getRankBadgeColor = (rank: number | null) => {
    if (!rank) return "bg-gray-100 text-gray-600";
    if (rank === 1) return "bg-amber-100 text-amber-700 border-amber-300";
    if (rank === 2) return "bg-gray-100 text-gray-600 border-gray-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-300";
    if (rank <= 10) return "bg-blue-100 text-blue-700 border-blue-300";
    return "bg-gray-100 text-gray-600";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-4" />
          <p className="text-gray-600">Failed to load profile</p>
          <Button onClick={fetchProfile} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Organization Profile</h1>
              <p className="text-gray-500">Manage your organization details</p>
            </div>
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className={cn("text-white gap-2", primaryBtnClass)}
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className={cn("text-white gap-2", primaryBtnClass)}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save
                </Button>
              </div>
            )}
          </div>

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

          {/* Organization Ranking Card */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                {/* Left: Org Info */}
                <div className="flex items-center gap-4">
                  <div className={cn("w-20 h-20 rounded-xl flex items-center justify-center", primaryBgClass)}>
                    <Building2 className={cn("w-10 h-10", primaryTextClass)} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {isEditing ? (
                        <Input
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="text-xl font-bold"
                          placeholder="Organization Name"
                        />
                      ) : (
                        profile.name
                      )}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge className={cn("border", orgTypeColors[profile.type] || "bg-gray-100")}>
                        {orgTypeLabels[profile.type] || profile.type}
                      </Badge>
                      {profile.subscription?.status === 'ACTIVE' && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                          <Crown className="w-3 h-3 mr-1" />
                          {profile.planTier}
                        </Badge>
                      )}
                      {profile.city && profile.state && (
                        <span className="text-sm text-gray-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {profile.city}, {profile.state}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Member since {new Date(profile.createdAt).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long' 
                      })}
                    </p>
                  </div>
                </div>

                {/* Right: Ranking Display */}
                <div className={cn("rounded-xl p-6 text-center min-w-[200px]", primaryBgClass)}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    {profile.ranking.rank === 1 && <Crown className="w-6 h-6 text-amber-500" />}
                    {profile.ranking.rank === 2 && <Medal className="w-6 h-6 text-gray-400" />}
                    {profile.ranking.rank === 3 && <Medal className="w-6 h-6 text-orange-400" />}
                    <span className={cn("text-4xl font-bold", primaryTextClass)}>
                      #{profile.ranking.rank || "--"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">Organization Ranking</p>
                  <p className="text-xs text-gray-500 mt-1">
                    out of {profile.ranking.totalOrganizations} organizations
                  </p>
                  {profile.ranking.percentile > 0 && (
                    <div className="mt-2">
                      <Badge className={cn("border", getRankBadgeColor(profile.ranking.rank))}>
                        Top {profile.ranking.percentile}%
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900">{profile.ranking.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Points</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-6 h-6 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{profile.stats.totalMembers}</p>
                <p className="text-xs text-gray-500">Members</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Target className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                <p className="text-2xl font-bold text-gray-900">{profile.stats.winRate}%</p>
                <p className="text-xs text-gray-500">Win Rate</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{profile.ranking.avgElo}</p>
                <p className="text-xs text-gray-500">Avg ELO</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Contact & Location */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Contact & Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Email</label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone number"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-gray-900">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span>{profile.email || "Not set"}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                    {isEditing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        placeholder="Phone"
                      />
                    ) : (
                      <div className="flex items-center gap-2 text-gray-900">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span>{profile.phone || "Not set"}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">City</label>
                    {isEditing ? (
                      <Input
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                        placeholder="City"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.city || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">District</label>
                    {isEditing ? (
                      <Input
                        value={editForm.district}
                        onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                        placeholder="District"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.district || "Not set"}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">State</label>
                    {isEditing ? (
                      <Input
                        value={editForm.state}
                        onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                        placeholder="State"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.state || "Not set"}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">PIN Code</label>
                    {isEditing ? (
                      <Input
                        value={editForm.pinCode}
                        onChange={(e) => setEditForm({ ...editForm, pinCode: e.target.value })}
                        placeholder="PIN Code"
                      />
                    ) : (
                      <p className="text-gray-900">{profile.pinCode || "Not set"}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Stats */}
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Performance Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Total Matches</span>
                    <span className="font-bold text-gray-900">
                      {profile.stats.totalWins + profile.stats.totalLosses}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Wins / Losses</span>
                    <span className="font-bold text-gray-900">
                      <span className="text-emerald-600">{profile.stats.totalWins}</span>
                      <span className="text-gray-400 mx-1">/</span>
                      <span className="text-red-500">{profile.stats.totalLosses}</span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Avg Points per Member</span>
                    <span className="font-bold text-gray-900">{profile.ranking.avgPoints}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Tournaments Hosted</span>
                    <span className="font-bold text-gray-900">{profile.stats.tournamentsHosted}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-600">Completed Tournaments</span>
                    <span className="font-bold text-gray-900">{profile.stats.completedTournaments}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Roster Players */}
          <Card className="bg-white border-gray-100 shadow-sm mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Top Roster Players</CardTitle>
              <CardDescription>Players contributing to your organization's ranking</CardDescription>
            </CardHeader>
            <CardContent>
              {profile.roster.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No players in roster yet</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {profile.roster
                    .sort((a, b) => b.points - a.points)
                    .slice(0, 10)
                    .map((player, index) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                            index === 0 ? "bg-amber-100 text-amber-700" :
                            index === 1 ? "bg-gray-100 text-gray-600" :
                            index === 2 ? "bg-orange-100 text-orange-700" :
                            "bg-gray-50 text-gray-500"
                          )}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{player.name}</p>
                            <p className="text-xs text-gray-500">
                              {player.wins}W - {player.losses}L
                              {player.city && ` • ${player.city}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{player.points.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">points</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
