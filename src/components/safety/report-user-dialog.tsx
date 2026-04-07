"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Flag, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

// Report categories matching the task requirements
const REPORT_CATEGORIES = [
  { value: "harassment", label: "Harassment", description: "Bullying, threats, or targeted harassment" },
  { value: "spam", label: "Spam", description: "Unsolicited messages or promotional content" },
  { value: "cheating", label: "Cheating", description: "Unfair play or game manipulation" },
  { value: "inappropriate_content", label: "Inappropriate Content", description: "Offensive images, text, or behavior" },
  { value: "impersonation", label: "Impersonation", description: "Pretending to be someone else" },
  { value: "other", label: "Other", description: "Any other violation" },
] as const;

interface ReportUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  sport?: string;
}

export function ReportUserDialog({
  open,
  onOpenChange,
  userId,
  userName,
  sport = "cornhole",
}: ReportUserDialogProps) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700 text-white"
    : "bg-teal-600 hover:bg-teal-700 text-white";

  const handleSubmit = async () => {
    // Validation
    if (!category) {
      setError("Please select a report category");
      return;
    }

    if (!description.trim()) {
      setError("Please provide a description of the issue");
      return;
    }

    if (description.trim().length < 20) {
      setError("Description must be at least 20 characters");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/users/${userId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: category,
          description: description.trim(),
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit report");
      }

      // Success - show toast and redirect
      toast({
        title: "Report Submitted",
        description: `Your report against ${userName} has been submitted successfully. Our team will review it shortly.`,
      });

      // Reset form
      setCategory("");
      setDescription("");
      
      // Close dialog
      onOpenChange(false);

      // Navigate to home page
      router.push(`/${sport}`);
    } catch (err) {
      console.error("Report submission error:", err);
      setError(err instanceof Error ? err.message : "An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCategory("");
    setDescription("");
    setError("");
    onOpenChange(false);
  };

  const selectedCategory = REPORT_CATEGORIES.find((c) => c.value === category);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="w-5 h-5 text-red-500" />
            Report Player
          </DialogTitle>
          <DialogDescription>
            Report <span className="font-medium text-foreground">{userName}</span> for inappropriate behavior or violations.
            All reports are reviewed by our moderation team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Report Category */}
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium">
              Report Category <span className="text-red-500">*</span>
            </Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {cat.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <p className="text-xs text-muted-foreground">
                {selectedCategory.description}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Please provide details about the incident. Include relevant dates, times, and any other context that will help us investigate."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={1000}
              className="resize-none"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Minimum 20 characters required</span>
              <span>{description.length}/1000</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-700">
              <strong>What happens next?</strong>
              <br />
              Our moderation team will review your report within 24-48 hours. 
              You may be contacted for additional information. 
              False reports may result in action against your account.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !category || !description.trim()}
            className={primaryBtnClass}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <Flag className="w-4 h-4 mr-2" />
                Submit Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
