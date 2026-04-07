"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Sidebar from "@/components/layout/sidebar";
import { OrgSubscriptionCard } from "@/components/org-subscription-card";
import {
  CreditCard,
  Download,
  Calendar,
  AlertCircle,
  Loader2,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
  TrendingUp,
  Wallet,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Payment {
  id: string;
  date: string;
  amount: number;
  type: string;
  status: string;
  method: string;
  invoice: string;
  description: string;
  razorpayId?: string;
}

interface SubscriptionData {
  plan: string;
  status: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  amount: number;
  daysRemaining?: number;
  trialEndsAt?: string;
}

interface PaymentData {
  subscription: SubscriptionData | null;
  payments: Payment[];
  summary: {
    totalPayments: number;
    totalSpent: number;
    pendingPayments: number;
    lastPayment: { date: string; amount: number } | null;
  };
  organization: {
    id: string;
    name: string;
    planTier: string;
  };
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  SUBSCRIPTION: "Subscription",
  TOURNAMENT_ENTRY: "Tournament Entry",
  UPGRADE: "Plan Upgrade",
  RENEWAL: "Renewal",
};

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: typeof CheckCircle }> = {
  PAID: { bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle },
  INITIATED: { bg: "bg-amber-100", text: "text-amber-700", icon: Clock },
  FAILED: { bg: "bg-red-100", text: "text-red-700", icon: XCircle },
  REFUNDED: { bg: "bg-gray-100", text: "text-gray-600", icon: ArrowUpRight },
};

export default function OrgPaymentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPayments();
  }, [sport]);

  const fetchPayments = async () => {
    try {
      const response = await fetch("/api/org/payments");
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        setError("Failed to load payment history");
      }
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      setError("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = () => {
    router.push(`/${sport}/org/subscription?upgrade=true`);
  };

  const handleRenew = () => {
    router.push(`/${sport}/org/subscription?renew=true`);
  };

  const downloadInvoice = (payment: Payment) => {
    // In a real app, this would generate and download a PDF
    // For now, we'll just show an alert
    alert(`Invoice ${payment.invoice} would be downloaded as PDF`);
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const style = STATUS_STYLES[status] || STATUS_STYLES.INITIATED;
    const Icon = style.icon;
    return (
      <Badge className={cn("gap-1", style.bg, style.text)}>
        <Icon className="w-3 h-3" />
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Payment History</h1>
            <p className="text-gray-500">View your subscription and payment history</p>
          </div>

          {/* Alert */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Subscription Card */}
            <div className="lg:col-span-1">
              {data?.subscription && (
                <OrgSubscriptionCard
                  subscription={data.subscription}
                  sport={sport}
                  onUpgrade={handleUpgrade}
                  onRenew={handleRenew}
                />
              )}
            </div>

            {/* Right Column - Payment History */}
            <div className="lg:col-span-2 space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {data?.summary.totalPayments || 0}
                        </p>
                        <p className="text-xs text-gray-500">Total Payments</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <Wallet className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(data?.summary.totalSpent || 0)}
                        </p>
                        <p className="text-xs text-gray-500">Total Spent</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {data?.summary.pendingPayments || 0}
                        </p>
                        <p className="text-xs text-gray-500">Pending</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Payment History Table */}
              <Card className="bg-white border-gray-100 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Payment History
                  </CardTitle>
                  <CardDescription>
                    All your subscription and tournament payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {data?.payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <CreditCard className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No payments yet</p>
                      <p className="text-sm">Your payment history will appear here</p>
                    </div>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      {/* Table Header */}
                      <div className="hidden sm:grid grid-cols-6 gap-4 p-3 bg-gray-50 text-sm font-medium text-gray-500">
                        <div className="col-span-2">Date / Invoice</div>
                        <div>Type</div>
                        <div>Amount</div>
                        <div>Status</div>
                        <div>Invoice</div>
                      </div>

                      {/* Table Body */}
                      <div className="divide-y">
                        {data?.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="grid grid-cols-1 sm:grid-cols-6 gap-2 sm:gap-4 p-3 hover:bg-gray-50 items-center"
                          >
                            <div className="col-span-2">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center sm:hidden">
                                  <Calendar className="w-4 h-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {formatDate(payment.date)}
                                  </p>
                                  <p className="text-xs text-gray-500">{payment.invoice}</p>
                                </div>
                              </div>
                            </div>
                            <div>
                              <Badge variant="outline" className="text-xs">
                                {PAYMENT_TYPE_LABELS[payment.type] || payment.type}
                              </Badge>
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {formatCurrency(payment.amount)}
                              </p>
                              <p className="text-xs text-gray-500">{payment.method}</p>
                            </div>
                            <div>{getStatusBadge(payment.status)}</div>
                            <div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => downloadInvoice(payment)}
                                className="gap-1"
                              >
                                <Download className="w-4 h-4" />
                                <span className="hidden sm:inline">Download</span>
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Last Payment Info */}
              {data?.summary.lastPayment && (
                <Card className="bg-white border-gray-100 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">Last Payment</p>
                        <p className="font-medium text-gray-900">
                          {formatCurrency(data.summary.lastPayment.amount)} on{" "}
                          {formatDate(data.summary.lastPayment.date)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
