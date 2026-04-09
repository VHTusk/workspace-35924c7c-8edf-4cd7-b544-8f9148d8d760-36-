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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Loader2,
  FileDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  sport: "CORNHOLE" | "DARTS";
}

const REPORT_TYPES = [
  {
    id: "participation",
    name: "Participation Report",
    description: "Employee participation stats, tournament history, and points",
  },
  {
    id: "department",
    name: "Department Performance",
    description: "Department-wise statistics and comparisons",
  },
  {
    id: "tournament",
    name: "Tournament History",
    description: "All tournament results and participant details",
  },
  {
    id: "employee",
    name: "Employee Directory",
    description: "Complete employee list with verification status",
  },
];

export function ReportExportDialog({
  open,
  onOpenChange,
  orgId,
  sport,
}: ReportExportDialogProps) {
  const [reportType, setReportType] = useState("participation");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/org/${orgId}/reports?type=${reportType}&sport=${sport}&format=${format}`
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      if (format === "csv") {
        // Download CSV file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}_report_${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        // Download JSON file
        const data = await response.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportType}_report_${new Date().toISOString().split("T")[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedReport = REPORT_TYPES.find((r) => r.id === reportType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Export Report
          </DialogTitle>
          <DialogDescription>
            Generate and download reports for your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Report Type */}
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReport && (
              <p className="text-xs text-muted-foreground">
                {selectedReport.description}
              </p>
            )}
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Format</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={format === "csv" ? "default" : "outline"}
                className={cn(
                  "justify-start h-auto py-3",
                  format === "csv" && "ring-2 ring-primary"
                )}
                onClick={() => setFormat("csv")}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="font-medium">CSV</p>
                  <p className="text-xs opacity-70">Excel compatible</p>
                </div>
              </Button>
              <Button
                variant={format === "json" ? "default" : "outline"}
                className={cn(
                  "justify-start h-auto py-3",
                  format === "json" && "ring-2 ring-primary"
                )}
                onClick={() => setFormat("json")}
              >
                <FileText className="h-4 w-4 mr-2" />
                <div className="text-left">
                  <p className="font-medium">JSON</p>
                  <p className="text-xs opacity-70">Full data export</p>
                </div>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
