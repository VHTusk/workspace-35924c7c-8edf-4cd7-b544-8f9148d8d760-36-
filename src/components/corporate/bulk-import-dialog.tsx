"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  Loader2,
  ChevronRight,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EmployeeRow {
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  department?: string;
  designation?: string;
  _validation?: {
    valid: boolean;
    errors: string[];
    warning?: string;
  };
}

interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; email: string; error: string }>;
  warnings: Array<{ row: number; email: string; warning: string }>;
  createdEmployees: Array<{ id: string; email: string; firstName: string; lastName: string }>;
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  sport: "CORNHOLE" | "DARTS";
  onImportComplete?: () => void;
}

const SAMPLE_CSV = `employee_id,email,first_name,last_name,phone,department,designation
EMP001,john.doe@company.com,John,Doe,+91-9876543210,Engineering,Senior Developer
EMP002,jane.smith@company.com,Jane,Smith,+91-9876543220,Sales,Manager
EMP003,bob.wilson@company.com,Bob,Wilson,+91-9876543230,Marketing,Designer`;

export function BulkImportDialog({
  open,
  onOpenChange,
  orgId,
  sport,
  onImportComplete,
}: BulkImportDialogProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setStep(1);
    setFile(null);
    setEmployees([]);
    setImporting(false);
    setImportProgress(0);
    setImportResult(null);
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const parseCSV = (text: string): EmployeeRow[] => {
    const lines = text.split("\n").filter((line) => line.trim());
    if (lines.length < 2) {
      throw new Error("CSV file must have a header row and at least one data row");
    }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const rows: EmployeeRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      
      header.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      rows.push({
        employeeId: row["employee_id"] || row["employeeid"],
        email: row["email"] || "",
        firstName: row["first_name"] || row["firstname"] || "",
        lastName: row["last_name"] || row["lastname"] || "",
        phone: row["phone"],
        department: row["department"],
        designation: row["designation"] || row["title"],
      });
    }

    return rows;
  };

  const handleUpload = () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = parseCSV(text);
        
        // Validate rows
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validated = parsed.map((row) => {
          const errors: string[] = [];
          
          if (!row.email) errors.push("Email required");
          else if (!emailRegex.test(row.email)) errors.push("Invalid email");
          if (!row.firstName) errors.push("First name required");
          if (!row.lastName) errors.push("Last name required");
          
          return {
            ...row,
            _validation: {
              valid: errors.length === 0,
              errors,
            },
          };
        });

        setEmployees(validated);
        setStep(2);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse CSV");
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    setError(null);

    try {
      // Filter only valid employees
      const validEmployees = employees.filter((e) => e._validation?.valid);
      
      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`/api/org/${orgId}/employees/bulk-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employees: validEmployees.map(({ _validation, ...rest }) => rest),
          sport,
        }),
      });

      clearInterval(progressInterval);
      setImportProgress(100);

      if (!response.ok) {
        throw new Error("Import failed");
      }

      const data = await response.json();
      setImportResult(data.result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    if (importResult?.created && importResult.created > 0) {
      onImportComplete?.();
    }
    resetState();
    onOpenChange(false);
  };

  const downloadSampleCSV = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "employee_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = employees.filter((e) => e._validation?.valid).length;
  const invalidCount = employees.length - validCount;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Import Employees
          </DialogTitle>
          <DialogDescription>
            Step {step} of 3:{" "}
            {step === 1 && "Upload CSV file"}
            {step === 2 && "Review and validate"}
            {step === 3 && "Import complete"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="space-y-4 flex-1">
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                "hover:border-primary/50 hover:bg-muted/50",
                file && "border-green-500 bg-green-50 dark:bg-green-950/20"
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileChange}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-10 w-10 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <p className="font-medium">Click to upload or drag and drop</p>
                  <p className="text-sm text-muted-foreground">CSV file with employee data</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={downloadSampleCSV}>
                <Download className="h-4 w-4 mr-2" />
                Download Sample CSV
              </Button>
              <div className="text-sm text-muted-foreground">
                Required: email, first_name, last_name
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Preview */}
        {step === 2 && (
          <div className="space-y-4 flex-1 overflow-hidden">
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {validCount} Valid
              </Badge>
              {invalidCount > 0 && (
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3 text-red-500" />
                  {invalidCount} Invalid
                </Badge>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden flex-1 max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead className="w-20">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.slice(0, 100).map((emp, idx) => (
                    <TableRow
                      key={idx}
                      className={cn(
                        !emp._validation?.valid && "bg-red-50 dark:bg-red-950/20"
                      )}
                    >
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell>{emp.email}</TableCell>
                      <TableCell>{emp.firstName}</TableCell>
                      <TableCell>{emp.lastName}</TableCell>
                      <TableCell>{emp.department || "-"}</TableCell>
                      <TableCell>
                        {emp._validation?.valid ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {employees.length > 100 && (
              <p className="text-sm text-muted-foreground text-center">
                Showing first 100 of {employees.length} rows
              </p>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 3: Result */}
        {step === 3 && importResult && (
          <div className="space-y-4 flex-1">
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold text-green-600">{importResult.created}</p>
                <p className="text-sm text-muted-foreground">Imported</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{importResult.skipped}</p>
                <p className="text-sm text-muted-foreground">Skipped</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-3xl font-bold text-red-600">{importResult.errors.length}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </Card>
            </div>

            {importResult.warnings.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Warnings:</p>
                <div className="max-h-32 overflow-y-auto text-sm text-muted-foreground">
                  {importResult.warnings.slice(0, 10).map((w, idx) => (
                    <p key={idx}>Row {w.row}: {w.email} - {w.warning}</p>
                  ))}
                  {importResult.warnings.length > 10 && (
                    <p>...and {importResult.warnings.length - 10} more</p>
                  )}
                </div>
              </div>
            )}

            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-red-600">Errors:</p>
                <div className="max-h-32 overflow-y-auto text-sm text-red-500">
                  {importResult.errors.slice(0, 10).map((e, idx) => (
                    <p key={idx}>Row {e.row}: {e.email} - {e.error}</p>
                  ))}
                  {importResult.errors.length > 10 && (
                    <p>...and {importResult.errors.length - 10} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={!file}>
                Continue
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    Import {validCount} Employees
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          )}
          {step === 3 && (
            <Button onClick={handleClose}>
              Done
            </Button>
          )}
        </DialogFooter>

        {importing && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-background border-t">
            <Progress value={importProgress} className="h-2" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Simple Card component for inline use
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card text-card-foreground shadow-sm",
        className
      )}
      {...props}
    />
  );
}
