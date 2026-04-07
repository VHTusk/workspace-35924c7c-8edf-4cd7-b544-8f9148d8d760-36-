"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calculator,
  Trophy,
  Medal,
  Award,
  IndianRupee,
  TrendingUp,
  PieChart,
  Gift,
} from "lucide-react";

interface Distribution {
  position: number;
  percentage: number;
  label: string;
}

interface PrizeResult {
  position: number;
  label: string;
  percentage: number;
  amount: number;
  gstAmount: number;
  totalWithGst: number;
}

interface NonMonetaryPrize {
  position: number;
  type: "TROPHY" | "MEDAL" | "MERCHANDISE" | "CERTIFICATE" | "OTHER";
  description: string;
  value?: number;
}

const DEFAULT_DISTRIBUTION: Distribution[] = [
  { position: 1, percentage: 50, label: "1st Place" },
  { position: 2, percentage: 30, label: "2nd Place" },
  { position: 3, percentage: 20, label: "3rd Place" },
];

const NON_MONETARY_DEFAULTS: NonMonetaryPrize[] = [
  { position: 1, type: "TROPHY", description: "Winner Trophy", value: 5000 },
  { position: 2, type: "TROPHY", description: "Runner-up Trophy", value: 3000 },
  { position: 3, type: "MEDAL", description: "Third Place Medal", value: 1500 },
];

const GST_RATE = 0.18; // 18% GST

export function PrizeCalculator() {
  const [prizePool, setPrizePool] = useState<number>(100000);
  const [distributions, setDistributions] = useState<Distribution[]>(DEFAULT_DISTRIBUTION);
  const [nonMonetaryPrizes, setNonMonetaryPrizes] = useState<NonMonetaryPrize[]>(NON_MONETARY_DEFAULTS);
  const [customPercentages, setCustomPercentages] = useState<Record<number, string>>({});

  // Calculate prize amounts
  const calculatedPrizes: PrizeResult[] = distributions.map((dist) => {
    const amount = Math.floor((prizePool * dist.percentage) / 100);
    const gstAmount = Math.floor(amount * GST_RATE);
    return {
      position: dist.position,
      label: dist.label,
      percentage: dist.percentage,
      amount,
      gstAmount,
      totalWithGst: amount + gstAmount,
    };
  });

  // Total calculations
  const totalPrizeMoney = calculatedPrizes.reduce((sum, p) => sum + p.amount, 0);
  const totalGst = calculatedPrizes.reduce((sum, p) => sum + p.gstAmount, 0);
  const totalWithGst = calculatedPrizes.reduce((sum, p) => sum + p.totalWithGst, 0);
  const totalNonMonetaryValue = nonMonetaryPrizes.reduce((sum, p) => sum + (p.value || 0), 0);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Handle custom percentage change
  const handlePercentageChange = (position: number, value: string) => {
    setCustomPercentages((prev) => ({ ...prev, [position]: value }));
    
    const percentage = parseFloat(value) || 0;
    setDistributions((prev) =>
      prev.map((d) => (d.position === position ? { ...d, percentage } : d))
    );
  };

  // Reset to defaults
  const resetToDefaults = () => {
    setDistributions(DEFAULT_DISTRIBUTION);
    setNonMonetaryPrizes(NON_MONETARY_DEFAULTS);
    setCustomPercentages({});
  };

  // Get position icon
  const getPositionIcon = (position: number) => {
    switch (position) {
      case 1:
        return <Trophy className="w-5 h-5 text-amber-400" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Award className="w-5 h-5 text-amber-600" />;
      default:
        return <Award className="w-5 h-5 text-muted-foreground" />;
    }
  };

  // Validate total percentage
  const totalPercentage = distributions.reduce((sum, d) => sum + d.percentage, 0);
  const isValidDistribution = Math.abs(totalPercentage - 100) < 0.01;

  return (
    <Card className="bg-gradient-card border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-teal-400" />
          Prize Calculator
        </CardTitle>
        <CardDescription>
          Calculate prize distributions with GST breakdowns
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="calculator" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="calculator">Calculator</TabsTrigger>
            <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
            <TabsTrigger value="non-monetary">Non-Monetary</TabsTrigger>
          </TabsList>

          <TabsContent value="calculator" className="space-y-6">
            {/* Prize Pool Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Total Prize Pool
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="Enter prize pool amount"
                  value={prizePool}
                  onChange={(e) => setPrizePool(parseInt(e.target.value) || 0)}
                  className="pl-10 text-lg font-medium"
                />
              </div>
            </div>

            {/* Distribution Percentages */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Distribution Percentages
                </label>
                <Button variant="outline" size="sm" onClick={resetToDefaults}>
                  Reset to Default
                </Button>
              </div>

              {distributions.map((dist) => (
                <div
                  key={dist.position}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2 w-24">
                    {getPositionIcon(dist.position)}
                    <span className="font-medium text-foreground">
                      #{dist.position}
                    </span>
                  </div>
                  <div className="flex-1">
                    <Input
                      type="number"
                      placeholder="%"
                      value={customPercentages[dist.position] ?? dist.percentage.toString()}
                      onChange={(e) =>
                        handlePercentageChange(dist.position, e.target.value)
                      }
                      className="w-24"
                      min={0}
                      max={100}
                      step={0.5}
                    />
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-foreground">
                      {formatCurrency(
                        Math.floor((prizePool * dist.percentage) / 100)
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">+ GST: {formatCurrency(
                      Math.floor((prizePool * dist.percentage * GST_RATE) / 100)
                    )}</p>
                  </div>
                </div>
              ))}

              {/* Validation */}
              <div
                className={`flex items-center gap-2 p-3 rounded-lg ${
                  isValidDistribution
                    ? "bg-emerald-500/10 border border-emerald-500/30"
                    : "bg-red-500/10 border border-red-500/30"
                }`}
              >
                <TrendingUp
                  className={`w-4 h-4 ${
                    isValidDistribution ? "text-emerald-400" : "text-red-400"
                  }`}
                />
                <span
                  className={`text-sm ${
                    isValidDistribution ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  Total: {totalPercentage.toFixed(1)}%
                  {isValidDistribution
                    ? " ✓ Valid distribution"
                    : " (must equal 100%)"}
                </span>
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">
                <p className="text-xs text-teal-400">Total Prize Money</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(totalPrizeMoney)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-xs text-purple-400">Total GST (18%)</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(totalGst)}
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="breakdown" className="space-y-6">
            {/* Detailed Breakdown Table */}
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3 text-left">Position</th>
                    <th className="p-3 text-right">Percentage</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3 text-right">GST (18%)</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedPrizes.map((prize) => (
                    <tr key={prize.position} className="border-t border-border/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {getPositionIcon(prize.position)}
                          <span className="font-medium">{prize.label}</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">{prize.percentage}%</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(prize.amount)}
                      </td>
                      <td className="p-3 text-right text-purple-400">
                        {formatCurrency(prize.gstAmount)}
                      </td>
                      <td className="p-3 text-right font-bold text-teal-400">
                        {formatCurrency(prize.totalWithGst)}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/50">
                    <td className="p-3 font-bold">Total</td>
                    <td className="p-3 text-right font-bold">{totalPercentage}%</td>
                    <td className="p-3 text-right font-bold">
                      {formatCurrency(totalPrizeMoney)}
                    </td>
                    <td className="p-3 text-right font-bold text-purple-400">
                      {formatCurrency(totalGst)}
                    </td>
                    <td className="p-3 text-right font-bold text-teal-400">
                      {formatCurrency(totalWithGst)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Pie Chart Placeholder */}
            <div className="p-6 rounded-lg bg-muted/50 flex items-center justify-center">
              <div className="text-center">
                <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Distribution Chart</p>
                <div className="flex justify-center gap-4 mt-4">
                  {calculatedPrizes.map((prize) => (
                    <div key={prize.position} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{
                          backgroundColor:
                            prize.position === 1
                              ? "#f59e0b"
                              : prize.position === 2
                              ? "#9ca3af"
                              : prize.position === 3
                              ? "#d97706"
                              : "#6b7280",
                        }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {prize.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="non-monetary" className="space-y-6">
            {/* Non-Monetary Prizes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-teal-400" />
                <h3 className="font-medium text-foreground">
                  Non-Monetary Prizes
                </h3>
              </div>

              {nonMonetaryPrizes.map((prize) => (
                <div
                  key={prize.position}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    {getPositionIcon(prize.position)}
                    <div>
                      <p className="font-medium text-foreground">
                        {prize.description}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        {prize.type}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">
                      Estimated Value
                    </p>
                    <p className="font-bold text-foreground">
                      {formatCurrency(prize.value || 0)}
                    </p>
                  </div>
                </div>
              ))}

              {/* Total Non-Monetary Value */}
              <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-teal-400">
                      Total Non-Monetary Value
                    </p>
                    <p className="text-xl font-bold text-foreground">
                      {formatCurrency(totalNonMonetaryValue)}
                    </p>
                  </div>
                  <Gift className="w-8 h-8 text-teal-400" />
                </div>
              </div>

              {/* Grand Total */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-teal-500/10 to-emerald-500/10 border border-teal-500/30">
                <p className="text-sm text-teal-400 mb-2">
                  Total Prize Package Value
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(totalWithGst + totalNonMonetaryValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Prize Money ({formatCurrency(totalWithGst)}) + Non-Monetary (
                  {formatCurrency(totalNonMonetaryValue)})
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
