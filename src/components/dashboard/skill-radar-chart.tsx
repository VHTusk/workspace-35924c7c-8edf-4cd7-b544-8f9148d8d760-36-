"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillMetrics {
  accuracy: number;
  consistency: number;
  clutch: number;
  endurance: number;
  strategy: number;
  teamwork: number;
  matchesAnalyzed: number;
}

interface SkillRadarChartProps {
  skillMetrics: SkillMetrics | null;
  loading?: boolean;
  onRecalculate?: () => void;
  sport?: "cornhole" | "darts";
}

export function SkillRadarChart({ 
  skillMetrics, 
  loading = false,
  onRecalculate,
  sport = "cornhole"
}: SkillRadarChartProps) {
  const primaryColor = sport === "cornhole" ? "#22c55e" : "#14b8a6";
  
  const chartConfig = {
    skill: {
      label: "Skill Level",
      color: primaryColor,
    },
  } satisfies ChartConfig;

  if (loading) {
    return (
      <Card className="bg-card border-border/50 shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Skill Radar</CardTitle>
          <CardDescription>Loading your skill metrics...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
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
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-center">
            Complete at least 5 matches to see your skill radar chart
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate average skill
  const avgSkill = Math.round(
    (skillMetrics.accuracy + skillMetrics.consistency + skillMetrics.clutch + 
     skillMetrics.endurance + skillMetrics.strategy + skillMetrics.teamwork) / 6
  );

  // Data for radar chart visualization (using bar chart as fallback)
  const radarData = [
    { dimension: "Accuracy", value: skillMetrics.accuracy, fullMark: 100 },
    { dimension: "Consistency", value: skillMetrics.consistency, fullMark: 100 },
    { dimension: "Clutch", value: skillMetrics.clutch, fullMark: 100 },
    { dimension: "Endurance", value: skillMetrics.endurance, fullMark: 100 },
    { dimension: "Strategy", value: skillMetrics.strategy, fullMark: 100 },
    { dimension: "Teamwork", value: skillMetrics.teamwork, fullMark: 100 },
  ];

  return (
    <Card className="bg-card border-border/50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-foreground flex items-center gap-2">
              Skill Radar
              <span className={cn(
                "text-sm font-normal px-2 py-0.5 rounded-full",
                sport === "cornhole" 
                  ? "bg-green-500/10 text-green-500" 
                  : "bg-teal-500/10 text-teal-500"
              )}>
                Avg: {avgSkill}
              </span>
            </CardTitle>
            <CardDescription>
              Based on {skillMetrics.matchesAnalyzed} matches analyzed
            </CardDescription>
          </div>
          {onRecalculate && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onRecalculate}
              className="text-muted-foreground"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-64 w-full">
          {/* Custom Radar Visualization using polar coordinates */}
          <svg viewBox="0 0 300 300" className="w-full h-full">
            {/* Background circles */}
            {[20, 40, 60, 80, 100].map((radius) => (
              <circle
                key={radius}
                cx="150"
                cy="150"
                r={radius * 1.2}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth="1"
                strokeOpacity="0.3"
              />
            ))}
            
            {/* Axis lines */}
            {[0, 60, 120, 180, 240, 300].map((angle) => {
              const radian = (angle - 90) * (Math.PI / 180);
              const x2 = 150 + 120 * Math.cos(radian);
              const y2 = 150 + 120 * Math.sin(radian);
              return (
                <line
                  key={angle}
                  x1="150"
                  y1="150"
                  x2={x2}
                  y2={y2}
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              );
            })}
            
            {/* Skill polygon */}
            <polygon
              points={radarData.map((d, i) => {
                const angle = (i * 60 - 90) * (Math.PI / 180);
                const radius = (d.value / 100) * 120;
                const x = 150 + radius * Math.cos(angle);
                const y = 150 + radius * Math.sin(angle);
                return `${x},${y}`;
              }).join(' ')}
              fill={primaryColor}
              fillOpacity="0.3"
              stroke={primaryColor}
              strokeWidth="2"
            />
            
            {/* Skill points */}
            {radarData.map((d, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const radius = (d.value / 100) * 120;
              const x = 150 + radius * Math.cos(angle);
              const y = 150 + radius * Math.sin(angle);
              return (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r="5"
                  fill={primaryColor}
                />
              );
            })}
            
            {/* Labels */}
            {radarData.map((d, i) => {
              const angle = (i * 60 - 90) * (Math.PI / 180);
              const labelRadius = 140;
              const x = 150 + labelRadius * Math.cos(angle);
              const y = 150 + labelRadius * Math.sin(angle);
              const textAnchor = x < 150 ? 'end' : x > 150 ? 'start' : 'middle';
              return (
                <g key={`label-${i}`}>
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor={textAnchor}
                    className="text-xs fill-muted-foreground"
                    style={{ fontSize: '10px' }}
                  >
                    {d.dimension}
                  </text>
                  <text
                    x={x}
                    y={y + 6}
                    textAnchor={textAnchor}
                    className="font-semibold"
                    style={{ fontSize: '11px', fill: primaryColor }}
                  >
                    {d.value}
                  </text>
                </g>
              );
            })}
          </svg>
        </ChartContainer>
        
        {/* Skill Legend */}
        <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Accuracy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Consistency</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Clutch</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Endurance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Strategy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            <span className="text-muted-foreground">Teamwork</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
