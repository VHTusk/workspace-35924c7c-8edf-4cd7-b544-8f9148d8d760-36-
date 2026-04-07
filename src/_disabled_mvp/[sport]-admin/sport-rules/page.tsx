"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle,
  Settings,
  Trophy,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SportRules {
  id: string;
  sport: string;
  // Match points
  cityParticipation: number;
  cityWin: number;
  districtParticipation: number;
  districtWin: number;
  stateParticipation: number;
  stateWin: number;
  nationalParticipation: number;
  nationalWin: number;
  // Placement points
  cityFirst: number;
  citySecond: number;
  cityThird: number;
  districtFirst: number;
  districtSecond: number;
  districtThird: number;
  stateFirst: number;
  stateSecond: number;
  stateThird: number;
  nationalFirst: number;
  nationalSecond: number;
  nationalThird: number;
}

const defaultRules: SportRules = {
  id: "",
  sport: "",
  cityParticipation: 1,
  cityWin: 2,
  districtParticipation: 1,
  districtWin: 3,
  stateParticipation: 2,
  stateWin: 4,
  nationalParticipation: 3,
  nationalWin: 6,
  cityFirst: 10,
  citySecond: 6,
  cityThird: 3,
  districtFirst: 15,
  districtSecond: 9,
  districtThird: 5,
  stateFirst: 20,
  stateSecond: 12,
  stateThird: 6,
  nationalFirst: 30,
  nationalSecond: 18,
  nationalThird: 9,
};

export default function SportRulesPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [rules, setRules] = useState<SportRules>({ ...defaultRules, sport: sport.toUpperCase() });

  useEffect(() => {
    fetchRules();
  }, [sport]);

  const fetchRules = async () => {
    try {
      const response = await fetch(`/api/admin/sport-rules?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.rules) {
          setRules(data.rules);
        }
      }
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/admin/sport-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to save rules");
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError("Failed to save rules");
    } finally {
      setSaving(false);
    }
  };

  const updateRule = (key: keyof SportRules, value: number) => {
    setRules((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const renderPointsInput = (
    label: string,
    key: keyof SportRules,
    description?: string
  ) => (
    <div className="space-y-2">
      <Label className="text-gray-700">{label}</Label>
      <Input
        type="number"
        value={rules[key] as number}
        onChange={(e) => updateRule(key, parseInt(e.target.value) || 0)}
        min="0"
        className="w-24"
      />
      {description && (
        <p className="text-xs text-gray-500">{description}</p>
      )}
    </div>
  );

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <Link
          href={`/${sport}/admin`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sport Rules Configuration</h1>
            <p className="text-gray-500">Configure points weights and placement bonuses</p>
          </div>
          <Badge className={cn(primaryBgClass, primaryTextClass)}>
            {sport.toUpperCase()}
          </Badge>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-700 mb-6">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription>Rules saved successfully!</AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="match-points" className="space-y-6">
          <TabsList>
            <TabsTrigger value="match-points" className="gap-2">
              <Target className="w-4 h-4" />
              Match Points
            </TabsTrigger>
            <TabsTrigger value="placement-points" className="gap-2">
              <Trophy className="w-4 h-4" />
              Placement Bonuses
            </TabsTrigger>
          </TabsList>

          {/* Match Points */}
          <TabsContent value="match-points">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Weighted Match Points by Scope</CardTitle>
                <CardDescription>
                  Points awarded for participation and wins at each tournament level
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* City */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <h3 className="font-medium text-blue-900 mb-4">City Level</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {renderPointsInput("Participation Points", "cityParticipation", "Points for playing a match")}
                    {renderPointsInput("Win Points", "cityWin", "Additional points for winning")}
                  </div>
                  <p className="text-sm text-blue-700 mt-3">
                    Total per win: <strong>{rules.cityParticipation + rules.cityWin}</strong> pts
                  </p>
                </div>

                {/* District */}
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                  <h3 className="font-medium text-purple-900 mb-4">District Level</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {renderPointsInput("Participation Points", "districtParticipation")}
                    {renderPointsInput("Win Points", "districtWin")}
                  </div>
                  <p className="text-sm text-purple-700 mt-3">
                    Total per win: <strong>{rules.districtParticipation + rules.districtWin}</strong> pts
                  </p>
                </div>

                {/* State */}
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                  <h3 className="font-medium text-amber-900 mb-4">State Level</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {renderPointsInput("Participation Points", "stateParticipation")}
                    {renderPointsInput("Win Points", "stateWin")}
                  </div>
                  <p className="text-sm text-amber-700 mt-3">
                    Total per win: <strong>{rules.stateParticipation + rules.stateWin}</strong> pts
                  </p>
                </div>

                {/* National */}
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <h3 className="font-medium text-red-900 mb-4">National Level</h3>
                  <div className="grid grid-cols-2 gap-6">
                    {renderPointsInput("Participation Points", "nationalParticipation")}
                    {renderPointsInput("Win Points", "nationalWin")}
                  </div>
                  <p className="text-sm text-red-700 mt-3">
                    Total per win: <strong>{rules.nationalParticipation + rules.nationalWin}</strong> pts
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Placement Points */}
          <TabsContent value="placement-points">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardHeader>
                <CardTitle>Placement Bonus Points</CardTitle>
                <CardDescription>
                  Bonus points awarded to top 3 finishers in tournaments
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* City */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                  <h3 className="font-medium text-blue-900 mb-4">City Level</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {renderPointsInput("🥇 1st Place", "cityFirst")}
                    {renderPointsInput("🥈 2nd Place", "citySecond")}
                    {renderPointsInput("🥉 3rd Place", "cityThird")}
                  </div>
                </div>

                {/* District */}
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                  <h3 className="font-medium text-purple-900 mb-4">District Level</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {renderPointsInput("🥇 1st Place", "districtFirst")}
                    {renderPointsInput("🥈 2nd Place", "districtSecond")}
                    {renderPointsInput("🥉 3rd Place", "districtThird")}
                  </div>
                </div>

                {/* State */}
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                  <h3 className="font-medium text-amber-900 mb-4">State Level</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {renderPointsInput("🥇 1st Place", "stateFirst")}
                    {renderPointsInput("🥈 2nd Place", "stateSecond")}
                    {renderPointsInput("🥉 3rd Place", "stateThird")}
                  </div>
                </div>

                {/* National */}
                <div className="p-4 rounded-lg bg-red-50 border border-red-100">
                  <h3 className="font-medium text-red-900 mb-4">National Level</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {renderPointsInput("🥇 1st Place", "nationalFirst")}
                    {renderPointsInput("🥈 2nd Place", "nationalSecond")}
                    {renderPointsInput("🥉 3rd Place", "nationalThird")}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className={primaryBtnClass}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        {/* Calibration Info */}
        <Card className="bg-white border-gray-100 shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Points Calibration Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• Weight ratios ensure state/national tournaments are more valuable than city events</p>
            <p>• Annual review recommended to maintain competitive balance</p>
            <p>• Minimum tournament size thresholds apply for placement bonuses</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
