"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Building2,
  Trophy,
  Users,
  Mail,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CheckCircle,
  Sparkles,
  Plus,
  X,
  Target,
  UserPlus,
  ChevronRight,
  FileSpreadsheet,
  Upload,
  Download,
  Search,
  Building,
  Briefcase,
  PartyPopper,
  Zap,
  Eye,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BulkImportDialog } from "@/components/corporate/bulk-import-dialog";

// Step definitions - 5 steps as per requirements
const STEPS = [
  { step: 1, title: "Organization Setup", icon: Building2, canSkip: false },
  { step: 2, title: "Departments", icon: Building, canSkip: true },
  { step: 3, title: "Employees", icon: Users, canSkip: true },
  { step: 4, title: "Admin Team", icon: UserPlus, canSkip: true },
  { step: 5, title: "First Steps", icon: Trophy, canSkip: true },
];

// Industry options
const INDUSTRIES = [
  { value: "technology", label: "Technology / IT" },
  { value: "finance", label: "Finance / Banking" },
  { value: "healthcare", label: "Healthcare / Pharma" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail / E-commerce" },
  { value: "education", label: "Education" },
  { value: "consulting", label: "Consulting" },
  { value: "media", label: "Media / Entertainment" },
  { value: "hospitality", label: "Hospitality / Tourism" },
  { value: "real_estate", label: "Real Estate" },
  { value: "telecommunications", label: "Telecommunications" },
  { value: "automotive", label: "Automotive" },
  { value: "energy", label: "Energy / Utilities" },
  { value: "government", label: "Government / Public Sector" },
  { value: "nonprofit", label: "Non-Profit / NGO" },
  { value: "other", label: "Other" },
];

// Company size options
const COMPANY_SIZES = [
  { value: "1-50", label: "1-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

interface OnboardingStatus {
  completed: boolean;
  currentStep: number;
  steps: Array<{
    step: number;
    title: string;
    completed: boolean;
    skipped?: boolean;
  }>;
  canSkip: boolean;
  organization: {
    id: string;
    name: string;
    type: string;
    industry?: string;
    companySize?: string;
    primarySportInterest?: string;
    logoUrl?: string;
  };
}

interface Department {
  id?: string;
  name: string;
  code: string;
}

interface AdminInvite {
  email: string;
  role: "ADMIN" | "STAFF";
}

// Department CSV sample
const DEPARTMENT_CSV_SAMPLE = `name,code
Engineering,ENG
Sales,SAL
Marketing,MKT
Human Resources,HR
Finance,FIN
Operations,OPS`;

// Confetti particle for celebration
interface ConfettiParticle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  speedX: number;
  speedY: number;
  rotation: number;
  rotationSpeed: number;
}

export default function CorporateOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const deptFileInputRef = useRef<HTMLInputElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [confettiParticles, setConfettiParticles] = useState<ConfettiParticle[]>([]);

  // Form states
  const [orgDetails, setOrgDetails] = useState({
    industry: "",
    companySize: "",
    primarySportInterest: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDept, setNewDept] = useState({ name: "", code: "" });
  const [adminInvites, setAdminInvites] = useState<AdminInvite[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminRole, setNewAdminRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [employeesImported, setEmployeesImported] = useState(0);
  const [showDeptImportDialog, setShowDeptImportDialog] = useState(false);
  const [deptImportFile, setDeptImportFile] = useState<File | null>(null);
  const [deptImportData, setDeptImportData] = useState<Department[]>([]);

  // Tournament creation state
  const [tournamentData, setTournamentData] = useState({
    name: "",
    date: "",
  });

  // Theme classes
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryBorderClass = isCornhole ? "border-green-500" : "border-teal-500";

  // Generate confetti particles
  const generateConfetti = useCallback(() => {
    const colors = isCornhole 
      ? ["#16a34a", "#22c55e", "#86efac", "#fbbf24", "#f59e0b"]
      : ["#0d9488", "#14b8a6", "#5eead4", "#fbbf24", "#f59e0b"];
    
    const particles: ConfettiParticle[] = [];
    for (let i = 0; i < 100; i++) {
      particles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 6 + Math.random() * 8,
        speedX: (Math.random() - 0.5) * 3,
        speedY: 2 + Math.random() * 3,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
      });
    }
    setConfettiParticles(particles);
  }, [isCornhole]);

  // Animate confetti
  useEffect(() => {
    if (showCelebration && confettiParticles.length > 0) {
      const interval = setInterval(() => {
        setConfettiParticles((prev) => {
          const updated = prev.map((p) => ({
            ...p,
            y: p.y + p.speedY * 0.5,
            x: p.x + p.speedX * 0.3,
            rotation: p.rotation + p.rotationSpeed,
          })).filter((p) => p.y < 120);
          
          if (updated.length === 0) {
            setShowCelebration(false);
          }
          return updated;
        });
      }, 30);
      
      return () => clearInterval(interval);
    }
  }, [showCelebration, confettiParticles.length]);

  // Fetch onboarding status
  const fetchStatus = useCallback(async () => {
    try {
      const orgResponse = await fetch("/api/org/me");
      if (!orgResponse.ok) {
        router.push(`/${sport}/org/login`);
        return;
      }
      const orgData = await orgResponse.json();

      // Check if org type is CORPORATE
      if (orgData.type !== "CORPORATE") {
        // Redirect non-corporate orgs to their dashboard
        router.push(`/${sport}/org/dashboard`);
        return;
      }

      const response = await fetch(`/api/org/${orgData.id}/onboarding`);
      if (!response.ok) {
        throw new Error("Failed to fetch onboarding status");
      }
      const data = await response.json();
      setStatus(data);
      
      // Adjust step - if step is 0, make it 1
      const step = data.currentStep === 0 ? 1 : data.currentStep;
      setCurrentStep(step);
      
      setOrgDetails({
        industry: data.organization.industry || "",
        companySize: data.organization.companySize || "",
        primarySportInterest: data.organization.primarySportInterest || "",
      });
      
      if (data.organization.logoUrl) {
        setLogoPreview(data.organization.logoUrl);
      }

      // If already completed, redirect to dashboard
      if (data.completed) {
        router.push(`/${sport}/org/corporate-dashboard`);
        return;
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setError("Failed to load onboarding status");
    } finally {
      setLoading(false);
    }
  }, [sport, router]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Handle logo file change
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError("Logo file size must be less than 5MB");
        return;
      }
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle department CSV import
  const handleDeptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDeptImportFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const lines = text.split("\n").filter((l) => l.trim());
        if (lines.length < 2) {
          setError("CSV must have header and at least one data row");
          return;
        }
        
        const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
        const nameIdx = header.findIndex((h) => h === "name" || h === "department");
        const codeIdx = header.findIndex((h) => h === "code" || h === "short_code");
        
        if (nameIdx === -1) {
          setError("CSV must have 'name' or 'department' column");
          return;
        }
        
        const imported: Department[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",").map((v) => v.trim());
          if (values[nameIdx]) {
            imported.push({
              name: values[nameIdx],
              code: codeIdx !== -1 && values[codeIdx] ? values[codeIdx].toUpperCase() : values[nameIdx].substring(0, 3).toUpperCase(),
            });
          }
        }
        setDeptImportData(imported);
      };
      reader.readAsText(file);
    }
  };

  const confirmDeptImport = () => {
    setDepartments([...departments, ...deptImportData]);
    setDeptImportData([]);
    setDeptImportFile(null);
    setShowDeptImportDialog(false);
  };

  // Update progress
  const updateProgress = async (action: "complete" | "skip" | "back", data?: Record<string, unknown>) => {
    if (!status) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/org/${status.organization.id}/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: currentStep, action, data }),
      });

      if (!response.ok) {
        throw new Error("Failed to update progress");
      }

      const result = await response.json();

      if (result.completed) {
        // Show celebration animation
        generateConfetti();
        setShowCelebration(true);
        
        // Redirect after animation
        setTimeout(() => {
          router.push(`/${sport}/org/corporate-dashboard?onboarded=true`);
        }, 2500);
        return;
      }

      setCurrentStep(result.currentStep);
      setStatus((prev) => prev ? { ...prev, currentStep: result.currentStep } : null);
    } catch (err) {
      console.error("Update progress error:", err);
      setError("Failed to save progress");
    } finally {
      setSaving(false);
    }
  };

  // Navigation handlers
  const handleNext = () => {
    // Validate current step before proceeding
    if (currentStep === 1) {
      if (!orgDetails.industry || !orgDetails.companySize) {
        setError("Please fill in all required fields");
        return;
      }
      updateProgress("complete", {
        industry: orgDetails.industry,
        companySize: orgDetails.companySize,
        primarySportInterest: orgDetails.primarySportInterest || sport.toUpperCase(),
      });
    } else if (currentStep === 2) {
      updateProgress("complete", { departmentsCreated: departments.length > 0 });
    } else if (currentStep === 3) {
      updateProgress("complete", { employeesImported: employeesImported > 0 });
    } else if (currentStep === 4) {
      // Send admin invites
      sendAdminInvites();
    } else if (currentStep === 5) {
      createFirstTournament();
    } else {
      updateProgress("complete");
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    updateProgress("skip");
  };

  // Department handlers
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

  // Admin invite handlers
  const handleAddAdminInvite = () => {
    if (newAdminEmail.trim() && !adminInvites.find((a) => a.email === newAdminEmail)) {
      setAdminInvites([...adminInvites, { email: newAdminEmail.trim(), role: newAdminRole }]);
      setNewAdminEmail("");
      setNewAdminRole("STAFF");
    }
  };

  const handleRemoveAdminInvite = (index: number) => {
    setAdminInvites(adminInvites.filter((_, i) => i !== index));
  };

  // Send admin invites
  const sendAdminInvites = async () => {
    try {
      // Send invites
      for (const invite of adminInvites) {
        await fetch("/api/org/admins/invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: invite.email,
            role: invite.role,
          }),
        });
      }
      updateProgress("complete", { adminsInvited: adminInvites.length });
    } catch (err) {
      console.error("Failed to send invites:", err);
      setError("Failed to send some invites");
    }
  };

  // Create first tournament
  const createFirstTournament = async () => {
    if (!tournamentData.name || !tournamentData.date) {
      // Just complete onboarding without creating tournament
      updateProgress("complete", { tournamentCreated: false });
      return;
    }

    try {
      const response = await fetch("/api/org/tournaments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tournamentData.name,
          startDate: tournamentData.date,
          endDate: tournamentData.date,
          type: "INTRA_ORG",
          format: "INDIVIDUAL",
          sport: sport.toUpperCase(),
          maxPlayers: 32,
          location: "TBD",
        }),
      });

      if (response.ok) {
        updateProgress("complete", { tournamentCreated: true });
      } else {
        // Still complete onboarding even if tournament creation fails
        updateProgress("complete", { tournamentCreated: false });
      }
    } catch (err) {
      console.error("Failed to create tournament:", err);
      updateProgress("complete", { tournamentCreated: false });
    }
  };

  // Download department CSV template
  const downloadDeptTemplate = () => {
    const blob = new Blob([DEPARTMENT_CSV_SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "department_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Progress calculation
  const progress = (currentStep / STEPS.length) * 100;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  if (!status) return null;

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        // Organization Setup Step
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                <Building2 className={cn("w-8 h-8", primaryTextClass)} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Organization Details</h2>
              <p className="text-gray-500">Tell us about your company</p>
            </div>

            <div className="max-w-lg mx-auto space-y-4">
              {/* Logo Upload */}
              <div className="flex flex-col items-center">
                <div 
                  className={cn(
                    "w-24 h-24 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden",
                    logoPreview ? primaryBorderClass : "border-gray-300 hover:border-gray-400"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center text-gray-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1" />
                      <span className="text-xs">Upload Logo</span>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <p className="text-xs text-gray-500 mt-2">Optional: Upload company logo (max 5MB)</p>
                {logoPreview && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 mt-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Remove
                  </Button>
                )}
              </div>

              <div className="p-4 rounded-lg bg-gray-50 border">
                <Label className="text-sm text-gray-500">Organization Name</Label>
                <p className="font-medium text-gray-900">{status.organization.name}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">
                  Industry <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={orgDetails.industry}
                  onValueChange={(v) => setOrgDetails({ ...orgDetails, industry: v })}
                >
                  <SelectTrigger id="industry">
                    <SelectValue placeholder="Select your industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind.value} value={ind.value}>
                        {ind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="companySize">
                  Company Size <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={orgDetails.companySize}
                  onValueChange={(v) => setOrgDetails({ ...orgDetails, companySize: v })}
                >
                  <SelectTrigger id="companySize">
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map((size) => (
                      <SelectItem key={size.value} value={size.value}>
                        {size.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sportInterest">Primary Sport Interest</Label>
                <Select
                  value={orgDetails.primarySportInterest || sport.toUpperCase()}
                  onValueChange={(v) => setOrgDetails({ ...orgDetails, primarySportInterest: v })}
                >
                  <SelectTrigger id="sportInterest">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                    <SelectItem value="DARTS">Darts</SelectItem>
                    <SelectItem value="BOTH">Both Sports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 2:
        // Department Structure Step
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                <Building className={cn("w-8 h-8", primaryTextClass)} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Department Structure</h2>
              <p className="text-gray-500">Set up your organization&apos;s departments</p>
            </div>

            <div className="max-w-2xl mx-auto">
              {/* Import Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <Card 
                  className="bg-white border-gray-200 cursor-pointer hover:border-gray-300 transition-all hover:shadow-md"
                  onClick={() => setShowDeptImportDialog(true)}
                >
                  <CardContent className="p-4 text-center">
                    <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 text-blue-600" />
                    <p className="font-medium text-gray-900">Import from CSV</p>
                    <p className="text-xs text-gray-500">Upload department list</p>
                  </CardContent>
                </Card>
                
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Plus className="w-10 h-10 mx-auto mb-2 text-green-600" />
                    <p className="font-medium text-gray-900">Add Manually</p>
                    <p className="text-xs text-gray-500">Use the form below</p>
                  </CardContent>
                </Card>
              </div>

              {/* Quick add presets */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Quick add common departments:</p>
                <div className="flex flex-wrap gap-2">
                  {["Engineering", "Sales", "Marketing", "HR", "Finance", "Operations", "IT", "Legal"].map(
                    (dept) => (
                      <Button
                        key={dept}
                        variant="outline"
                        size="sm"
                        className="h-8"
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
              </div>

              {/* Add custom department */}
              <div className="flex gap-2 mb-4">
                <Input
                  value={newDept.name}
                  onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                  placeholder="Department name"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                />
                <Input
                  value={newDept.code}
                  onChange={(e) => setNewDept({ ...newDept, code: e.target.value })}
                  placeholder="Code"
                  className="w-24"
                  maxLength={5}
                  onKeyDown={(e) => e.key === "Enter" && handleAddDepartment()}
                />
                <Button onClick={handleAddDepartment} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Department list */}
              {departments.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {departments.map((dept, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">{dept.code}</Badge>
                        <span className="text-gray-900">{dept.name}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveDepartment(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-500 mt-2">
                {departments.length} department{departments.length !== 1 ? "s" : ""} added
              </p>
            </div>
          </div>
        );

      case 3:
        // Employee Import Step
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                <Users className={cn("w-8 h-8", primaryTextClass)} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Employee Import</h2>
              <p className="text-gray-500">Add your employees to get started</p>
            </div>

            <div className="max-w-xl mx-auto">
              {/* Import options */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <Card 
                  className="bg-white border-gray-200 cursor-pointer hover:border-blue-400 transition-all hover:shadow-md"
                  onClick={() => setShowImportDialog(true)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center">
                        <FileSpreadsheet className="w-7 h-7 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">Bulk Import CSV</p>
                        <p className="text-sm text-gray-500">Upload a CSV file with employee details</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {employeesImported > 0 && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">
                    {employeesImported} employees imported successfully! You can add more or continue to the next step.
                  </AlertDescription>
                </Alert>
              )}

              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Tip:</strong> You can always add more employees later from the dashboard. 
                  Import employees now to get your organization set up quickly.
                </p>
              </div>
            </div>
          </div>
        );

      case 4:
        // Invite Admin Team Step
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                <UserPlus className={cn("w-8 h-8", primaryTextClass)} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Invite Admin Team</h2>
              <p className="text-gray-500">Add HR/admin colleagues to help manage</p>
            </div>

            <div className="max-w-xl mx-auto">
              {/* Role description */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                  <p className="font-medium text-purple-900">Admin</p>
                  <p className="text-xs text-purple-700">Full access to manage tournaments, employees, and settings</p>
                </div>
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <p className="font-medium text-gray-900">Staff</p>
                  <p className="text-xs text-gray-600">Limited access to help with tournament operations</p>
                </div>
              </div>

              {/* Add invite form */}
              <div className="flex gap-2 mb-4">
                <Input
                  type="email"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleAddAdminInvite()}
                />
                <Select
                  value={newAdminRole}
                  onValueChange={(v) => setNewAdminRole(v as "ADMIN" | "STAFF")}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="STAFF">Staff</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleAddAdminInvite} variant="outline">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Invite list */}
              {adminInvites.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {adminInvites.map((invite, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <Mail className="w-4 h-4 text-gray-500" />
                        </div>
                        <div>
                          <span className="text-gray-900">{invite.email}</span>
                          <Badge 
                            variant={invite.role === "ADMIN" ? "default" : "outline"} 
                            className="ml-2 text-xs"
                          >
                            {invite.role}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveAdminInvite(idx)}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-gray-500 mt-2">
                {adminInvites.length} invite{adminInvites.length !== 1 ? "s" : ""} ready to send
              </p>
            </div>
          </div>
        );

      case 5:
        // First Steps Step
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className={cn("w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center", primaryBgClass)}>
                <Trophy className={cn("w-8 h-8", primaryTextClass)} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Ready to Go!</h2>
              <p className="text-gray-500">Start your first tournament or explore existing ones</p>
            </div>

            <div className="max-w-2xl mx-auto">
              {/* Two main options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <Card className="bg-white border-2 border-gray-200 hover:border-green-400 transition-all hover:shadow-lg cursor-pointer">
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
                        <Zap className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">Create Tournament</p>
                      <p className="text-sm text-gray-500 mb-4">Set up your first internal competition</p>
                      <div className="space-y-2">
                        <Input
                          placeholder="Tournament name"
                          value={tournamentData.name}
                          onChange={(e) => setTournamentData({ ...tournamentData, name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <Input
                          type="date"
                          value={tournamentData.date}
                          onChange={(e) => setTournamentData({ ...tournamentData, date: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card 
                  className="bg-white border-2 border-gray-200 hover:border-blue-400 transition-all hover:shadow-lg cursor-pointer"
                  onClick={() => router.push(`/${sport}/tournaments`)}
                >
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <Search className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="font-semibold text-gray-900 mb-1">Browse Tournaments</p>
                      <p className="text-sm text-gray-500 mb-4">Explore existing tournaments to join</p>
                      <Button variant="outline" className="w-full" onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/${sport}/tournaments`);
                      }}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Tournaments
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick tips */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Target className="w-5 h-5 text-blue-600" />
                  Quick Tips for Getting Started
                </h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Start with a small tournament to get familiar with the platform</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Encourage employees from different departments to participate</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>Use the leaderboard to track engagement and create friendly competition</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>You can always customize and expand your setup from the dashboard</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const currentStepDef = STEPS.find(s => s.step === currentStep);
  const canSkip = currentStepDef?.canSkip;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Confetti animation */}
      {showCelebration && (
        <div ref={confettiRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          {confettiParticles.map((p) => (
            <div
              key={p.id}
              className="absolute"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.size,
                height: p.size,
                backgroundColor: p.color,
                transform: `rotate(${p.rotation}deg)`,
                borderRadius: Math.random() > 0.5 ? '50%' : '0',
              }}
            />
          ))}
        </div>
      )}

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <Card className="bg-white p-8 text-center shadow-2xl animate-in zoom-in duration-300">
            <PartyPopper className="w-16 h-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">You&apos;re All Set!</h2>
            <p className="text-gray-600">Redirecting to your dashboard...</p>
          </Card>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className={cn("text-2xl font-bold mb-2", primaryTextClass)}>
            Corporate Setup Wizard
          </h1>
          <p className="text-gray-500">Step {currentStep} of {STEPS.length}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((step) => {
              const Icon = step.icon;
              const isCompleted = step.step < currentStep;
              const isCurrent = step.step === currentStep;

              return (
                <div
                  key={step.step}
                  className={cn(
                    "flex flex-col items-center transition-all",
                    isCompleted || isCurrent ? primaryTextClass : "text-gray-400"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                      isCompleted
                        ? cn(primaryBtnClass, "text-white shadow-md")
                        : isCurrent
                        ? cn("border-2 shadow-sm", primaryBorderClass, primaryBgClass)
                        : "bg-gray-200"
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={cn(
                    "text-xs mt-2 hidden sm:block font-medium",
                    isCurrent && "text-gray-900"
                  )}>
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Content Card */}
        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-8">
            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {renderStepContent()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || saving}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {canSkip && (
              <Button
                variant="ghost"
                onClick={handleSkip}
                disabled={saving}
                className="text-gray-500 hover:text-gray-700 gap-2"
              >
                Skip for now
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={saving}
              className={cn("text-white gap-2", primaryBtnClass)}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : currentStep === 5 ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Complete Setup
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Import Dialog */}
      {status && (
        <BulkImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          orgId={status.organization.id}
          sport={sport.toUpperCase() as "CORNHOLE" | "DARTS"}
          onImportComplete={() => {
            setEmployeesImported((prev) => prev + 1);
          }}
        />
      )}

      {/* Department Import Dialog */}
      <Dialog open={showDeptImportDialog} onOpenChange={setShowDeptImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import Departments
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file with department names
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div 
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => deptFileInputRef.current?.click()}
            >
              <input
                ref={deptFileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleDeptFileChange}
              />
              {deptImportFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="w-8 h-8 text-green-600" />
                  <span className="font-medium">{deptImportFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p className="text-sm text-gray-600">Click to upload CSV</p>
                </>
              )}
            </div>

            {deptImportData.length > 0 && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-700">
                  Found {deptImportData.length} departments to import
                </AlertDescription>
              </Alert>
            )}

            <Button variant="outline" size="sm" onClick={downloadDeptTemplate}>
              <Download className="w-4 h-4 mr-2" />
              Download Template
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setDeptImportData([]);
              setDeptImportFile(null);
              setShowDeptImportDialog(false);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={confirmDeptImport}
              disabled={deptImportData.length === 0}
              className={primaryBtnClass}
            >
              Import {deptImportData.length} Departments
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
