"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CheckCircle, XCircle, Clock, Users, Loader2, QrCode, Share2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckinData {
  tournament: {
    id: string;
    name: string;
    status: string;
    startDate: string;
  };
  stats: {
    total: number;
    checkedIn: number;
    notCheckedIn: number;
  };
  checkedInPlayers: Array<{
    id: string;
    userId: string;
    name: string;
    checkedInAt: string;
    method: string;
  }>;
  notCheckedInPlayers: Array<{
    userId: string;
    name: string;
  }>;
  userCheckin: {
    checkedIn: boolean;
    checkedInAt?: string;
  };
}

interface TournamentCheckinProps {
  tournamentId: string;
  sport: string;
  userId?: string;
  isAdmin?: boolean;
}

export function TournamentCheckin({ tournamentId, sport, userId, isAdmin }: TournamentCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [data, setData] = useState<CheckinData | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchCheckinData = async () => {
    try {
      const url = userId 
        ? `/api/tournaments/${tournamentId}/checkin?userId=${userId}`
        : `/api/tournaments/${tournamentId}/checkin`;
      const response = await fetch(url);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      }
    } catch (error) {
      console.error("Fetch checkin error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckin = async () => {
    if (!userId) return;
    
    setCheckinLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        await fetchCheckinData();
      }
    } catch (error) {
      console.error("Checkin error:", error);
    } finally {
      setCheckinLoading(false);
    }
  };

  const handleCancelCheckin = async () => {
    if (!userId) return;
    
    setCheckinLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/checkin?userId=${userId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        await fetchCheckinData();
      }
    } catch (error) {
      console.error("Cancel checkin error:", error);
    } finally {
      setCheckinLoading(false);
    }
  };

  const fetchQrCode = async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/qr`);
      if (response.ok) {
        const result = await response.json();
        setQrUrl(result.qrCodeUrl);
      }
    } catch (error) {
      console.error("QR fetch error:", error);
    }
  };

  useEffect(() => {
    fetchCheckinData();
  }, [tournamentId]);

  useEffect(() => {
    if (showQr && !qrUrl) {
      fetchQrCode();
    }
  }, [showQr, qrUrl]);

  if (loading) {
    return (
      <Card className="bg-white border-gray-100 shadow-sm">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const checkinProgress = data.stats.total > 0 
    ? Math.round((data.stats.checkedIn / data.stats.total) * 100)
    : 0;

  return (
    <Card className="bg-white border-gray-100 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            Pre-Tournament Check-in
          </CardTitle>
          <div className="flex gap-2">
            {/* QR Code Dialog */}
            <Dialog open={showQr} onOpenChange={setShowQr}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <QrCode className="w-4 h-4 mr-1" />
                  QR
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Scan to Register</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center gap-4">
                  {qrUrl ? (
                    <img src={qrUrl} alt="Tournament QR Code" className="rounded-lg" />
                  ) : (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  )}
                  <p className="text-sm text-gray-500 text-center">
                    Scan this QR code to quickly access the tournament registration page
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">{data.stats.total}</p>
            <p className="text-xs text-gray-500">Registered</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{data.stats.checkedIn}</p>
            <p className="text-xs text-gray-500">Checked In</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{data.stats.notCheckedIn}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Check-in Progress</span>
            <span>{checkinProgress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${checkinProgress}%` }}
            />
          </div>
        </div>

        {/* User Check-in Button */}
        {userId && !isAdmin && (
          <div className="pt-2">
            {data.userCheckin.checkedIn ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-emerald-700">You're checked in!</p>
                    {data.userCheckin.checkedInAt && (
                      <p className="text-xs text-emerald-600">
                        {new Date(data.userCheckin.checkedInAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={handleCancelCheckin}
                  disabled={checkinLoading}
                >
                  Undo
                </Button>
              </div>
            ) : (
              <Button
                className={cn("w-full", primaryBtnClass)}
                onClick={handleCheckin}
                disabled={checkinLoading}
              >
                {checkinLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Check In Now
              </Button>
            )}
          </div>
        )}

        {/* Admin View - Player Lists */}
        {isAdmin && (
          <div className="space-y-3 pt-2">
            {/* Not Checked In */}
            {data.notCheckedInPlayers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Not Checked In ({data.notCheckedInPlayers.length})
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {data.notCheckedInPlayers.map((p) => (
                    <div key={p.userId} className="flex items-center gap-2 p-2 rounded bg-orange-50 text-sm">
                      <XCircle className="w-4 h-4 text-orange-400" />
                      <span className="text-gray-700">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checked In */}
            {data.checkedInPlayers.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  Checked In ({data.checkedInPlayers.length})
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {data.checkedInPlayers.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 p-2 rounded bg-emerald-50 text-sm">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      <span className="text-gray-700">{p.name}</span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(p.checkedInAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
