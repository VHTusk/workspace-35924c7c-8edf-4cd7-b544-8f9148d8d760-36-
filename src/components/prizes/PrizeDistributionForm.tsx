"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Trophy,
  Medal,
  Award,
  Percent,
  IndianRupee,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

const distributionSchema = z.object({
  distributions: z.array(
    z.object({
      position: z.number().min(1),
      percentage: z.number().min(0).max(100),
      label: z.string(),
    })
  ),
});

type DistributionFormValues = z.infer<typeof distributionSchema>;

interface Distribution {
  position: number;
  percentage: number;
  label: string;
}

interface PrizeDistributionFormProps {
  prizePool: number;
  initialDistributions?: Distribution[];
  onSave: (distributions: Distribution[]) => Promise<void>;
  disabled?: boolean;
}

const POSITION_ICONS: Record<number, React.ReactNode> = {
  1: <Trophy className="w-5 h-5 text-amber-400" />,
  2: <Medal className="w-5 h-5 text-gray-400" />,
  3: <Award className="w-5 h-5 text-amber-600" />,
};

const POSITION_COLORS: Record<number, string> = {
  1: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  2: "bg-gray-500/10 border-gray-500/30 text-gray-400",
  3: "bg-orange-500/10 border-orange-500/30 text-orange-400",
};

export function PrizeDistributionForm({
  prizePool,
  initialDistributions,
  onSave,
  disabled = false,
}: PrizeDistributionFormProps) {
  const [distributions, setDistributions] = useState<Distribution[]>(
    initialDistributions || [
      { position: 1, percentage: 50, label: "1st Place" },
      { position: 2, percentage: 30, label: "2nd Place" },
      { position: 3, percentage: 20, label: "3rd Place" },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<DistributionFormValues>({
    resolver: zodResolver(distributionSchema),
    defaultValues: {
      distributions,
    },
  });

  // Calculate total percentage
  const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.01;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Update distribution percentage
  const updatePercentage = (position: number, percentage: number) => {
    setDistributions((prev) =>
      prev.map((d) => (d.position === position ? { ...d, percentage } : d))
    );
  };

  // Add new position
  const addPosition = () => {
    const newPosition = Math.max(...distributions.map((d) => d.position)) + 1;
    setDistributions((prev) => [
      ...prev,
      { position: newPosition, percentage: 0, label: `${newPosition}${getOrdinalSuffix(newPosition)} Place` },
    ]);
  };

  // Remove position
  const removePosition = (position: number) => {
    if (distributions.length <= 1) return;
    setDistributions((prev) => prev.filter((d) => d.position !== position));
  };

  // Reset to default
  const resetToDefault = () => {
    setDistributions([
      { position: 1, percentage: 50, label: "1st Place" },
      { position: 2, percentage: 30, label: "2nd Place" },
      { position: 3, percentage: 20, label: "3rd Place" },
    ]);
  };

  // Get ordinal suffix for position
  const getOrdinalSuffix = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  // Handle save
  const handleSave = async () => {
    if (!isValid) {
      setError("Total percentage must equal 100%");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(distributions);
    } catch (err) {
      setError("Failed to save distribution");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-teal-400" />
              Prize Distribution
            </CardTitle>
            <CardDescription>
              Configure how the prize pool is distributed among winners
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Total Prize Pool</p>
            <p className="text-xl font-bold text-foreground">
              {formatCurrency(prizePool)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Validation Status */}
        <div
          className={`flex items-center gap-2 p-3 rounded-lg ${
            isValid
              ? "bg-emerald-500/10 border border-emerald-500/30"
              : "bg-red-500/10 border border-red-500/30"
          }`}
        >
          {isValid ? (
            <>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-emerald-400">
                Distribution is valid (100%)
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">
                Total: {totalPercentage.toFixed(1)}% (must equal 100%)
              </span>
            </>
          )}
        </div>

        {/* Distribution List */}
        <div className="space-y-4">
          {distributions.map((dist) => (
            <div
              key={dist.position}
              className="p-4 rounded-lg bg-muted/50 border border-border/50"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Badge
                    className={
                      POSITION_COLORS[dist.position] ||
                      "bg-muted text-muted-foreground"
                    }
                  >
                    {POSITION_ICONS[dist.position] || (
                      <Award className="w-4 h-4" />
                    )}
                    <span className="ml-1">{dist.position}</span>
                  </Badge>
                  <span className="font-medium text-foreground">
                    {dist.label}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(
                        Math.floor((prizePool * dist.percentage) / 100)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {dist.percentage}% of pool
                    </p>
                  </div>
                  {distributions.length > 1 && !disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:bg-red-500/10"
                      onClick={() => removePosition(dist.position)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Percentage</span>
                  <span className="font-medium text-foreground">
                    {dist.percentage}%
                  </span>
                </div>
                <Slider
                  value={[dist.percentage]}
                  onValueChange={(value) =>
                    updatePercentage(dist.position, value[0])
                  }
                  max={100}
                  step={1}
                  disabled={disabled}
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        {!disabled && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={addPosition}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Position
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset to Default
            </Button>
            <Button
              className="ml-auto bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={handleSave}
              disabled={!isValid || saving}
            >
              {saving ? "Saving..." : "Save Distribution"}
            </Button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
