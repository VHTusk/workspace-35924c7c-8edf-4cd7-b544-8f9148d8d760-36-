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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Edit,
  Trash2,
  Target,
  UserCheck,
  ChevronRight,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  managerId: string | null;
  totalEmployees: number;
  activePlayers: number;
  tournamentParticipations: number;
  totalPoints: number;
  autoLeagueEnabled: boolean;
  leaguePointSystem: string | null;
  createdAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

interface SummaryStats {
  totalDepartments: number;
  totalEmployees: number;
  totalActivePlayers: number;
  totalPoints: number;
}

export default function DepartmentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchDepartments();
    }
  }, [org?.id, sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        // Redirect if not a corporate org
        if (data.type !== "CORPORATE") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchDepartments = async () => {
    if (!org?.id) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/org/${org.id}/departments?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
        setSummary(data.summary || null);
      } else {
        setError("Failed to load departments");
      }
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setError("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!formData.name) {
      setError("Please enter department name");
      return;
    }

    if (!org?.id) {
      setError("Organization not found");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/${org.id}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setDepartments([...departments, data.department]);
        setSummary(prev => prev ? {
          ...prev,
          totalDepartments: prev.totalDepartments + 1,
        } : null);
        setSuccess("Department added successfully!");
        setShowAddDialog(false);
        setFormData({ name: "", code: "", description: "" });
      } else {
        setError(data.error || "Failed to add department");
      }
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditDepartment = async () => {
    if (!selectedDepartment || !formData.name) {
      setError("Please enter department name");
      return;
    }

    if (!org?.id) {
      setError("Organization not found");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/${org.id}/departments/${selectedDepartment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code,
          description: formData.description,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setDepartments(departments.map((d) =>
          d.id === selectedDepartment.id ? { ...d, ...data.department } : d
        ));
        setSuccess("Department updated successfully!");
        setShowEditDialog(false);
        setSelectedDepartment(null);
        setFormData({ name: "", code: "", description: "" });
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

  const handleDeleteDepartment = async () => {
    if (!selectedDepartment || !org?.id) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/org/${org.id}/departments/${selectedDepartment.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setDepartments(departments.filter((d) => d.id !== selectedDepartment.id));
        setSummary(prev => prev ? {
          ...prev,
          totalDepartments: prev.totalDepartments - 1,
          totalEmployees: prev.totalEmployees - selectedDepartment.totalEmployees,
          totalActivePlayers: prev.totalActivePlayers - selectedDepartment.activePlayers,
          totalPoints: prev.totalPoints - selectedDepartment.totalPoints,
        } : null);
        setSuccess("Department deleted successfully!");
        setShowDeleteDialog(false);
        setSelectedDepartment(null);
      } else {
        setError(data.error || "Failed to delete department");
      }
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openEditDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setFormData({
      name: dept.name,
      code: dept.code || "",
      description: dept.description || "",
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (dept: Department) => {
    setSelectedDepartment(dept);
    setShowDeleteDialog(true);
  };

  // Filter departments based on search query
  const filteredDepartments = departments.filter(dept => 
    dept.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (dept.code && dept.code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
              onClick={() => router.push(`/${sport}/org/corporate-dashboard`)}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </nav>

          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Department Management</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage departments for your organization (Employer Sports)</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => {
                  setFormData({ name: "", code: "", description: "" });
                  setShowAddDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Department
              </Button>
            </div>
          </div>

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

          {/* Stats Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Building2 className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalDepartments ?? departments.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Departments</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalEmployees ?? departments.reduce((sum, d) => sum + d.totalEmployees, 0)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Employees</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <UserCheck className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary?.totalActivePlayers ?? departments.reduce((sum, d) => sum + d.activePlayers, 0)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Active Players</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Target className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{(summary?.totalPoints ?? departments.reduce((sum, d) => sum + d.totalPoints, 0)).toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Points</p>
              </CardContent>
            </Card>
          </div>

          {/* Departments Card */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-gray-900 dark:text-white">Departments</CardTitle>
                  <CardDescription className="dark:text-gray-400">Click on a department to view details and manage employees</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search departments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-48"
                    />
                  </div>
                  {/* View Toggle */}
                  <div className="flex items-center border rounded-lg">
                    <Button
                      variant={viewMode === "table" ? "default" : "ghost"}
                      size="icon"
                      className={cn("h-8 w-8 rounded-r-none", viewMode === "table" && primaryBtnClass)}
                      onClick={() => setViewMode("table")}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === "grid" ? "default" : "ghost"}
                      size="icon"
                      className={cn("h-8 w-8 rounded-l-none", viewMode === "grid" && primaryBtnClass)}
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredDepartments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>{searchQuery ? "No departments match your search" : "No departments found"}</p>
                  <p className="text-sm">{searchQuery ? "Try a different search term" : "Add a department to get started"}</p>
                </div>
              ) : viewMode === "table" ? (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 dark:bg-gray-700/50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Code</TableHead>
                        <TableHead className="font-semibold text-center">Employees</TableHead>
                        <TableHead className="font-semibold text-center">Active Players</TableHead>
                        <TableHead className="font-semibold text-center">Points</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDepartments.map((dept) => (
                        <TableRow 
                          key={dept.id}
                          className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                          onClick={() => router.push(`/${sport}/org/employer-sports/departments/${dept.id}`)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", primaryBgClass)}>
                                <Building2 className={cn("w-4 h-4", primaryTextClass)} />
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white">{dept.name}</p>
                                {dept.autoLeagueEnabled && (
                                  <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 mt-1">
                                    Auto-League
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {dept.code ? (
                              <Badge variant="outline" className="font-mono">{dept.code}</Badge>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{dept.totalEmployees}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={cn("font-medium", dept.activePlayers > 0 ? "text-green-600" : "text-gray-400")}>
                              {dept.activePlayers}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{dept.totalPoints.toLocaleString()}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-gray-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditDialog(dept);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDeleteDialog(dept);
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDepartments.map((dept) => (
                    <Card
                      key={dept.id}
                      className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div
                            className="flex items-center gap-3 cursor-pointer flex-1"
                            onClick={() => router.push(`/${sport}/org/employer-sports/departments/${dept.id}`)}
                          >
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                              <Building2 className={cn("w-5 h-5", primaryTextClass)} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">{dept.name}</p>
                              <div className="flex items-center gap-2">
                                {dept.code && (
                                  <Badge variant="outline" className="text-xs">{dept.code}</Badge>
                                )}
                                {dept.autoLeagueEnabled && (
                                  <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                    Auto-League
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditDialog(dept);
                              }}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                openDeleteDialog(dept);
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{dept.totalEmployees}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Employees</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{dept.activePlayers}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Players</p>
                          </div>
                          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold text-gray-900 dark:text-white">{dept.totalPoints}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Points</p>
                          </div>
                        </div>

                        {/* View Details Button */}
                        <Button
                          variant="ghost"
                          className={cn("w-full justify-between", primaryTextClass)}
                          onClick={() => router.push(`/${sport}/org/employer-sports/departments/${dept.id}`)}
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Department Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Department</DialogTitle>
            <DialogDescription>
              Add a new department to your organization
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
              <p className="text-xs text-gray-500">Short code (max 10 characters)</p>
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
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAddDepartment}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Department
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleEditDepartment}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Department</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedDepartment?.name}&quot;? This action cannot be undone.
              {selectedDepartment && selectedDepartment.totalEmployees > 0 && (
                <div className="mt-2 text-amber-600 dark:text-amber-400">
                  This department has {selectedDepartment.totalEmployees} employees. Please reassign them first.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteDepartment}
              disabled={saving || (selectedDepartment?.totalEmployees || 0) > 0}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
