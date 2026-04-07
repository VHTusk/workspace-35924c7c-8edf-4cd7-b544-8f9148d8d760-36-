"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Dispute {
  id: string;
  matchId: string;
  reason: string;
  status: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
  match: {
    opponent: {
      firstName: string;
      lastName: string;
    };
    tournament: {
      name: string;
    } | null;
    scoreA: number;
    scoreB: number;
  };
}

const statusColors: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-700 border-amber-200",
  REVIEWING: "bg-blue-100 text-blue-700 border-blue-200",
  RESOLVED: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  OPEN: <AlertCircle className="w-4 h-4" />,
  REVIEWING: <Clock className="w-4 h-4" />,
  RESOLVED: <CheckCircle className="w-4 h-4" />,
};

export default function MyDisputesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState<Dispute[]>([]);

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const response = await fetch("/api/disputes");
      if (response.ok) {
        const data = await response.json();
        setDisputes(data.disputes || []);
      }
    } catch (err) {
      console.error("Failed to fetch disputes:", err);
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

  const openDisputes = disputes.filter(d => d.status !== "RESOLVED");
  const resolvedDisputes = disputes.filter(d => d.status === "RESOLVED");

  const renderDisputeList = (disputeList: Dispute[]) => {
    if (disputeList.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No disputes</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {disputeList.map((dispute) => (
          <Card key={dispute.id} className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">
                    vs {dispute.match.opponent.firstName} {dispute.match.opponent.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {dispute.match.tournament?.name || "Friendly Match"}
                  </p>
                </div>
                <Badge className={statusColors[dispute.status]}>
                  <span className="flex items-center gap-1">
                    {statusIcons[dispute.status]}
                    {dispute.status}
                  </span>
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                <span>Score: {dispute.match.scoreA} - {dispute.match.scoreB}</span>
                <span>•</span>
                <span>{new Date(dispute.createdAt).toLocaleDateString()}</span>
              </div>

              <div className="bg-gray-50 rounded p-3 mb-3">
                <p className="text-sm text-gray-600">
                  <strong>Reason:</strong> {dispute.reason}
                </p>
              </div>

              {dispute.status === "RESOLVED" && dispute.resolution && (
                <div className={cn(
                  "rounded p-3 mb-3",
                  dispute.resolution === "UPHELD" 
                    ? "bg-emerald-50 text-emerald-700" 
                    : "bg-gray-50 text-gray-600"
                )}>
                  <p className="text-sm">
                    <strong>Resolution:</strong> {dispute.resolution}
                    {dispute.resolvedAt && (
                      <span className="text-xs ml-2">
                        on {new Date(dispute.resolvedAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                </div>
              )}

              {dispute.status === "REVIEWING" && (
                <p className="text-xs text-blue-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Under review by tournament officials
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-50 min-h-screen py-8 px-4">
      <div className="container mx-auto max-w-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Disputes</h1>
            <p className="text-gray-500">Track and manage your match disputes</p>
          </div>
          <Link href={`/${sport}/disputes/new`}>
            <Button className={primaryBtnClass}>
              <Plus className="w-4 h-4 mr-2" />
              New Dispute
            </Button>
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{openDisputes.length}</p>
              <p className="text-xs text-gray-500">Open</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {resolvedDisputes.filter(d => d.resolution === "UPHELD").length}
              </p>
              <p className="text-xs text-gray-500">Upheld</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{resolvedDisputes.length}</p>
              <p className="text-xs text-gray-500">Resolved</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="open" className="space-y-4">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="open">
              Open ({openDisputes.length})
            </TabsTrigger>
            <TabsTrigger value="resolved">
              Resolved ({resolvedDisputes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            {renderDisputeList(openDisputes)}
          </TabsContent>

          <TabsContent value="resolved">
            {renderDisputeList(resolvedDisputes)}
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="bg-white border-gray-100 shadow-sm mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Dispute Policy</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 space-y-2">
            <p>• Disputes must be submitted within 2 hours of match completion</p>
            <p>• Tournament officials will review and respond within 24 hours</p>
            <p>• If upheld, match result will be corrected and points recalculated</p>
            <p>• False disputes may result in penalties</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
