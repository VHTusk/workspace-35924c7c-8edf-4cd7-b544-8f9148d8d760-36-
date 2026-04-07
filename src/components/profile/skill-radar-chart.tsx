"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw, Trophy, Flame, Info, Target, TrendingUp, Zap, Clock, Users, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillMetrics {
  accuracy: number;
  consistency: number;
  clutch: number;
  endurance: number;
  strategy: number;
  teamwork: number;
  matchesAnalyzed: number;
  lastCalculated: string | null;
}

interface StreakInfo {
  currentWinStreak: number;
  bestWinStreak: number;
  currentMatchStreak: number;
  bestMatchStreak: number;
  streakStartedAt: string | null;
}

interface SkillRadarChartProps {
  sport?: "cornhole" | "darts";
}

// Skill definitions with tooltips
const skillDefinitions = [
  {
    key: "accuracy",
    label: "Accuracy",
    description: "Shooting accuracy percentage across matches",
    icon: Crosshair,
  },
  {
    key: "consistency",
    label: "Consistency",
    description: "Performance consistency across tournaments",
    icon: Target,
  },
  {
    key: "clutch",
    label: "Clutch",
    description: "Performance under pressure in critical moments",
    icon: Zap,
  },
  {
    key: "endurance",
    label: "Endurance",
    description: "Stamina in long tournament sessions",
    icon: Clock,
  },
  {
    key: "strategy",
    label: "Strategy",
    description: "Game IQ and strategic decision making",
    icon: TrendingUp,
  },
  {
    key: "teamwork",
    label: "Teamwork",
    description: "Team coordination in doubles/partner events",
    icon: Users,
  },
];

export function SkillRadarChart({ sport = "cornhole" }: SkillRadarChartProps) {
  const [skillMetrics, setSkillMetrics] = useState<SkillMetrics | null>(null);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryColor = isCornhole ? "#22c55e" : "#14b8a6";
  const primaryColorClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-900/20" : "bg-teal-50 dark:bg-teal-900/20";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";

  const fetchSkillMetrics = useCallback(async () => {
    try {
      const response = await fetch(`/api/player/skill-metrics?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setSkillMetrics(data.skillMetrics);
        setStreak(data.streak);
      }
    } catch (error) {
      console.error("Failed to fetch skill metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    fetchSkillMetrics();
  }, [fetchSkillMetrics]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const response = await fetch(`/api/player/skill-metrics?sport=${sport.toUpperCase()}`, {
        method: "POST",
      });
      if (response.ok) {
        const data = await response.json();
        setSkillMetrics(data.skillMetrics);
      }
    } catch (error) {
      console.error("Failed to recalculate skill metrics:", error);
    } finally {
      setRecalculating(false);
    }
  };

  // Calculate radar points
  const calculatePoints = () => {
    if (!skillMetrics) return "";

    const skills = [
      skillMetrics.accuracy,
      skillMetrics.consistency,
      skillMetrics.clutch,
      skillMetrics.endurance,
      skillMetrics.strategy,
      skillMetrics.teamwork,
    ];

    const cx = 150;
    const cy = 150;
    const r = 110;

    return skills
      .map((value, i) => {
        const angle = ((-90 + i * 60) * Math.PI) / 180;
        const radius = (value / 100) * r;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x},${y}`;
      })
      .join(" ");
  };

  // Calculate label positions
  const getLabelPosition = (index: number, isValue: boolean = false) => {
    const cx = 150;
    const cy = 150;
    const labelRadius = 138;
    const valueRadius = 125;
    const r = isValue ? valueRadius : labelRadius;
    const angle = ((-90 + index * 60) * Math.PI) / 180;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    return { x, y };
  };

  const formatLastCalculated = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const avgSkill = skillMetrics
    ? Math.round(
        (skillMetrics.accuracy +
          skillMetrics.consistency +
          skillMetrics.clutch +
          skillMetrics.endurance +
          skillMetrics.strategy +
          skillMetrics.teamwork) /
          6
      )
    : 0;

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Skill Radar</CardTitle>
          <CardDescription>Loading your skill metrics...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[350px]">
          <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!skillMetrics) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Skill Radar</CardTitle>
          <CardDescription>Play more matches to unlock skill analysis</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center min-h-[350px] text-center">
          <Trophy className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Complete at least 5 matches to see your skill radar chart
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              Skill Radar
              <Badge
                className={cn(
                  "font-normal",
                  isCornhole
                    ? "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                    : "bg-teal-500/10 text-teal-600 hover:bg-teal-500/20"
                )}
              >
                Avg: {avgSkill}%
              </Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>Based on {skillMetrics.matchesAnalyzed} matches analyzed</span>
              <span className="text-muted-foreground/50">•</span>
              <span className="text-xs">Updated: {formatLastCalculated(skillMetrics.lastCalculated)}</span>
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
            className="gap-1"
          >
            <RefreshCw className={cn("w-4 h-4", recalculating && "animate-spin")} />
            Recalculate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Streak Display */}
        {streak && (
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">
                    {streak.currentWinStreak} Win Streak
                  </span>
                  {streak.currentWinStreak >= 3 && (
                    <Badge className="bg-orange-500 text-white text-xs">
                      <Flame className="w-3 h-3 mr-1" />
                      Hot!
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">Current streak</span>
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="flex items-center gap-1 justify-end">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-foreground">{streak.bestWinStreak}</span>
              </div>
              <span className="text-xs text-muted-foreground">Best streak</span>
            </div>
          </div>
        )}

        {/* Radar Chart */}
        <div className="flex justify-center">
          <div className="relative" style={{ width: "min(100%, 350px)", height: "auto", aspectRatio: "1" }}>
            <svg viewBox="0 0 300 300" className="w-full h-full">
              {/* Concentric circles for scale */}
              {[20, 40, 60, 80, 100].map((scale) => (
                <circle
                  key={scale}
                  cx="150"
                  cy="150"
                  r={scale * 1.1}
                  fill="none"
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              ))}

              {/* Axis lines */}
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const angle = ((-90 + i * 60) * Math.PI) / 180;
                const x2 = 150 + 110 * Math.cos(angle);
                const y2 = 150 + 110 * Math.sin(angle);
                return (
                  <line
                    key={i}
                    x1="150"
                    y1="150"
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                );
              })}

              {/* Skill polygon fill */}
              <polygon
                points={calculatePoints()}
                fill={primaryColor}
                fillOpacity="0.2"
                stroke={primaryColor}
                strokeWidth="2"
                className="transition-all duration-300"
              />

              {/* Skill points */}
              {skillMetrics && (
                <>
                  {[
                    skillMetrics.accuracy,
                    skillMetrics.consistency,
                    skillMetrics.clutch,
                    skillMetrics.endurance,
                    skillMetrics.strategy,
                    skillMetrics.teamwork,
                  ].map((value, i) => {
                    const angle = ((-90 + i * 60) * Math.PI) / 180;
                    const r = 110;
                    const radius = (value / 100) * r;
                    const x = 150 + radius * Math.cos(angle);
                    const y = 150 + radius * Math.sin(angle);
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="5"
                        fill={primaryColor}
                        stroke="white"
                        strokeWidth="2"
                        className="transition-all duration-300"
                      />
                    );
                  })}
                </>
              )}

              {/* Labels with values */}
              <TooltipProvider>
                {skillDefinitions.map((skill, i) => {
                  const labelPos = getLabelPosition(i, false);
                  const valuePos = getLabelPosition(i, true);
                  const value = skillMetrics[skill.key as keyof SkillMetrics] as number;
                  const textAnchor = labelPos.x < 145 ? "end" : labelPos.x > 155 ? "start" : "middle";

                  return (
                    <g key={skill.key}>
                      {/* Skill label */}
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor={textAnchor}
                        className="text-xs fill-muted-foreground font-medium"
                        style={{ fontSize: "10px" }}
                      >
                        {skill.label}
                      </text>
                      {/* Skill value */}
                      <text
                        x={valuePos.x}
                        y={valuePos.y + 5}
                        textAnchor={textAnchor}
                        className="font-bold"
                        style={{ fontSize: "11px", fill: primaryColor }}
                      >
                        {value}%
                      </text>
                    </g>
                  );
                })}
              </TooltipProvider>
            </svg>
          </div>
        </div>

        {/* Skill Legend with Tooltips */}
        <TooltipProvider>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {skillDefinitions.map((skill) => (
              <Tooltip key={skill.key}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-help">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="text-muted-foreground truncate">{skill.label}</span>
                    <Info className="w-3 h-3 text-muted-foreground/50" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px]">
                  <div className="flex items-center gap-2">
                    <skill.icon className="w-4 h-4" />
                    <div>
                      <div className="font-semibold">{skill.label}</div>
                      <div className="text-xs text-muted-foreground">{skill.description}</div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
