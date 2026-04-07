"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Trophy, Calendar, MapPin, DollarSign, User, Phone, MessageCircle, Map } from "lucide-react";

export default function CreateTournamentPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const sportType = sport.toUpperCase();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "INDIVIDUAL",
    scope: "CITY",
    location: "",
    city: "",
    district: "",
    state: "",
    venueGoogleMapsUrl: "",
    startDate: "",
    endDate: "",
    regDeadline: "",
    prizePool: "0",
    entryFee: "0",
    maxPlayers: "32",
    bracketFormat: "SINGLE_ELIMINATION",
    isPublic: true,
    scoringMode: "STAFF_ONLY",
    ageMin: "",
    ageMax: "",
    gender: "",
    // Manager fields (mandatory)
    managerName: "",
    managerPhone: "",
    managerWhatsApp: "",
    // Contact person fields (optional)
    contactPersonName: "",
    contactPersonPhone: "",
    contactPersonWhatsApp: "",
  });

  const handleChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sport: sportType,
          prizePool: parseInt(formData.prizePool) || 0,
          entryFee: parseInt(formData.entryFee) || 0,
          maxPlayers: parseInt(formData.maxPlayers) || 32,
          ageMin: formData.ageMin ? parseInt(formData.ageMin) : null,
          ageMax: formData.ageMax ? parseInt(formData.ageMax) : null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create tournament");
      }

      router.push(`/${sport}/admin/tournaments/${data.tournament.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tournament");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href={`/${sport}/admin`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create Tournament</h1>
            <p className="text-muted-foreground mt-1">
              Set up a new {sport === "cornhole" ? "Cornhole" : "Darts"} tournament
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-400" />
                  Basic Information
                </CardTitle>
                <CardDescription>Tournament name and type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tournament Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="e.g., Jaipur Cornhole Championship 2025"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="type">Tournament Type *</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) => handleChange("type", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                        <SelectItem value="INTER_ORG">Inter-Organization</SelectItem>
                        <SelectItem value="INTRA_ORG">Intra-Organization</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="scope">Scope</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(v) => handleChange("scope", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CITY">City</SelectItem>
                        <SelectItem value="DISTRICT">District</SelectItem>
                        <SelectItem value="STATE">State</SelectItem>
                        <SelectItem value="NATIONAL">National</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bracketFormat">Bracket Format</Label>
                  <Select
                    value={formData.bracketFormat}
                    onValueChange={(v) => handleChange("bracketFormat", v)}
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
              </CardContent>
            </Card>

            {/* Location */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Venue Address *</Label>
                  <Textarea
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleChange("location", e.target.value)}
                    placeholder="Full address of the venue"
                    required
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => handleChange("city", e.target.value)}
                      placeholder="Jaipur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      value={formData.district}
                      onChange={(e) => handleChange("district", e.target.value)}
                      placeholder="Jaipur"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={formData.state}
                      onChange={(e) => handleChange("state", e.target.value)}
                      placeholder="Rajasthan"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Venue & Contact Information */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Map className="w-5 h-5 text-blue-400" />
                  Venue & Contact Information
                </CardTitle>
                <CardDescription>Google Maps link and tournament contact details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Google Maps URL */}
                <div className="space-y-2">
                  <Label htmlFor="venueGoogleMapsUrl">Google Maps Link</Label>
                  <Input
                    id="venueGoogleMapsUrl"
                    type="url"
                    value={formData.venueGoogleMapsUrl}
                    onChange={(e) => handleChange("venueGoogleMapsUrl", e.target.value)}
                    placeholder="https://maps.google.com/..."
                  />
                  <p className="text-xs text-muted-foreground">Paste the Google Maps link for the venue location</p>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Tournament Manager <span className="text-destructive">*</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="managerName">Name *</Label>
                      <Input
                        id="managerName"
                        value={formData.managerName}
                        onChange={(e) => handleChange("managerName", e.target.value)}
                        placeholder="Manager name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="managerPhone">Phone *</Label>
                      <Input
                        id="managerPhone"
                        type="tel"
                        value={formData.managerPhone}
                        onChange={(e) => handleChange("managerPhone", e.target.value)}
                        placeholder="+91 98765 43210"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="managerWhatsApp">WhatsApp (optional)</Label>
                      <Input
                        id="managerWhatsApp"
                        type="tel"
                        value={formData.managerWhatsApp}
                        onChange={(e) => handleChange("managerWhatsApp", e.target.value)}
                        placeholder="If different from phone"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Additional Contact Person
                    <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonName">Name</Label>
                      <Input
                        id="contactPersonName"
                        value={formData.contactPersonName}
                        onChange={(e) => handleChange("contactPersonName", e.target.value)}
                        placeholder="Contact person name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonPhone">Phone</Label>
                      <Input
                        id="contactPersonPhone"
                        type="tel"
                        value={formData.contactPersonPhone}
                        onChange={(e) => handleChange("contactPersonPhone", e.target.value)}
                        placeholder="+91 98765 43210"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPersonWhatsApp">WhatsApp</Label>
                      <Input
                        id="contactPersonWhatsApp"
                        type="tel"
                        value={formData.contactPersonWhatsApp}
                        onChange={(e) => handleChange("contactPersonWhatsApp", e.target.value)}
                        placeholder="If different from phone"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date *</Label>
                    <Input
                      id="startDate"
                      type="datetime-local"
                      value={formData.startDate}
                      onChange={(e) => handleChange("startDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date *</Label>
                    <Input
                      id="endDate"
                      type="datetime-local"
                      value={formData.endDate}
                      onChange={(e) => handleChange("endDate", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="regDeadline">Registration Deadline *</Label>
                    <Input
                      id="regDeadline"
                      type="datetime-local"
                      value={formData.regDeadline}
                      onChange={(e) => handleChange("regDeadline", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fees & Prizes */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  Fees & Prizes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryFee">Entry Fee (₹)</Label>
                    <Input
                      id="entryFee"
                      type="number"
                      min="0"
                      value={formData.entryFee}
                      onChange={(e) => handleChange("entryFee", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prizePool">Prize Pool (₹)</Label>
                    <Input
                      id="prizePool"
                      type="number"
                      min="0"
                      value={formData.prizePool}
                      onChange={(e) => handleChange("prizePool", e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxPlayers">Max Players</Label>
                    <Input
                      id="maxPlayers"
                      type="number"
                      min="4"
                      value={formData.maxPlayers}
                      onChange={(e) => handleChange("maxPlayers", e.target.value)}
                      placeholder="32"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Eligibility */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Eligibility (Optional)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="ageMin">Min Age</Label>
                    <Input
                      id="ageMin"
                      type="number"
                      min="0"
                      value={formData.ageMin}
                      onChange={(e) => handleChange("ageMin", e.target.value)}
                      placeholder="No limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ageMax">Max Age</Label>
                    <Input
                      id="ageMax"
                      type="number"
                      min="0"
                      value={formData.ageMax}
                      onChange={(e) => handleChange("ageMax", e.target.value)}
                      placeholder="No limit"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(v) => handleChange("gender", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All</SelectItem>
                        <SelectItem value="MALE">Male</SelectItem>
                        <SelectItem value="FEMALE">Female</SelectItem>
                        <SelectItem value="MIXED">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Settings */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Public Tournament</Label>
                    <p className="text-sm text-muted-foreground">
                      Allow anyone to view and register
                    </p>
                  </div>
                  <Switch
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => handleChange("isPublic", checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scoringMode">Scoring Mode</Label>
                  <Select
                    value={formData.scoringMode}
                    onValueChange={(v) => handleChange("scoringMode", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF_ONLY">Staff Only</SelectItem>
                      <SelectItem value="PLAYER_SELF">Player Self-Report</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex items-center justify-end gap-4">
              <Link href={`/${sport}/admin`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button
                type="submit"
                disabled={loading || !formData.name || !formData.location || !formData.startDate}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Tournament"
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
