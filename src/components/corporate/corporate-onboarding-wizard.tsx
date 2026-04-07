"use client";

import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Trophy,
  Users,
  Upload,
  Settings,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import { BulkImportDialog } from "./bulk-import-dialog";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgName: string;
  onComplete?: () => void;
}

const STEPS = [
  { id: 1, title: "Organization", description: "Basic details", icon: Building2 },
  { id: 2, title: "Sports", description: "Select sports", icon: Trophy },
  { id: 3, title: "Departments", description: "Setup structure", icon: Building2 },
  { id: 4, title: "Employees", description: "Import employees", icon: Users },
  { id: 5, title: "Preferences", description: "Tournament settings", icon: Settings },
  { id: 6, title: "Complete", description: "Review & activate", icon: CheckCircle },
];

interface Department {
  name: string;
  code: string;
}

export function CorporateOnboardingWizard({
  open,
  onOpenChange,
  orgId,
  orgName,
  onComplete,
}: OnboardingWizardProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [orgDetails, setOrgDetails] = useState({
    name: orgName,
    city: "",
    state: "",
    phone: "",
  });

  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDept, setNewDept] = useState({ name: "", code: "" });

  const [preferences, setPreferences] = useState({
    defaultTournamentSize: "32",
    scoringMode: "STAFF_ONLY",
    allowPlayerSelfScore: false,
    sendReminders: true,
    reminderTiming: "24",
  });

  const [employeesImported, setEmployeesImported] = useState(0);
  const [showImportDialog, setShowImportDialog] = useState(false);

  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    setError(null);
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddDepartment = () => {
    if (newDept.name.trim()) {
      setDepartments([
        ...departments,
        {
          name: newDept.name.trim(),
          code: newDept.code.trim().toUpperCase() || newDept.name.substring(0, 3).toUpperCase(),
        },
      ]);
      setNewDept({ name: "", code: "" });
    }
  };

  const handleRemoveDepartment = (index: number) => {
    setDepartments(departments.filter((_, i) => i !== index));
  };

  const handleToggleSport = (sport: string) => {
    setSelectedSports((prev) =>
      prev.includes(sport)
        ? prev.filter((s) => s !== sport)
        : [...prev, sport]
    );
  };

  const handleComplete = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create departments for each selected sport
      for (const sport of selectedSports) {
        for (const dept of departments) {
          await fetch(`/api/org/departments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: dept.name,
              code: dept.code,
              sport,
            }),
          });
        }
      }

      // Mark onboarding as complete
      await fetch(`/api/org/${orgId}/onboarding/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sports: selectedSports,
          departments: departments.length,
          employeesImported,
          preferences,
        }),
      });

      onComplete?.();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete onboarding");
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Organization Name</Label>
              <Input
                value={orgDetails.name}
                onChange={(e) =>
                  setOrgDetails({ ...orgDetails, name: e.target.value })
                }
                placeholder="Your company name"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={orgDetails.city}
                  onChange={(e) =>
                    setOrgDetails({ ...orgDetails, city: e.target.value })
                  }
                  placeholder="e.g., Mumbai"
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={orgDetails.state}
                  onChange={(e) =>
                    setOrgDetails({ ...orgDetails, state: e.target.value })
                  }
                  placeholder="e.g., Maharashtra"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Contact Phone</Label>
              <Input
                value={orgDetails.phone}
                onChange={(e) =>
                  setOrgDetails({ ...orgDetails, phone: e.target.value })
                }
                placeholder="+91-9876543210"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select the sports your organization wants to participate in.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {["CORNHOLE", "DARTS"].map((sport) => (
                <Card
                  key={sport}
                  className={cn(
                    "cursor-pointer transition-all border-2",
                    selectedSports.includes(sport)
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  )}
                  onClick={() => handleToggleSport(sport)}
                >
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center",
                        sport === "CORNHOLE" ? "bg-green-100" : "bg-teal-100"
                      )}
                    >
                      <Trophy
                        className={cn(
                          "w-6 h-6",
                          sport === "CORNHOLE" ? "text-green-600" : "text-teal-600"
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{sport}</p>
                      <p className="text-xs text-muted-foreground">
                        {sport === "CORNHOLE" ? "Bag toss game" : "Target sport"}
                      </p>
                    </div>
                    {selectedSports.includes(sport) && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {selectedSports.length === 0 && (
              <p className="text-sm text-amber-600">
                Please select at least one sport to continue.
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add departments to organize your employees. This helps with team formation and internal leagues.
            </p>
            
            {/* Quick add presets */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground">Quick add:</span>
              {["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations"].map(
                (dept) => (
                  <Button
                    key={dept}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (!departments.find((d) => d.name === dept)) {
                        setDepartments([
                          ...departments,
                          { name: dept, code: dept.substring(0, 3).toUpperCase() },
                        ]);
                      }
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {dept}
                  </Button>
                )
              )}
            </div>

            {/* Add custom department */}
            <div className="flex gap-2">
              <Input
                value={newDept.name}
                onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                placeholder="Department name"
                className="flex-1"
              />
              <Input
                value={newDept.code}
                onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                placeholder="Code"
                className="w-24"
                maxLength={5}
              />
              <Button onClick={handleAddDepartment} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Department list */}
            {departments.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {departments.map((dept, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg border bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{dept.code}</Badge>
                      <span>{dept.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveDepartment(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {departments.length} department{departments.length !== 1 ? "s" : ""} added
            </p>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Import your employees to get started. You can also skip this step and import later.
            </p>

            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Users className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
              <p className="font-medium mb-2">Import Employees</p>
              <p className="text-sm text-muted-foreground mb-4">
                Upload a CSV file with employee details
              </p>
              <Button onClick={() => setShowImportDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Import from CSV
              </Button>
            </div>

            {employeesImported > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  {employeesImported} employees imported successfully!
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center">
              <Button variant="link" className="text-muted-foreground" onClick={handleNext}>
                Skip for now
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set default preferences for your tournaments.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Tournament Size</Label>
                <Select
                  value={preferences.defaultTournamentSize}
                  onValueChange={(v) =>
                    setPreferences({ ...preferences, defaultTournamentSize: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="16">16 players</SelectItem>
                    <SelectItem value="32">32 players</SelectItem>
                    <SelectItem value="64">64 players</SelectItem>
                    <SelectItem value="128">128 players</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Scoring Mode</Label>
                <Select
                  value={preferences.scoringMode}
                  onValueChange={(v) =>
                    setPreferences({ ...preferences, scoringMode: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF_ONLY">Staff Only</SelectItem>
                    <SelectItem value="HYBRID">Hybrid (Staff + Players)</SelectItem>
                    <SelectItem value="PLAYER_SELF">Player Self-Report</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Player Self-Scoring</Label>
                  <p className="text-xs text-muted-foreground">
                    Players can report their own match results
                  </p>
                </div>
                <Checkbox
                  checked={preferences.allowPlayerSelfScore}
                  onCheckedChange={(c) =>
                    setPreferences({ ...preferences, allowPlayerSelfScore: !!c })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Match Reminders</Label>
                  <p className="text-xs text-muted-foreground">
                    Send reminders before scheduled matches
                  </p>
                </div>
                <Checkbox
                  checked={preferences.sendReminders}
                  onCheckedChange={(c) =>
                    setPreferences({ ...preferences, sendReminders: !!c })
                  }
                />
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold">Ready to Go!</h3>
              <p className="text-sm text-muted-foreground">
                Review your setup before activating
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between p-3 rounded-lg border">
                <span className="text-muted-foreground">Organization</span>
                <span className="font-medium">{orgDetails.name}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg border">
                <span className="text-muted-foreground">Sports</span>
                <div className="flex gap-1">
                  {selectedSports.map((s) => (
                    <Badge key={s} variant="secondary">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex justify-between p-3 rounded-lg border">
                <span className="text-muted-foreground">Departments</span>
                <span className="font-medium">{departments.length}</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg border">
                <span className="text-muted-foreground">Employees</span>
                <span className="font-medium">{employeesImported}</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return orgDetails.name.trim().length > 0;
      case 2:
        return selectedSports.length > 0;
      default:
        return true;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Setup Your Organization</DialogTitle>
            <DialogDescription>
              Let&apos;s get your corporate sports program configured
            </DialogDescription>
          </DialogHeader>

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between">
              {STEPS.map((step) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-col items-center",
                    currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium",
                      currentStep > step.id
                        ? "bg-primary text-primary-foreground"
                        : currentStep === step.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      step.id
                    )}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content */}
          <div className="flex-1 overflow-y-auto py-4">{renderStepContent()}</div>

          {/* Footer */}
          <DialogFooter className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Continue
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Setting up...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete Setup
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Import Dialog */}
      {selectedSports.length > 0 && (
        <BulkImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          orgId={orgId}
          sport={selectedSports[0] as "CORNHOLE" | "DARTS"}
          onImportComplete={() => {
            // Refresh count
            setEmployeesImported((prev) => prev + 1);
          }}
        />
      )}
    </>
  );
}
