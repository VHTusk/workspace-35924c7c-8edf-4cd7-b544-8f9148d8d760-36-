"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Target,
  Plus,
  ArrowLeft,
  Loader2,
  CheckCircle,
  TrendingUp,
  Calendar,
  Building2,
  Award,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  period: string;
  startDate: string;
  endDate: string;
  isAchieved: boolean;
  achievedAt: string | null;
  departmentId: string | null;
  rewardType: string | null;
  rewardValue: number | null;
}

export default function ParticipationGoalsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newGoal, setNewGoal] = useState({
    goalType: "PARTICIPATION_RATE",
    targetValue: 50,
    period: "MONTHLY",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (orgId) {
      fetchGoals();
    }
  }, [orgId]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrgId(data.id);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchGoals = async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      // Use demo data for now
      setGoals(getDemoGoals());
    } catch (err) {
      console.error("Failed to fetch goals:", err);
      setGoals(getDemoGoals());
    } finally {
      setLoading(false);
    }
  };

  const getDemoGoals = (): Goal[] => [
    {
      id: "1",
      goalType: "PARTICIPATION_RATE",
      targetValue: 50,
      currentValue: 38,
      period: "MONTHLY",
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isAchieved: false,
      achievedAt: null,
      departmentId: null,
      rewardType: "BADGE",
      rewardValue: 100,
    },
    {
      id: "2",
      goalType: "TOTAL_MATCHES",
      targetValue: 100,
      currentValue: 127,
      period: "QUARTERLY",
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      isAchieved: true,
      achievedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      departmentId: null,
      rewardType: "POINTS",
      rewardValue: 500,
    },
    {
      id: "3",
      goalType: "ACTIVE_PLAYERS",
      targetValue: 75,
      currentValue: 95,
      period: "ANNUAL",
      startDate: new Date(new Date().getFullYear(), 0, 1).toISOString(),
      endDate: new Date(new Date().getFullYear(), 11, 31).toISOString(),
      isAchieved: true,
      achievedAt: new Date().toISOString(),
      departmentId: null,
      rewardType: null,
      rewardValue: null,
    },
  ];

  const getGoalTypeLabel = (type: string) => {
    switch (type) {
      case "PARTICIPATION_RATE":
        return "Participation Rate";
      case "TOTAL_MATCHES":
        return "Total Matches";
      case "TOURNAMENTS":
        return "Tournaments";
      case "ACTIVE_PLAYERS":
        return "Active Players";
      default:
        return type;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "MONTHLY":
        return "Monthly";
      case "QUARTERLY":
        return "Quarterly";
      case "ANNUAL":
        return "Annual";
      default:
        return period;
    }
  };

  const handleAddGoal = async () => {
    setSaving(true);
    // In a real app, this would call the API
    setTimeout(() => {
      const goal: Goal = {
        id: Date.now().toString(),
        goalType: newGoal.goalType,
        targetValue: newGoal.targetValue,
        currentValue: 0,
        period: newGoal.period,
        startDate: new Date().toISOString(),
        endDate: new Date(
          newGoal.period === "MONTHLY"
            ? Date.now() + 30 * 24 * 60 * 60 * 1000
            : newGoal.period === "QUARTERLY"
            ? Date.now() + 90 * 24 * 60 * 60 * 1000
            : Date.now() + 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
        isAchieved: false,
        achievedAt: null,
        departmentId: null,
        rewardType: null,
        rewardValue: null,
      };
      setGoals([...goals, goal]);
      setShowAddDialog(false);
      setSaving(false);
    }, 500);
  };

  const getProgressColor = (current: number, target: number) => {
    const percentage = (current / target) * 100;
    if (percentage >= 100) return "bg-green-500";
    if (percentage >= 75) return "bg-teal-500";
    if (percentage >= 50) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/corporate-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Participation Goals</h1>
                <p className="text-gray-500">
                  Set and track participation targets for your organization
                </p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Goal
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {goals.filter((g) => g.isAchieved).length}
                    </p>
                    <p className="text-xs text-gray-500">Goals Achieved</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <Target className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {goals.filter((g) => !g.isAchieved).length}
                    </p>
                    <p className="text-xs text-gray-500">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-50">
                    <TrendingUp className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {goals.length > 0
                        ? Math.round(
                            (goals.reduce((sum, g) => sum + (g.currentValue / g.targetValue) * 100, 0) /
                              goals.length)
                          )
                        : 0}
                      %
                    </p>
                    <p className="text-xs text-gray-500">Avg Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Goals List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : goals.length === 0 ? (
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="py-12 text-center">
                <Target className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-gray-500">No goals set yet</p>
                <p className="text-sm text-gray-400 mb-4">
                  Set your first participation goal to get started
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Goal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map((goal) => {
                const progress = Math.min(
                  100,
                  Math.round((goal.currentValue / goal.targetValue) * 100)
                );
                return (
                  <Card
                    key={goal.id}
                    className={cn(
                      "bg-white border-gray-100 shadow-sm",
                      goal.isAchieved && "border-green-200 bg-green-50/30"
                    )}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Target className={cn("h-4 w-4", primaryTextClass)} />
                          {getGoalTypeLabel(goal.goalType)}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {goal.isAchieved ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Achieved
                            </Badge>
                          ) : (
                            <Badge variant="outline">
                              {getPeriodLabel(goal.period)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <CardDescription className="text-xs">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {new Date(goal.startDate).toLocaleDateString()} -{" "}
                        {new Date(goal.endDate).toLocaleDateString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-3xl font-bold">
                            {goal.currentValue}
                            <span className="text-lg text-gray-400">/{goal.targetValue}</span>
                          </p>
                          <p className="text-xs text-gray-500">
                            {goal.goalType === "PARTICIPATION_RATE" ? "%" : "count"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={cn(
                              "text-lg font-bold",
                              progress >= 100
                                ? "text-green-600"
                                : progress >= 75
                                ? "text-teal-600"
                                : "text-gray-600"
                            )}
                          >
                            {progress}%
                          </p>
                          <p className="text-xs text-gray-500">complete</p>
                        </div>
                      </div>
                      <Progress
                        value={progress}
                        className={cn("h-2", goal.isAchieved && "[&>div]:bg-green-500")}
                      />
                      {goal.rewardType && (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Award className="h-3 w-3" />
                          Reward: {goal.rewardValue} {goal.rewardType === "POINTS" ? "points" : "badge"}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Add Goal Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Participation Goal</DialogTitle>
            <DialogDescription>
              Set a new target for your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Type</Label>
              <Select
                value={newGoal.goalType}
                onValueChange={(v) => setNewGoal({ ...newGoal, goalType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARTICIPATION_RATE">Participation Rate (%)</SelectItem>
                  <SelectItem value="TOTAL_MATCHES">Total Matches</SelectItem>
                  <SelectItem value="TOURNAMENTS">Tournaments</SelectItem>
                  <SelectItem value="ACTIVE_PLAYERS">Active Players</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Target Value</Label>
              <Input
                type="number"
                value={newGoal.targetValue}
                onChange={(e) =>
                  setNewGoal({ ...newGoal, targetValue: parseInt(e.target.value) || 0 })
                }
                placeholder={newGoal.goalType === "PARTICIPATION_RATE" ? "e.g., 50" : "e.g., 100"}
              />
              <p className="text-xs text-gray-500">
                {newGoal.goalType === "PARTICIPATION_RATE"
                  ? "Percentage of employees who participate"
                  : newGoal.goalType === "TOTAL_MATCHES"
                  ? "Total number of matches to play"
                  : newGoal.goalType === "TOURNAMENTS"
                  ? "Number of tournaments"
                  : "Number of active players"}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Period</Label>
              <Select
                value={newGoal.period}
                onValueChange={(v) => setNewGoal({ ...newGoal, period: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="ANNUAL">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAddGoal}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Goal
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
