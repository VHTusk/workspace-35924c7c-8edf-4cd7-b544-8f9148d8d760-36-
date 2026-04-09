"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Home,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Users,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SchoolHouse {
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

const HOUSE_COLORS = [
  { name: "Red", value: "#EF4444" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#22C55E" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Teal", value: "#14B8A6" },
  { name: "Pink", value: "#EC4899" },
];

export default function SchoolHousesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [houses, setHouses] = useState<SchoolHouse[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newHouse, setNewHouse] = useState({
    name: "",
    color: "#EF4444",
    motto: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchHouses();
    }
  }, [org?.id, sport]);

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

  const fetchHouses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${org?.id}/school-houses?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setHouses(data.houses || []);
      }
    } catch (err) {
      console.error("Failed to fetch houses:", err);
      setError("Failed to load houses");
    } finally {
      setLoading(false);
    }
  };

  const handleAddHouse = async () => {
    if (!newHouse.name) {
      setError("Please enter a house name");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org?.id}/school-houses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newHouse.name,
          color: newHouse.color,
          motto: newHouse.motto,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add house");
        return;
      }

      setSuccess("House created successfully!");
      setShowAddDialog(false);
      setNewHouse({ name: "", color: "#EF4444", motto: "" });
      fetchHouses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalStudents = houses.reduce((sum, h) => sum + h.studentCount, 0);
  const totalPoints = houses.reduce((sum, h) => sum + h.points, 0);
  const maxPoints = Math.max(...houses.map((h) => h.points), 1);

  const getColorClass = (color: string) => {
    const colorMap: Record<string, { bg: string; text: string; border: string }> = {
      "#EF4444": { bg: "bg-red-50", text: "text-red-600", border: "border-red-200" },
      "#3B82F6": { bg: "bg-blue-50", text: "text-blue-600", border: "border-blue-200" },
      "#22C55E": { bg: "bg-green-50", text: "text-green-600", border: "border-green-200" },
      "#EAB308": { bg: "bg-yellow-50", text: "text-yellow-600", border: "border-yellow-200" },
      "#A855F7": { bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-200" },
      "#F97316": { bg: "bg-orange-50", text: "text-orange-600", border: "border-orange-200" },
      "#14B8A6": { bg: "bg-teal-50", text: "text-teal-600", border: "border-teal-200" },
      "#EC4899": { bg: "bg-pink-50", text: "text-pink-600", border: "border-pink-200" },
    };
    return colorMap[color] || colorMap["#EF4444"];
  };

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
                <Home className="w-4 h-4" />
                <span>Internal School</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Houses</h1>
              <p className="text-gray-500">Manage houses for inter-house competitions</p>
            </div>
            <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowAddDialog(true)}>
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

        {/* Info */}
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Home className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-purple-900">House System</h3>
                <p className="text-sm text-purple-700 mt-1">
                  Houses are groups of students for inter-house competitions. Students can be assigned to houses and compete for house points.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-xs text-gray-500">Total Students</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
              <p className="text-xs text-gray-500">Total Points</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-gray-900">
                {houses.reduce((sum, h) => sum + h.tournamentsWon, 0)}
              </p>
              <p className="text-xs text-gray-500">Tournaments Won</p>
            </CardContent>
          </Card>
        </div>

        {/* Houses List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : houses.length === 0 ? (
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-12 text-center">
              <Home className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No houses created yet</h3>
              <p className="text-gray-500 mb-4">
                Create houses to organize students for inter-house competitions
              </p>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create First House
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {houses.map((house, index) => {
              const colorClass = getColorClass(house.color);
              const progressPercent = (house.points / maxPoints) * 100;
              return (
                <Card
                  key={house.id}
                  className={cn("bg-white shadow-sm border-2", colorClass.border)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4 mb-4">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                        style={{ backgroundColor: house.color }}
                      >
                        {house.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900">{house.name} House</h3>
                          <Badge className="bg-gray-100 text-gray-700">Rank #{index + 1}</Badge>
                        </div>
                        {house.motto && (
                          <p className="text-xs text-gray-500 italic mt-1">"{house.motto}"</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Points</span>
                        <span className="font-bold text-gray-900">{house.points.toLocaleString()}</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {house.studentCount} students
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        {house.tournamentsWon} wins
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

      {/* Add House Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create House</DialogTitle>
            <DialogDescription>Create a new house for inter-house competitions</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>House Name *</Label>
              <Input
                value={newHouse.name}
                onChange={(e) => setNewHouse((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Red Dragons, Blue Phoenix"
              />
            </div>
            <div className="space-y-2">
              <Label>House Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {HOUSE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewHouse((prev) => ({ ...prev, color: color.value }))}
                    className={cn(
                      "w-full h-10 rounded-lg border-2 transition-all",
                      newHouse.color === color.value
                        ? "border-gray-900 ring-2 ring-gray-300"
                        : "border-transparent"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Motto (Optional)</Label>
              <Input
                value={newHouse.motto}
                onChange={(e) => setNewHouse((prev) => ({ ...prev, motto: e.target.value }))}
                placeholder="e.g., Strength in Unity"
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleAddHouse} disabled={saving}>
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
    </div>
  );
}
