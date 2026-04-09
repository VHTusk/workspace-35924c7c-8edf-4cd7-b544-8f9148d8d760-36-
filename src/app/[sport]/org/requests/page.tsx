"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar,
  MapPin,
  Users,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface TournamentRequest {
  id: string;
  tournamentName: string;
  tournamentType: string;
  scope: string;
  requestedDate: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CHANGES_REQUESTED";
  startDate: string;
  endDate: string;
  location: string;
  city: string;
  state: string;
  expectedPlayers: number;
  entryFee: number;
  adminNotes?: string;
}

export default function OrgRequestsPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [requests, setRequests] = useState<TournamentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, [sport]);

  const fetchRequests = async () => {
    try {
      const response = await fetch("/api/org/tournaments", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
      }
    } catch (error) {
      console.error("Failed to fetch requests:", error);
    } finally {
      setRequests([
        {
          id: "1",
          tournamentName: "Annual Club Championship 2025",
          tournamentType: "INTRA_ORG",
          scope: "CITY",
          requestedDate: "2025-02-15",
          status: "PENDING",
          startDate: "2025-03-20",
          endDate: "2025-03-21",
          location: "Club Sports Complex",
          city: "Mumbai",
          state: "Maharashtra",
          expectedPlayers: 32,
          entryFee: 500,
        },
        {
          id: "2",
          tournamentName: "Inter-Department Tournament",
          tournamentType: "INTRA_ORG",
          scope: "CITY",
          requestedDate: "2025-02-10",
          status: "APPROVED",
          startDate: "2025-03-05",
          endDate: "2025-03-05",
          location: "Corporate Campus",
          city: "Pune",
          state: "Maharashtra",
          expectedPlayers: 24,
          entryFee: 300,
        },
        {
          id: "3",
          tournamentName: "Winter League Finals",
          tournamentType: "INTRA_ORG",
          scope: "DISTRICT",
          requestedDate: "2025-01-20",
          status: "REJECTED",
          startDate: "2025-02-15",
          endDate: "2025-02-16",
          location: "District Sports Center",
          city: "Nagpur",
          state: "Maharashtra",
          expectedPlayers: 48,
          entryFee: 400,
          adminNotes: "Venue not available on requested dates.",
        },
        {
          id: "4",
          tournamentName: "Monthly Club Tournament",
          tournamentType: "INTRA_ORG",
          scope: "CITY",
          requestedDate: "2025-01-25",
          status: "CHANGES_REQUESTED",
          startDate: "2025-02-28",
          endDate: "2025-02-28",
          location: "Club Ground",
          city: "Mumbai",
          state: "Maharashtra",
          expectedPlayers: 16,
          entryFee: 200,
          adminNotes: "Please provide more details about prize distribution.",
        },
      ]);
      setLoading(false);
    }
  };

  const primaryClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING": return <Clock className="w-4 h-4" />;
      case "APPROVED": return <CheckCircle className="w-4 h-4" />;
      case "REJECTED": return <XCircle className="w-4 h-4" />;
      case "CHANGES_REQUESTED": return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-amber-100 text-amber-800";
      case "APPROVED": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      case "CHANGES_REQUESTED": return "bg-blue-100 text-blue-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const pendingRequests = requests.filter((r) => r.status === "PENDING" || r.status === "CHANGES_REQUESTED");
  const approvedRequests = requests.filter((r) => r.status === "APPROVED");
  const rejectedRequests = requests.filter((r) => r.status === "REJECTED");

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Requests</h1>
          <p className="text-muted-foreground">Track your tournament approval requests</p>
        </div>
        <Link href={`/${sport}/org/request-tournament`}>
          <Button className={cn("text-white", primaryClass)}>
            <Plus className="w-4 h-4 mr-2" />New Request
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-100"><FileText className="w-5 h-5 text-blue-600" /></div><div><p className="text-2xl font-bold">{requests.length}</p><p className="text-sm text-muted-foreground">Total Requests</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-100"><Clock className="w-5 h-5 text-amber-600" /></div><div><p className="text-2xl font-bold">{pendingRequests.length}</p><p className="text-sm text-muted-foreground">Pending</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-green-100"><CheckCircle className="w-5 h-5 text-green-600" /></div><div><p className="text-2xl font-bold">{approvedRequests.length}</p><p className="text-sm text-muted-foreground">Approved</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-red-100"><XCircle className="w-5 h-5 text-red-600" /></div><div><p className="text-2xl font-bold">{rejectedRequests.length}</p><p className="text-sm text-muted-foreground">Rejected</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">Pending ({pendingRequests.length})</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {pendingRequests.length > 0 ? pendingRequests.map((r) => (
            <Card key={r.id}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{r.tournamentName}</h3>
                    <Badge className={getStatusColor(r.status)}>{getStatusIcon(r.status)} {r.status.replace(/_/g, " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(r.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{r.city}</span>
                    <span className="flex items-center gap-1"><Users className="w-4 h-4" />{r.expectedPlayers} players</span>
                  </div>
                  {r.adminNotes && <div className="mt-2 p-2 bg-blue-50 rounded text-sm text-blue-800"><strong>Admin Notes:</strong> {r.adminNotes}</div>}
                </div>
                <div className="flex flex-col gap-2"><Badge variant="outline">{r.scope}</Badge><Button size="sm" variant="outline">Edit</Button></div>
              </div>
            </CardContent></Card>
          )) : <div className="text-center py-12"><AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No pending requests</p></div>}
        </TabsContent>

        <TabsContent value="approved" className="mt-4 space-y-4">
          {approvedRequests.length > 0 ? approvedRequests.map((r) => (
            <Card key={r.id}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{r.tournamentName}</h3>
                    <Badge className={getStatusColor(r.status)}>{getStatusIcon(r.status)} Approved</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(r.startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{r.city}</span>
                  </div>
                </div>
                <Badge variant="outline">{r.scope}</Badge>
              </div>
            </CardContent></Card>
          )) : <div className="text-center py-12"><p className="text-muted-foreground">No approved requests yet</p></div>}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4 space-y-4">
          {rejectedRequests.length > 0 ? rejectedRequests.map((r) => (
            <Card key={r.id}><CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{r.tournamentName}</h3>
                    <Badge className={getStatusColor(r.status)}>{getStatusIcon(r.status)} Rejected</Badge>
                  </div>
                  {r.adminNotes && <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-800"><strong>Reason:</strong> {r.adminNotes}</div>}
                </div>
              </div>
            </CardContent></Card>
          )) : <div className="text-center py-12"><p className="text-muted-foreground">No rejected requests</p></div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
