"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PrizeDistributionForm } from "@/components/prizes/PrizeDistributionForm";
import { PayoutTable } from "@/components/prizes/PayoutTable";
import {
  ArrowLeft,
  Trophy,
  Calendar,
  MapPin,
  Users,
  IndianRupee,
  Loader2,
  Download,
  FileText,
  Gift,
  AlertCircle,
  CheckCircle,
} from "lucide-react";

interface TournamentInfo {
  id: string;
  name: string;
  sport: string;
  type: string;
  status: string;
  prizePool: number;
  startDate: string;
  endDate: string;
  location: string;
  registrationsCount: number;
}

interface PrizeEntry {
  position: number;
  userId: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
  };
  rank: number;
  bonusPoints: number;
  percentage: number;
  amount: number;
  isPaid: boolean;
  payout: {
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    paidAt: string;
    markedBy: {
      id: string;
      firstName: string;
      lastName: string;
    };
  } | null;
}

interface NonMonetaryPrize {
  position: number;
  type: string;
  description: string;
  awarded: boolean;
}

interface PrizeStats {
  totalPaidOut: number;
  pendingPayout: number;
  paidCount: number;
  pendingCount: number;
  totalWinners: number;
}

interface Distribution {
  position: number;
  percentage: number;
  label: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  REGISTRATION_OPEN: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  REGISTRATION_CLOSED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  BRACKET_GENERATED: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  IN_PROGRESS: "bg-green-500/10 text-green-400 border-green-500/30",
  COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  CANCELLED: "bg-red-500/10 text-red-400 border-red-500/30",
};

export default function TournamentPrizeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const tournamentId = params.tournamentId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [tournament, setTournament] = useState<TournamentInfo | null>(null);
  const [distribution, setDistribution] = useState<Distribution[]>([]);
  const [prizeCalculation, setPrizeCalculation] = useState<PrizeEntry[]>([]);
  const [nonMonetaryPrizes, setNonMonetaryPrizes] = useState<NonMonetaryPrize[]>([]);
  const [stats, setStats] = useState<PrizeStats | null>(null);
  const [adminId, setAdminId] = useState<string>("");

  useEffect(() => {
    checkAuth();
    fetchPrizeDetails();
  }, [tournamentId]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) {
        router.push(`/${sport}/admin/login`);
        return;
      }
      const data = await response.json();
      setAdminId(data.admin?.id || "");
    } catch {
      router.push(`/${sport}/admin/login`);
    }
  };

  const fetchPrizeDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/prizes/${tournamentId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch prize details");
      }

      const data = await response.json();
      setTournament(data.data?.tournament);
      setDistribution(data.data?.distribution || []);
      setPrizeCalculation(data.data?.prizeCalculation || []);
      setNonMonetaryPrizes(data.data?.nonMonetaryPrizes || []);
      setStats(data.data?.stats);
    } catch (err) {
      setError("Failed to load prize details");
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  // Handle save distribution
  const handleSaveDistribution = async (newDistributions: Distribution[]) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/prizes/${tournamentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distributions: newDistributions }),
      });

      if (!response.ok) throw new Error("Failed to save distribution");

      setDistribution(newDistributions);
      setSuccess("Distribution saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to save distribution");
    } finally {
      setSaving(false);
    }
  };

  // Handle mark payout as paid
  const handleMarkPaid = async (
    userId: string,
    amount: number,
    method: string,
    reference: string
  ) => {
    const response = await fetch(`/api/admin/prizes/${tournamentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markPayout: true,
        payoutUserId: userId,
        amount,
        method,
        reference,
        adminId,
      }),
    });

    if (!response.ok) throw new Error("Failed to mark payout");
    await fetchPrizeDetails();
  };

  // Handle update reference
  const handleUpdateReference = async (payoutId: string, reference: string) => {
    const response = await fetch(`/api/admin/prizes/${tournamentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId, reference }),
    });

    if (!response.ok) throw new Error("Failed to update reference");
    await fetchPrizeDetails();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!tournament || prizeCalculation.length === 0) return;

    const headers = [
      "Position",
      "Player Name",
      "City",
      "State",
      "Prize Amount",
      "GST (18%)",
      "Total",
      "Payment Status",
      "Payment Method",
      "Transaction Reference",
      "Paid At",
    ];

    const rows = prizeCalculation.map((entry) => {
      const gst = Math.floor(entry.amount * 0.18);
      return [
        entry.position,
        `${entry.user.firstName} ${entry.user.lastName}`,
        entry.user.city || "",
        entry.user.state || "",
        entry.amount,
        gst,
        entry.amount + gst,
        entry.isPaid ? "Paid" : "Pending",
        entry.payout?.method || "",
        entry.payout?.reference || "",
        entry.payout?.paidAt ? formatDate(entry.payout.paidAt) : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payout_summary_${tournament.name.replace(/\s+/g, "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Generate GST Invoice (placeholder)
  const handleGenerateInvoice = (userId: string) => {
    // In a real implementation, this would generate a PDF invoice
    const entry = prizeCalculation.find((p) => p.userId === userId);
    if (entry) {
      alert(
        `GST Invoice for ${entry.user.firstName} ${entry.user.lastName}\nAmount: ${formatCurrency(entry.amount)}\nGST (18%): ${formatCurrency(Math.floor(entry.amount * 0.18))}\nTotal: ${formatCurrency(Math.floor(entry.amount * 1.18))}`
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
          <h2 className="text-xl font-bold text-foreground">Tournament Not Found</h2>
          <p className="text-muted-foreground mt-2">
            The tournament you&apos;re looking for doesn&apos;t exist.
          </p>
          <Link href={`/${sport}/admin/prizes`}>
            <Button className="mt-4">Back to Prize Management</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        {/* Back Button */}
        <Link
          href={`/${sport}/admin/prizes`}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Prize Management
        </Link>

        {/* Error/Success Messages */}
        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-lg mb-6">
            {success}
          </div>
        )}

        {/* Tournament Header */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {tournament.name}
                  </h1>
                  <Badge
                    className={
                      STATUS_COLORS[tournament.status] || "bg-muted text-muted-foreground"
                    }
                  >
                    {tournament.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {tournament.location}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {tournament.registrationsCount} players
                  </span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Prize Pool</p>
                <p className="text-3xl font-bold text-foreground">
                  {formatCurrency(tournament.prizePool)}
                </p>
              </div>
            </div>

            {/* Quick Stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Winners</p>
                  <p className="text-xl font-bold text-foreground">
                    {stats.totalWinners}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Paid Payouts</p>
                  <p className="text-xl font-bold text-emerald-400">
                    {stats.paidCount}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Pending Payouts</p>
                  <p className="text-xl font-bold text-amber-400">
                    {stats.pendingCount}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total Paid Out</p>
                  <p className="text-xl font-bold text-foreground">
                    {formatCurrency(stats.totalPaidOut)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs defaultValue="payouts" className="space-y-6">
          <TabsList>
            <TabsTrigger value="payouts" className="gap-2">
              <IndianRupee className="w-4 h-4" />
              Payouts
            </TabsTrigger>
            <TabsTrigger value="distribution" className="gap-2">
              <Trophy className="w-4 h-4" />
              Distribution
            </TabsTrigger>
            <TabsTrigger value="non-monetary" className="gap-2">
              <Gift className="w-4 h-4" />
              Non-Monetary
            </TabsTrigger>
          </TabsList>

          <TabsContent value="payouts">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prize Payouts</CardTitle>
                  <CardDescription>
                    Manage and track prize payouts to winners
                  </CardDescription>
                </div>
                <Button onClick={handleExportCSV} variant="outline" className="gap-2">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <PayoutTable
                  payouts={prizeCalculation}
                  prizePool={tournament.prizePool}
                  onMarkPaid={handleMarkPaid}
                  onUpdateReference={handleUpdateReference}
                  onExportCSV={handleExportCSV}
                  onGenerateInvoice={handleGenerateInvoice}
                  disabled={tournament.status !== "COMPLETED"}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="distribution">
            <PrizeDistributionForm
              prizePool={tournament.prizePool}
              initialDistributions={distribution}
              onSave={handleSaveDistribution}
              disabled={tournament.status === "COMPLETED"}
            />
          </TabsContent>

          <TabsContent value="non-monetary">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-teal-400" />
                  Non-Monetary Prizes
                </CardTitle>
                <CardDescription>
                  Trophies, medals, and other non-cash prizes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {nonMonetaryPrizes.map((prize) => (
                    <div
                      key={prize.position}
                      className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border/50"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-teal-500/10 flex items-center justify-center">
                          <Trophy className="w-5 h-5 text-teal-400" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            Position #{prize.position}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {prize.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{prize.type}</Badge>
                        {prize.awarded ? (
                          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Awarded
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                            Pending
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Summary */}
                  <Separator className="my-4" />
                  <div className="p-4 rounded-lg bg-teal-500/10 border border-teal-500/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-teal-400">Total Non-Monetary Prizes</p>
                        <p className="text-lg font-bold text-foreground">
                          {nonMonetaryPrizes.length} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-teal-400">Awarded</p>
                        <p className="text-lg font-bold text-foreground">
                          {nonMonetaryPrizes.filter((p) => p.awarded).length} /{" "}
                          {nonMonetaryPrizes.length}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* GST Invoice Section */}
        <Card className="bg-gradient-card border-border/50 mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" />
              GST Invoice Generation
            </CardTitle>
            <CardDescription>
              Generate GST-compliant invoices for prize payments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                <p className="text-xs text-purple-400">Total GST Collected</p>
                <p className="text-xl font-bold text-foreground">
                  {formatCurrency(Math.floor((stats?.totalPaidOut ?? 0) * 0.18))}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground">GST Rate</p>
                <p className="text-xl font-bold text-foreground">18%</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    prizeCalculation
                      .filter((p) => p.isPaid)
                      .forEach((p) => handleGenerateInvoice(p.userId));
                  }}
                  disabled={stats?.paidCount === 0}
                >
                  Generate All Invoices
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
