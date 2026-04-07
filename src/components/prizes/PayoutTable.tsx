"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle,
  Clock,
  IndianRupee,
  MoreHorizontal,
  FileText,
  Download,
  Eye,
  CreditCard,
  Wallet,
  Building2,
  Receipt,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface PayoutEntry {
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

interface PayoutTableProps {
  payouts: PayoutEntry[];
  prizePool: number;
  onMarkPaid: (userId: string, amount: number, method: string, reference: string) => Promise<void>;
  onUpdateReference: (payoutId: string, reference: string) => Promise<void>;
  onExportCSV: () => void;
  onGenerateInvoice: (userId: string) => void;
  disabled?: boolean;
}

const PAYMENT_METHODS = [
  { value: "BANK_TRANSFER", label: "Bank Transfer", icon: Building2 },
  { value: "UPI", label: "UPI", icon: Wallet },
  { value: "CHEQUE", label: "Cheque", icon: Receipt },
  { value: "CASH", label: "Cash", icon: IndianRupee },
  { value: "CREDIT_CARD", label: "Credit Card", icon: CreditCard },
];

const POSITION_ICONS: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

export function PayoutTable({
  payouts,
  prizePool,
  onMarkPaid,
  onUpdateReference,
  onExportCSV,
  onGenerateInvoice,
  disabled = false,
}: PayoutTableProps) {
  const [markPaidDialog, setMarkPaidDialog] = useState<{
    open: boolean;
    entry: PayoutEntry | null;
  }>({ open: false, entry: null });
  const [referenceDialog, setReferenceDialog] = useState<{
    open: boolean;
    payoutId: string;
    reference: string;
  }>({ open: false, payoutId: "", reference: "" });
  const [method, setMethod] = useState<string>("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);

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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Handle mark paid
  const handleMarkPaid = async () => {
    if (!markPaidDialog.entry) return;
    setLoading(true);
    try {
      await onMarkPaid(markPaidDialog.entry.userId, markPaidDialog.entry.amount, method, reference);
      setMarkPaidDialog({ open: false, entry: null });
      setReference("");
    } catch (error) {
      console.error("Failed to mark paid:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle update reference
  const handleUpdateReference = async () => {
    setLoading(true);
    try {
      await onUpdateReference(referenceDialog.payoutId, referenceDialog.reference);
      setReferenceDialog({ open: false, payoutId: "", reference: "" });
    } catch (error) {
      console.error("Failed to update reference:", error);
    } finally {
      setLoading(false);
    }
  };

  // Stats
  const paidCount = payouts.filter((p) => p.isPaid).length;
  const pendingCount = payouts.filter((p) => !p.isPaid && p.amount > 0).length;
  const totalPaid = payouts.reduce((sum, p) => sum + (p.payout?.amount || 0), 0);
  const totalPending = payouts.reduce(
    (sum, p) => sum + (!p.isPaid ? p.amount : 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs text-muted-foreground">Total Prize Pool</p>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(prizePool)}
          </p>
        </div>
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <p className="text-xs text-emerald-400">Paid</p>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-muted-foreground">{paidCount} payouts</p>
        </div>
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-amber-400">Pending</p>
          </div>
          <p className="text-xl font-bold text-foreground">
            {formatCurrency(totalPending)}
          </p>
          <p className="text-xs text-muted-foreground">{pendingCount} payouts</p>
        </div>
        <div className="p-4 rounded-lg bg-muted/50 border border-border/50 flex items-end justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportCSV}
            className="gap-2 w-full"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16">Pos</TableHead>
              <TableHead>Winner</TableHead>
              <TableHead className="text-right">Prize Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Payment Details</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payouts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <div className="text-muted-foreground">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                    <p>No winners recorded yet</p>
                    <p className="text-sm">
                      Complete the tournament to record prize winners
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              payouts.map((entry) => (
                <TableRow key={entry.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {POSITION_ICONS[entry.position] || (
                        <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {entry.position}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.user.firstName} {entry.user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.user.city && entry.user.state
                          ? `${entry.user.city}, ${entry.user.state}`
                          : entry.user.email || entry.user.phone || ""}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p className="font-bold text-foreground">
                      {formatCurrency(entry.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.percentage}% of pool
                    </p>
                  </TableCell>
                  <TableCell className="text-center">
                    {entry.isPaid ? (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Paid
                      </Badge>
                    ) : entry.amount > 0 ? (
                      <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No Prize
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {entry.payout ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {PAYMENT_METHODS.find((m) => m.value === entry.payout?.method)
                              ?.label || entry.payout.method}
                          </Badge>
                          {entry.payout.reference && (
                            <span className="text-xs text-muted-foreground">
                              Ref: {entry.payout.reference}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          by {entry.payout.markedBy.firstName}{" "}
                          {entry.payout.markedBy.lastName} •{" "}
                          {formatDate(entry.payout.paidAt)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={disabled}>
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!entry.isPaid && entry.amount > 0 && (
                          <DropdownMenuItem
                            onClick={() => {
                              setMarkPaidDialog({ open: true, entry });
                              setReference("");
                            }}
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Mark as Paid
                          </DropdownMenuItem>
                        )}
                        {entry.payout && (
                          <DropdownMenuItem
                            onClick={() =>
                              setReferenceDialog({
                                open: true,
                                payoutId: entry.payout!.id,
                                reference: entry.payout!.reference || "",
                              })
                            }
                          >
                            <FileText className="w-4 h-4 mr-2" />
                            Update Reference
                          </DropdownMenuItem>
                        )}
                        {entry.isPaid && (
                          <DropdownMenuItem
                            onClick={() => onGenerateInvoice(entry.userId)}
                          >
                            <Receipt className="w-4 h-4 mr-2" />
                            Generate GST Invoice
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Mark Paid Dialog */}
      <Dialog open={markPaidDialog.open} onOpenChange={(open) => setMarkPaidDialog({ open, entry: markPaidDialog.entry })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Payout as Paid</DialogTitle>
            <DialogDescription>
              Record payment for {markPaidDialog.entry?.user.firstName}{" "}
              {markPaidDialog.entry?.user.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">Prize Amount</p>
              <p className="text-2xl font-bold text-foreground">
                {formatCurrency(markPaidDialog.entry?.amount || 0)}
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Payment Method
              </label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      <div className="flex items-center gap-2">
                        <m.icon className="w-4 h-4" />
                        {m.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Transaction Reference (Optional)
              </label>
              <Input
                placeholder="e.g., UTR123456789, Cheque #123456"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidDialog({ open: false, entry: null })}>
              Cancel
            </Button>
            <Button onClick={handleMarkPaid} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Reference Dialog */}
      <Dialog open={referenceDialog.open} onOpenChange={(open) => setReferenceDialog({ open, payoutId: referenceDialog.payoutId, reference: referenceDialog.reference })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Reference</DialogTitle>
            <DialogDescription>
              Add or update the transaction reference for this payout
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Transaction Reference
              </label>
              <Input
                placeholder="e.g., UTR123456789, Cheque #123456"
                value={referenceDialog.reference}
                onChange={(e) =>
                  setReferenceDialog({ ...referenceDialog, reference: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferenceDialog({ open: false, payoutId: "", reference: "" })}>
              Cancel
            </Button>
            <Button onClick={handleUpdateReference} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Reference"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
