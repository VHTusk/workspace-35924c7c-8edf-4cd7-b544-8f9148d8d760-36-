"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Edit,
  Trophy,
  Target,
  UserCheck,
  ChevronRight,
  Crown,
  Mail,
  Phone,
  Calendar,
  Activity,
  Settings,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  employeeId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  designation: string | null;
  isVerified: boolean;
  hasAccount: boolean;
  tournamentsPlayed: number;
  totalPoints: number;
  wins: number;
  losses: number;
  joinedAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    visiblePoints: number;
    hiddenElo: number;
  } | null;
}

interface Manager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  designation: string | null;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  autoLeagueEnabled: boolean;
  leaguePointSystem: string | null;
  totalEmployees: number;
  activePlayers: number;
  tournamentParticipations: number;
  totalPoints: number;
  managerId: string | null;
  manager: Manager | null;
  createdAt: string;
  stats: {
    totalWins: number;
    totalLosses: number;
    winRate: number;
  };
}

export default function DepartmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const departmentId = params.departmentId as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [department, setDepartment] = useState<Department | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showManagerDialog, setShowManagerDialog] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    autoLeagueEnabled: false,
    leaguePointSystem: "",
  });

  const [selectedManagerId, setSelectedManagerId] = useState<string>("");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchDepartment();
  }, [departmentId, sport]);

  const fetchDepartment = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/org/departments/${departmentId}`);
      if (response.ok) {
        const data = await response.json();
        setDepartment(data.department);
        setEmployees(data.employees || []);
        setFormData({
          name: data.department.name,
          code: data.department.code || "",
          description: data.department.description || "",
          autoLeagueEnabled: data.department.autoLeagueEnabled,
          leaguePointSystem: data.department.leaguePointSystem || "",
        });
      } else {
        setError("Failed to load department");
      }
    } catch (err) {
      console.error("Failed to fetch department:", err);
      setError("Failed to load department");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDepartment = async () => {
    if (!formData.name) {
      setError("Please enter department name");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/departments/${departmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setDepartment((prev) => prev ? { ...prev, ...data.department } : null);
        setSuccess("Department updated successfully!");
        setShowEditDialog(false);
      } else {
        setError(data.error || "Failed to update department");
      }
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAssignManager = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/departments/${departmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: selectedManagerId || null }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update local state
        const newManager = selectedManagerId
          ? employees.find((e) => e.id === selectedManagerId) || null
          : null;

        setDepartment((prev) =>
          prev
            ? {
                ...prev,
                managerId: selectedManagerId || null,
                manager: newManager
                  ? {
                      id: newManager.id,
                      firstName: newManager.firstName,
                      lastName: newManager.lastName,
                      email: newManager.email,
                      designation: newManager.designation,
                    }
                  : null,
              }
            : null
        );
        setSuccess("Manager assigned successfully!");
        setShowManagerDialog(false);
      } else {
        setError(data.error || "Failed to assign manager");
      }
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoLeague = async (enabled: boolean) => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/org/departments/${departmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoLeagueEnabled: enabled }),
      });

      if (response.ok) {
        setDepartment((prev) =>
          prev ? { ...prev, autoLeagueEnabled: enabled } : null
        );
        setFormData((prev) => ({ ...prev, autoLeagueEnabled: enabled }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getWinRateColor = (wins: number, losses: number) => {
    const total = wins + losses;
    if (total === 0) return "text-gray-500";
    const rate = wins / total;
    if (rate >= 0.6) return "text-green-600 dark:text-green-400";
    if (rate >= 0.4) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Sidebar />
        <main className="ml-72">
          <div className="flex items-center justify-center h-[50vh]">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              <p className="text-muted-foreground">Loading department...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Sidebar />
        <main className="ml-72">
          <div className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>Department not found</AlertDescription>
            </Alert>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => router.push(`/${sport}/org/employer-sports/departments`)}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Departments
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Sidebar />
      <main className="ml-72">
        <div className="p-6">
          {/* Breadcrumb */}
          <nav className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/${sport}/org/employer-sports/departments`)}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Departments
            </Button>
          </nav>

          {/* Alerts */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-4 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Header Card */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm mb-6">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center", primaryBgClass)}>
                    <Building2 className={cn("w-7 h-7", primaryTextClass)} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{department.name}</h1>
                      {department.code && (
                        <Badge variant="outline" className="text-sm">{department.code}</Badge>
                      )}
                    </div>
                    {department.description && (
                      <p className="text-gray-500 dark:text-gray-400 mt-1">{department.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Created {new Date(department.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowEditDialog(true)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              </div>

              {/* Manager Info */}
              {department.manager && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Department Manager</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {department.manager.firstName} {department.manager.lastName}
                        {department.manager.designation && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal"> • {department.manager.designation}</span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto"
                      onClick={() => {
                        setSelectedManagerId(department.managerId || "");
                        setShowManagerDialog(true);
                      }}
                    >
                      Change
                    </Button>
                  </div>
                </div>
              )}

              {!department.manager && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedManagerId("");
                      setShowManagerDialog(true);
                    }}
                  >
                    <User className="w-4 h-4 mr-2" />
                    Assign Manager
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{department.totalEmployees}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Employees</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <UserCheck className="w-6 h-6 mx-auto mb-2 text-green-500" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{department.activePlayers}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Players</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Target className="w-6 h-6 mx-auto mb-2 text-amber-500" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{department.totalPoints.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Points</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className="w-6 h-6 mx-auto mb-2 text-yellow-500" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{department.stats.totalWins}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Wins</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Activity className="w-6 h-6 mx-auto mb-2 text-red-500" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{department.stats.totalLosses}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Losses</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Activity className={cn("w-6 h-6 mx-auto mb-2", getWinRateColor(department.stats.totalWins, department.stats.totalLosses))} />
                <p className={cn("text-xl font-bold", getWinRateColor(department.stats.totalWins, department.stats.totalLosses))}>
                  {department.stats.winRate}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Win Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Auto-League Settings */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Auto-League Settings
                  </CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    Enable automatic league participation for this department
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={department.autoLeagueEnabled}
                    onCheckedChange={handleToggleAutoLeague}
                    disabled={saving}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {department.autoLeagueEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </CardHeader>
            {department.autoLeagueEnabled && (
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    {department.leaguePointSystem || "PARTICIPATION"}
                  </Badge>
                  <span>Point system for league standings</span>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Employees List */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-white">Employees</CardTitle>
                  <CardDescription className="dark:text-gray-400">
                    {employees.length} employee{employees.length !== 1 ? "s" : ""} in this department
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm">
                  <Users className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No employees in this department</p>
                  <p className="text-sm">Add employees from the Employees page</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {employees.map((emp) => (
                    <div
                      key={emp.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-gray-900 dark:text-white">{emp.fullName}</p>
                            {department.managerId === emp.id && (
                              <Crown className="w-4 h-4 text-amber-500" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {emp.designation && <span>{emp.designation}</span>}
                            {emp.designation && <span>•</span>}
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {emp.email}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {emp.isVerified ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Verified</Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                            {emp.hasAccount && (
                              <Badge variant="outline" className="text-blue-600 dark:text-blue-400">Player</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>{emp.tournamentsPlayed} tourn.</span>
                            <span>{emp.totalPoints} pts</span>
                            <span className={getWinRateColor(emp.wins, emp.losses)}>
                              {emp.wins}W/{emp.losses}L
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Department Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>
              Update department details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Engineering, Sales, HR"
              />
            </div>

            <div className="space-y-2">
              <Label>Department Code</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g., ENG, SAL, HR"
                maxLength={10}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>League Point System</Label>
              <Select
                value={formData.leaguePointSystem}
                onValueChange={(v) => setFormData((prev) => ({ ...prev, leaguePointSystem: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select point system" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PARTICIPATION">Participation Points</SelectItem>
                  <SelectItem value="WINS">Win-based Points</SelectItem>
                  <SelectItem value="PLACEMENT">Placement Points</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleUpdateDepartment}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Manager Dialog */}
      <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Department Manager</DialogTitle>
            <DialogDescription>
              Select an employee to be the department manager
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Manager</Label>
              <Select
                value={selectedManagerId}
                onValueChange={setSelectedManagerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Manager</SelectItem>
                  {employees
                    .filter((e) => e.isVerified)
                    .map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.fullName} {emp.designation ? `(${emp.designation})` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowManagerDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAssignManager}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Assign Manager"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
