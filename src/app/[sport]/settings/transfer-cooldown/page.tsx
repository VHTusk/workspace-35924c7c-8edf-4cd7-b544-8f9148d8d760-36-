"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TransferCooldown {
  id: string;
  orgId: string;
  orgName: string;
  transferredAt: string;
  cooldownEndsAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

export default function TransferCooldownPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  const [loading, setLoading] = useState(true);
  const [cooldowns, setCooldowns] = useState<TransferCooldown[]>([]);

  useEffect(() => {
    fetchCooldowns();
  }, []);

  const fetchCooldowns = async () => {
    try {
      const response = await fetch("/api/player/transfer-cooldowns");
      if (response.ok) {
        const data = await response.json();
        setCooldowns(data.cooldowns || []);
      }
    } catch (err) {
      console.error("Failed to fetch cooldowns:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const activeCooldowns = cooldowns.filter(c => !c.isExpired);

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        <Link
          href={`/${sport}/settings`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Transfer Cooldowns</h1>
        <p className="text-gray-500 mb-6">
          View your organization transfer cooldown periods
        </p>

        {activeCooldowns.length > 0 && (
          <Alert className="bg-amber-50 border-amber-200 text-amber-700 mb-6">
            <Clock className="w-4 h-4" />
            <AlertDescription>
              You have an active transfer cooldown. You cannot join another organization 
              until the cooldown expires.
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-white border-gray-100 shadow-sm mb-6">
          <CardHeader>
            <CardTitle>Active Cooldowns</CardTitle>
            <CardDescription>
              You must wait before transferring to a new organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeCooldowns.length === 0 ? (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-gray-600">No active cooldowns</p>
                <p className="text-sm text-gray-500">You're free to transfer organizations</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeCooldowns.map((cooldown) => (
                  <div
                    key={cooldown.id}
                    className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-amber-900">
                          {cooldown.orgName}
                        </span>
                      </div>
                      <Badge className="bg-amber-200 text-amber-800">
                        {cooldown.daysRemaining} days left
                      </Badge>
                    </div>
                    <div className="text-sm text-amber-700">
                      <p>Transferred: {new Date(cooldown.transferredAt).toLocaleDateString()}</p>
                      <p>Cooldown ends: {new Date(cooldown.cooldownEndsAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white border-gray-100 shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="text-sm">About Transfer Cooldowns</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• A 30-day cooldown applies after leaving an organization</p>
            <p>• Cooldowns prevent players from rapidly switching between orgs</p>
            <p>• Cooldown applies to the sport-specific organization membership</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
