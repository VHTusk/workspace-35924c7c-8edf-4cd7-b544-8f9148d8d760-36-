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
  Plus,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Edit,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  batches: string[];
  studentCount: number;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
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
  const [showAddDialog, setShowAddDialog] = useState(false);

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
  }, [org?.id]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        // Redirect if not a college
        if (data.type !== "COLLEGE") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      if (!org?.id) return;
      
      const response = await fetch(`/api/orgs/${org.id}/college-departments?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.departments) {
          setDepartments(data.data.departments.map((dept: { id: string; name: string; code: string; totalStudents: number; batches: { name: string }[] }) => ({
            id: dept.id,
            name: dept.name,
            code: dept.code,
            batches: dept.batches?.map((b: { name: string }) => b.name) || [],
            studentCount: dept.totalStudents,
          })));
        }
      } else {
        // Fallback to default departments if API fails
        const defaultDepartments: Department[] = [
          { id: "1", name: "Engineering", code: "ENG", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
          { id: "2", name: "Arts", code: "ARTS", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
          { id: "3", name: "Science", code: "SCI", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
          { id: "4", name: "Commerce", code: "COM", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
          { id: "5", name: "Management", code: "MGT", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
          { id: "6", name: "Law", code: "LAW", batches: ["2021", "2022", "2023", "2024"], studentCount: 0 },
        ];
        setDepartments(defaultDepartments);
      }
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setError("Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!formData.name || !formData.code) {
      setError("Please enter department name and code");
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
      const response = await fetch(`/api/orgs/${org.id}/college-departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code.toUpperCase(),
          description: formData.description,
          sport: sport.toUpperCase(),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.department) {
          const newDept: Department = {
            id: data.department.id,
            name: data.department.name,
            code: data.department.code,
            batches: [],
            studentCount: 0,
          };
          setDepartments([...departments, newDept]);
          setSuccess("Department added successfully!");
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || "Failed to add department");
      }
      
      setShowAddDialog(false);
      setFormData({ name: "", code: "", description: "" });
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/college-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
                <p className="text-gray-500">Manage departments and batches for your college (Campus Sports)</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => setShowAddDialog(true)}
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
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Building2 className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{departments.length}</p>
                <p className="text-xs text-gray-500">Departments</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {departments.reduce((sum, d) => sum + d.batches.length, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Batches</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {departments.reduce((sum, d) => sum + d.studentCount, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Students</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">0</p>
                <p className="text-xs text-gray-500">Verified Students</p>
              </CardContent>
            </Card>
          </div>

          {/* Departments Grid */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Departments</CardTitle>
              <CardDescription>Click on a department to manage batches and students</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {departments.map((dept) => (
                    <Card
                      key={dept.id}
                      className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => router.push(`/${sport}/org/college-sports/departments/${dept.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                              <Building2 className={cn("w-5 h-5", primaryTextClass)} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{dept.name}</p>
                              <Badge variant="outline" className="text-xs">{dept.code}</Badge>
                            </div>
                          </div>
                          <Edit className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-2">
                          <span>{dept.batches.length} Batches</span>
                          <span>•</span>
                          <span>{dept.studentCount} Students</span>
                        </div>
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
              Add a new department to your college
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Computer Science"
              />
            </div>

            <div className="space-y-2">
              <Label>Department Code *</Label>
              <Input
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                placeholder="e.g., CS"
                maxLength={5}
              />
              <p className="text-xs text-gray-500">Short code (max 5 characters)</p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description..."
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
    </div>
  );
}
