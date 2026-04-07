"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Scale,
  ArrowLeft,
  Loader2,
  Send,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import SiteFooter from "@/components/layout/site-footer";

export default function AppealPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [appealType, setAppealType] = useState<string>("");
  const [relatedId, setRelatedId] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600"
    : "bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600";

  const appealTypes = [
    { value: "account_suspension", label: "Account Suspension" },
    { value: "tournament_ban", label: "Tournament Ban" },
    { value: "warning", label: "Warning Dispute" },
    { value: "content_removal", label: "Content Removal" },
    { value: "rating_adjustment", label: "Rating Adjustment" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async () => {
    if (!appealType || !reason.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (reason.trim().length < 50) {
      toast.error("Please provide more details (at least 50 characters)");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport,
          appealType,
          relatedId: relatedId || undefined,
          reason,
          evidence: evidence || undefined,
        }),
      });

      if (response.ok) {
        setSubmitted(true);
        toast.success("Appeal submitted successfully");
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to submit appeal");
      }
    } catch (error) {
      toast.error("Failed to submit appeal");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col">
        <main className="flex-1 md:ml-72 p-4 md:p-6">
          <div className="max-w-2xl mx-auto py-12 text-center">
            <div className={cn(
              "w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center",
              isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30"
            )}>
              <CheckCircle className={cn("w-10 h-10", primaryTextClass)} />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Appeal Submitted
            </h1>
            <p className="text-muted-foreground mb-6">
              We&apos;ve received your appeal and will review it within 3-5 business days.
              You&apos;ll receive a notification when a decision is made.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={`/${sport}/dashboard`}>
                <Button variant="outline">
                  Back to Dashboard
                </Button>
              </Link>
              <Link href={`/${sport}/safety`}>
                <Button className={cn("text-white", primaryBtnClass)}>
                  Safety Center
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <main className="flex-1 md:ml-72 p-4 md:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Back Link */}
          <Link
            href={`/${sport}/safety`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Safety Center
          </Link>

          {/* Header */}
          <div className="text-center py-4">
            <div className={cn(
              "w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center",
              isCornhole ? "bg-green-100 dark:bg-green-900/30" : "bg-teal-100 dark:bg-teal-900/30"
            )}>
              <Scale className={cn("w-8 h-8", primaryTextClass)} />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Submit an Appeal
            </h1>
            <p className="text-muted-foreground">
              Request a review of a moderation decision
            </p>
          </div>

          {/* Info Card */}
          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-200">
                  Before You Appeal
                </p>
                <ul className="mt-1 text-amber-700 dark:text-amber-300 space-y-1">
                  <li>• Appeals are reviewed within 3-5 business days</li>
                  <li>• Provide as much detail as possible</li>
                  <li>• Include any relevant evidence or context</li>
                  <li>• Submitting false or misleading information may result in consequences</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Appeal Form */}
          <Card className="bg-card border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle>Appeal Details</CardTitle>
              <CardDescription>
                Fill out the form below to submit your appeal
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Appeal Type */}
              <div className="space-y-2">
                <Label htmlFor="appealType">
                  Appeal Type <span className="text-red-500">*</span>
                </Label>
                <Select value={appealType} onValueChange={setAppealType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select what you're appealing" />
                  </SelectTrigger>
                  <SelectContent>
                    {appealTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Related ID */}
              <div className="space-y-2">
                <Label htmlFor="relatedId">
                  Related ID (Optional)
                </Label>
                <Input
                  id="relatedId"
                  placeholder="Tournament ID, Match ID, or Report ID"
                  value={relatedId}
                  onChange={(e) => setRelatedId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  If you have a specific ID related to your appeal, enter it here
                </p>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Why should this decision be reviewed? <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Explain why you believe the decision was incorrect or unfair..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={5}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 50 characters ({reason.length}/50)
                </p>
              </div>

              {/* Evidence */}
              <div className="space-y-2">
                <Label htmlFor="evidence">
                  Supporting Evidence (Optional)
                </Label>
                <Textarea
                  id="evidence"
                  placeholder="Provide any links, screenshots, or additional context..."
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={!appealType || reason.trim().length < 50 || submitting}
                  className={cn("w-full text-white", primaryBtnClass)}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Submit Appeal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <div className="text-center text-sm text-muted-foreground">
            <p>
              Questions?{" "}
              <Link href={`/${sport}/contact`} className={cn("underline", primaryTextClass)}>
                Contact Support
              </Link>
            </p>
          </div>
        </div>

        <SiteFooter />
      </main>
    </div>
  );
}
