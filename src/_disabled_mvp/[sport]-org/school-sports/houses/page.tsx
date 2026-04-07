"use client";

import { useEffect, useState, useCallback } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Home,
  Plus,
  Users,
  Trophy,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Edit,
  Crown,
  Target,
  Medal,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HouseData {
  id: string;
  name: string;
  color: string;
  logoUrl?: string;
  motto?: string;
  points: number;
  tournamentsWon: number;
  studentCount: number;
  isActive: boolean;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

const houseColors = [
  { name: "Red", value: "#EF4444", bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
  { name: "Blue", value: "#3B82F6", bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
  { name: "Green", value: "#22C55E", bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
  { name: "Yellow", value: "#EAB308", bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200" },
  { name: "Purple", value: "#A855F7", bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
  { name: "Orange", value: "#F97316", bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
  { name: "Teal", value: "#14B8A6", bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
  { name: "Pink", value: "#EC4899", bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
];

export default function HousesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [houses, setHouses] = useState<HouseData[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingHouse, setEditingHouse] = useState<HouseData | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    color: "#EF4444",
    motto: "",
  });

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
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  }, [sport, router]);

  const fetchHouses = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${org.id}/school-houses?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setHouses(data.houses || []);
      } else {
        setError("Failed to load houses");
      }
    } catch (err) {
      console.error("Failed to fetch houses:", err);
      setError("Failed to load houses");
    } finally {
      setLoading(false);
    }
  }, [org?.id, sport]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (org?.id) {
      fetchHouses();
    }
  }, [org?.id, fetchHouses]);

  const handleCreateHouse = async () => {
    if (!formData.name || !formData.color) {
      setError("Please enter a house name and select a color");
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
      const response = await fetch(`/api/orgs/${org.id}/school-houses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
          motto: formData.motto,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create house");
        return;
      }

      setSuccess("House created successfully!");
      setShowCreateDialog(false);
      setFormData({ name: "", color: "#EF4444", motto: "" });
      fetchHouses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHouse = async () => {
    if (!editingHouse || !formData.name || !formData.color) {
      setError("Please enter a house name and select a color");
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
      const response = await fetch(`/api/orgs/${org.id}/school-houses/${editingHouse.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          color: formData.color,
          motto: formData.motto,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update house");
        return;
      }

      setSuccess("House updated successfully!");
      setEditingHouse(null);
      setFormData({ name: "", color: "#EF4444", motto: "" });
      fetchHouses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (house: HouseData) => {
    setEditingHouse(house);
    setFormData({
      name: house.name,
      color: house.color,
      motto: house.motto || "",
    });
  };

  const getColorClasses = (colorValue: string) => {
    return houseColors.find(c => c.value === colorValue) || houseColors[0];
  };

  const totalMembers = houses.reduce((sum, h) => sum + h.studentCount, 0);
  const totalPoints = houses.reduce((sum, h) => sum + h.points, 0);
  const leadingHouse = houses.length > 0 
    ? houses.reduce((max, h) => h.points > max.points ? h : max, houses[0])
    : null;

  // Sort houses by points for leaderboard
  const sortedHouses = [...houses].sort((a, b) => b.points - a.points);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
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
                <h1 className="text-2xl font-bold text-gray-900">House Management</h1>
                <p className="text-gray-500">Manage houses for inter-house competitions (Campus Sports)</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => {
                  setFormData({ name: "", color: "#EF4444", motto: "" });
                  setShowCreateDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create House
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
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Home className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{houses.length}</p>
                <p className="text-xs text-gray-500">Total Houses</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{totalMembers}</p>
                <p className="text-xs text-gray-500">Total Members</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900">{totalPoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Total Points</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Crown className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-lg font-bold text-gray-900 truncate">
                  {leadingHouse?.name || "-"}
                </p>
                <p className="text-xs text-gray-500">Leading House</p>
              </CardContent>
            </Card>
          </div>

          {/* House Leaderboard */}
          {houses.length > 0 && (
            <Card className="bg-white border-gray-100 shadow-sm mb-6">
              <CardHeader>
                <CardTitle className="text-gray-900 flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  House Leaderboard
                </CardTitle>
                <CardDescription>Current standings based on tournament points</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedHouses.map((house, index) => {
                    const colorClasses = getColorClasses(house.color);
                    const maxPoints = leadingHouse?.points || 1;
                    const progressPercent = (house.points / maxPoints) * 100;
                    
                    return (
                      <div key={house.id} className="relative">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                              index === 0 ? "bg-yellow-100 text-yellow-700" :
                              index === 1 ? "bg-gray-100 text-gray-600" :
                              index === 2 ? "bg-amber-100 text-amber-700" :
                              "bg-gray-50 text-gray-500"
                            )}>
                              {index + 1}
                            </div>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full"
                                style={{ backgroundColor: house.color }}
                              />
                              <span className="font-medium text-gray-900">{house.name}</span>
                              {index === 0 && (
                                <Badge className="bg-yellow-100 text-yellow-700">
                                  <Crown className="w-3 h-3 mr-1" />
                                  Leading
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-gray-900">{house.points.toLocaleString()}</span>
                            <span className="text-gray-500 text-sm ml-1">pts</span>
                          </div>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${progressPercent}%`,
                              backgroundColor: house.color 
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Houses Grid */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Houses</CardTitle>
              <CardDescription>Houses for inter-house competitions and activities</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : houses.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No houses created yet</p>
                  <p className="text-sm">Create houses to organize inter-house competitions</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {houses.map((house) => {
                    const colorClasses = getColorClasses(house.color);
                    return (
                      <Card
                        key={house.id}
                        className={cn("border-2 shadow-sm hover:shadow-md transition-shadow", colorClasses.border)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div 
                              className="w-12 h-12 rounded-xl flex items-center justify-center"
                              style={{ backgroundColor: house.color + '20' }}
                            >
                              {house.logoUrl ? (
                                <img src={house.logoUrl} alt={house.name} className="w-8 h-8 rounded object-cover" />
                              ) : (
                                <Home className="w-6 h-6" style={{ color: house.color }} />
                              )}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900">{house.name}</h3>
                              <Badge 
                                className="text-xs"
                                style={{ 
                                  backgroundColor: house.color + '20',
                                  color: house.color
                                }}
                              >
                                {house.tournamentsWon} wins
                              </Badge>
                            </div>
                          </div>
                          
                          {house.motto && (
                            <p className="text-xs text-gray-500 italic mb-3">"{house.motto}"</p>
                          )}
                          
                          <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-gray-50">
                              <p className="text-lg font-bold text-gray-900">{house.studentCount}</p>
                              <p className="text-xs text-gray-500">Members</p>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-50">
                              <p className="text-lg font-bold text-gray-900">{house.points}</p>
                              <p className="text-xs text-gray-500">Points</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-3">
                            <Badge variant={house.isActive ? "default" : "secondary"}>
                              {house.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditDialog(house)}
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Create House Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New House</DialogTitle>
            <DialogDescription>
              Create a new house for inter-house competitions
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>House Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Red House, Alpha House"
              />
            </div>

            <div className="space-y-2">
              <Label>House Color *</Label>
              <div className="grid grid-cols-4 gap-2">
                {houseColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={cn(
                      "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      formData.color === color.value 
                        ? "border-gray-900 ring-2 ring-gray-200" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-xs text-gray-600">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motto</Label>
              <Textarea
                value={formData.motto}
                onChange={(e) => setFormData(prev => ({ ...prev, motto: e.target.value }))}
                placeholder="e.g., Strength in Unity"
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleCreateHouse}
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
                  Create House
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit House Dialog */}
      <Dialog open={!!editingHouse} onOpenChange={() => setEditingHouse(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit House</DialogTitle>
            <DialogDescription>
              Update house information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>House Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Red House, Alpha House"
              />
            </div>

            <div className="space-y-2">
              <Label>House Color *</Label>
              <div className="grid grid-cols-4 gap-2">
                {houseColors.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                    className={cn(
                      "p-2 rounded-lg border-2 transition-all flex flex-col items-center gap-1",
                      formData.color === color.value 
                        ? "border-gray-900 ring-2 ring-gray-200" 
                        : "border-gray-200 hover:border-gray-300"
                    )}
                  >
                    <div 
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                    <span className="text-xs text-gray-600">{color.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motto</Label>
              <Textarea
                value={formData.motto}
                onChange={(e) => setFormData(prev => ({ ...prev, motto: e.target.value }))}
                placeholder="e.g., Strength in Unity"
                className="min-h-[80px]"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setEditingHouse(null)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleUpdateHouse}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update House
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
