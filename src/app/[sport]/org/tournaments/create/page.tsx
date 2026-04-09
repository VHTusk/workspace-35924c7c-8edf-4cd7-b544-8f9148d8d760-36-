"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import Sidebar from "@/components/layout/sidebar";
import {
  Trophy,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function CreateIntraOrgTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [createdTournament, setCreatedTournament] = useState<{ id: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    regDeadline: "",
    location: "",
    city: "",
    state: "",
    prizePool: "",
    entryFee: "0",
    maxPlayers: "32",
    bracketFormat: "SINGLE_ELIMINATION",
    ageMin: "",
    ageMax: "",
    gender: "MIXED",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Validate dates
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const deadline = new Date(formData.regDeadline);
    const now = new Date();

    if (start < now) {
      setError("Start date cannot be in the past");
      setLoading(false);
      return;
    }

    if (end < start) {
      setError("End date cannot be before start date");
      setLoading(false);
      return;
    }

    if (deadline > start) {
      setError("Registration deadline must be before start date");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          sport: sport.toUpperCase(),
          type: "INTRA_ORG",
          startDate: formData.startDate,
          endDate: formData.endDate,
          regDeadline: formData.regDeadline,
          location: formData.location,
          city: formData.city || undefined,
          state: formData.state || undefined,
          prizePool: parseInt(formData.prizePool) || 0,
          entryFee: parseInt(formData.entryFee) || 0,
          maxPlayers: parseInt(formData.maxPlayers) || 32,
          bracketFormat: formData.bracketFormat,
          ageMin: formData.ageMin ? parseInt(formData.ageMin) : undefined,
          ageMax: formData.ageMax ? parseInt(formData.ageMax) : undefined,
          gender: formData.gender,
          isPublic: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create tournament");
        return;
      }

      setSuccess(true);
      setCreatedTournament({ id: data.tournament.id, name: data.tournament.name });
    } catch (err) {
      setError("Failed to create tournament");
    } finally {
      setLoading(false);
    }
  };

  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  if (success && createdTournament) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="ml-72">
          <div className="p-6">
            <Card className="max-w-lg mx-auto bg-white border-gray-100 shadow-sm">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Tournament Created!</h2>
                <p className="text-gray-600 mb-4">
                  Your intra-org tournament <strong>{createdTournament.name}</strong> has been submitted for admin approval.
                </p>
                <Alert className="bg-amber-50 border-amber-200 text-amber-700 mb-6">
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    The tournament will be visible to players after admin approval. You'll be notified once it's approved.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-3 justify-center">
                  <Link href={`/${sport}/org/dashboard`}>
                    <Button variant="outline">Back to Dashboard</Button>
                  </Link>
                  <Link href={`/${sport}/tournaments/${createdTournament.id}`}>
                    <Button className={primaryBtnClass}>View Tournament</Button>
                  </Link>
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
      <Sidebar />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Link
              href={`/${sport}/org/dashboard`}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Create Intra-Org Tournament</h1>
            <p className="text-gray-500">Create a tournament for your organization members</p>
          </div>

          {/* Info Banner */}
          <Alert className="bg-blue-50 border-blue-200 text-blue-700 mb-6">
            <Info className="w-4 h-4" />
            <AlertDescription>
              Intra-org tournaments are created by your organization and require admin approval before going live.
              Players will pay individual entry fees to participate.
            </AlertDescription>
          </Alert>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Basic Information */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Basic Information</CardTitle>
                    <CardDescription>Enter the basic details of your tournament</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="name">Tournament Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g., Annual Club Championship"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="startDate">Start Date *</Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={formData.startDate}
                          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                          min={new Date().toISOString().split("T")[0]}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="endDate">End Date *</Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={formData.endDate}
                          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                          min={formData.startDate || new Date().toISOString().split("T")[0]}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="regDeadline">Registration Deadline *</Label>
                        <Input
                          id="regDeadline"
                          type="date"
                          value={formData.regDeadline}
                          onChange={(e) => setFormData({ ...formData, regDeadline: e.target.value })}
                          max={formData.startDate || undefined}
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="location">Venue / Location *</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g., City Sports Complex"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          placeholder="City"
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State</Label>
                        <Input
                          id="state"
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                          placeholder="State"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tournament Settings */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Tournament Settings</CardTitle>
                    <CardDescription>Configure the tournament format and rules</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="bracketFormat">Bracket Format</Label>
                        <Select
                          value={formData.bracketFormat}
                          onValueChange={(value) => setFormData({ ...formData, bracketFormat: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SINGLE_ELIMINATION">Single Elimination</SelectItem>
                            <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                            <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="maxPlayers">Max Players</Label>
                        <Input
                          id="maxPlayers"
                          type="number"
                          min="4"
                          max="128"
                          value={formData.maxPlayers}
                          onChange={(e) => setFormData({ ...formData, maxPlayers: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ageMin">Min Age (optional)</Label>
                        <Input
                          id="ageMin"
                          type="number"
                          min="5"
                          max="100"
                          value={formData.ageMin}
                          onChange={(e) => setFormData({ ...formData, ageMin: e.target.value })}
                          placeholder="No minimum"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ageMax">Max Age (optional)</Label>
                        <Input
                          id="ageMax"
                          type="number"
                          min="5"
                          max="100"
                          value={formData.ageMax}
                          onChange={(e) => setFormData({ ...formData, ageMax: e.target.value })}
                          placeholder="No maximum"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="gender">Gender Category</Label>
                      <Select
                        value={formData.gender}
                        onValueChange={(value) => setFormData({ ...formData, gender: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MIXED">Mixed (All Genders)</SelectItem>
                          <SelectItem value="MALE">Male Only</SelectItem>
                          <SelectItem value="FEMALE">Female Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Tournament description, rules, prizes, etc."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Fees & Prize */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Fees & Prize</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="entryFee">Entry Fee (per player)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="entryFee"
                          type="number"
                          min="0"
                          value={formData.entryFee}
                          onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Individual players pay this fee during registration
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                      <div className="relative">
                        <Trophy className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="prizePool"
                          type="number"
                          min="0"
                          value={formData.prizePool}
                          onChange={(e) => setFormData({ ...formData, prizePool: e.target.value })}
                          className="pl-10"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Summary */}
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-gray-900">Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Badge className="bg-purple-100 text-purple-700">Intra-Org</Badge>
                      <span className="text-gray-600">Your org members only</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4" />
                      <span>Max {formData.maxPlayers || 32} players</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {formData.startDate
                          ? new Date(formData.startDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "TBD"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4" />
                      <span>₹{formData.entryFee || 0} per player</span>
                    </div>
                    <div className="border-t pt-3 mt-3">
                      <div className="flex items-center gap-2 text-amber-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-medium">Requires Admin Approval</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className={cn("w-full gap-2", primaryBtnClass)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-4 h-4" />
                      Create Tournament
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
