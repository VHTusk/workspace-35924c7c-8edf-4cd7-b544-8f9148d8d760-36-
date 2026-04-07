"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift, Copy, Check, Users, Trophy, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReferralData {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewards: number;
  referralHistory: Array<{
    id: string;
    referredName: string;
    status: string;
    reward: number;
    createdAt: string;
  }>;
}

export default function DashboardReferralsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-950/30" : "bg-teal-50 dark:bg-teal-950/30";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchReferralData();
  }, [sport]);

  const fetchReferralData = async () => {
    try {
      const response = await fetch("/api/referrals", {
        credentials: "include",
      });
      
      if (response.ok) {
        const resData = await response.json();
        setData(resData);
      }
    } catch (err) {
      console.error("Failed to fetch referral data:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyReferralCode = () => {
    if (data?.referralCode) {
      navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyReferralLink = () => {
    const link = `${window.location.origin}/${sport}/register?ref=${data?.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-muted-foreground">Invite friends and earn rewards</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.totalReferrals || 0}</p><p className="text-sm text-muted-foreground">Total Referrals</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.successfulReferrals || 0}</p><p className="text-sm text-muted-foreground">Successful</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{data?.pendingReferrals || 0}</p><p className="text-sm text-muted-foreground">Pending</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">₹{data?.totalRewards || 0}</p><p className="text-sm text-muted-foreground">Total Rewards</p></CardContent></Card>
      </div>

      {/* Referral Code Card */}
      <Card className={cn(primaryBgClass, "border")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className={cn("w-5 h-5", primaryTextClass)} />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input value={data?.referralCode || ""} readOnly className="text-lg font-mono" />
            <Button onClick={copyReferralCode} variant="outline" size="icon">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={`${window.location.origin}/${sport}/register?ref=${data?.referralCode || ""}`}
              readOnly
              className="text-sm"
            />
            <Button onClick={copyReferralLink} variant="outline" size="icon">
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Share this code with friends. When they register and play their first tournament, you both get rewards!
          </p>
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Users className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">1. Share Code</h4>
              <p className="text-sm text-muted-foreground">Share your unique referral code with friends</p>
            </div>
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Trophy className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">2. They Play</h4>
              <p className="text-sm text-muted-foreground">Friends register and play their first tournament</p>
            </div>
            <div className="text-center p-4">
              <div className={cn("w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center", primaryBgClass)}>
                <Gift className={cn("w-6 h-6", primaryTextClass)} />
              </div>
              <h4 className="font-semibold mb-1">3. Get Rewards</h4>
              <p className="text-sm text-muted-foreground">Both of you earn reward points</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      <Card>
        <CardHeader>
          <CardTitle>Referral History</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.referralHistory || data.referralHistory.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No referrals yet. Start sharing your code!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referralHistory.map((referral) => (
                <div key={referral.id} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Users className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{referral.referredName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(referral.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={
                      referral.status === "COMPLETED" ? "bg-green-100 text-green-700" :
                      referral.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                      "bg-muted text-muted-foreground"
                    }>
                      {referral.status}
                    </Badge>
                    {referral.reward > 0 && (
                      <span className="font-semibold text-green-600">+₹{referral.reward}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
