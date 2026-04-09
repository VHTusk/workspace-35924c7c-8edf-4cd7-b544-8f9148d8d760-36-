"use client";

import { useEffect, useState, useCallback } from "react";
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
  BookOpen,
  Plus,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Edit,
  Trash2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionData {
  id: string;
  name: string;
  capacity?: number;
}

interface ClassData {
  id: string;
  name: string;
  gradeLevel: number;
  isActive: boolean;
  studentCount: number;
  sections: SectionData[];
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function ClassesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ClassData | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    gradeLevel: "",
    sections: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchOrg = useCallback(async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  }, [sport, router]);

  const fetchClasses = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${org.id}/school-classes?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      } else {
        setError("Failed to load classes");
      }
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  }, [org?.id, sport]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (org?.id) {
      fetchClasses();
    }
  }, [org?.id, fetchClasses]);

  const handleAddClass = async () => {
    if (!formData.name || !formData.gradeLevel) {
      setError("Please enter class name and grade level");
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
      const response = await fetch(`/api/orgs/${org.id}/school-classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          gradeLevel: formData.gradeLevel,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create class");
        return;
      }

      setSuccess("Class created successfully!");
      setShowAddDialog(false);
      setFormData({ name: "", gradeLevel: "", sections: "" });
      fetchClasses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddSections = async () => {
    if (!selectedClass || !formData.sections) {
      setError("Please enter section names");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Parse sections from comma-separated string
      const sectionNames = formData.sections.split(",").map(s => s.trim()).filter(s => s);
      
      // Create sections via API
      const response = await fetch(`/api/orgs/${org?.id}/school-classes/${selectedClass.id}/sections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: sectionNames.map(name => ({ name })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to add sections");
        return;
      }

      setSuccess(`Sections added to ${selectedClass.name} successfully!`);
      setShowSectionDialog(false);
      setFormData({ name: "", gradeLevel: "", sections: "" });
      fetchClasses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClass = async () => {
    if (!deleteConfirm || !org?.id) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org.id}/school-classes/${deleteConfirm.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to delete class");
        return;
      }

      setSuccess("Class deleted successfully!");
      setDeleteConfirm(null);
      fetchClasses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const openClassDialog = (classItem: ClassData) => {
    setSelectedClass(classItem);
    setFormData({
      name: classItem.name,
      gradeLevel: classItem.gradeLevel.toString(),
      sections: classItem.sections.map(s => s.name).join(", "),
    });
    setShowSectionDialog(true);
  };

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const totalSections = classes.reduce((sum, c) => sum + c.sections.length, 0);

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/school-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Class Management</h1>
                <p className="text-gray-500">Manage classes and sections for your school (Campus Sports)</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => {
                  setFormData({ name: "", gradeLevel: "", sections: "" });
                  setShowAddDialog(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Class
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
                <BookOpen className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
                <p className="text-xs text-gray-500">Total Classes</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Layers className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{totalSections}</p>
                <p className="text-xs text-gray-500">Total Sections</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                <p className="text-xs text-gray-500">Total Students</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {classes.filter(c => c.isActive).length}
                </p>
                <p className="text-xs text-gray-500">Active Classes</p>
              </CardContent>
            </Card>
          </div>

          {/* Classes Grid */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Classes & Sections</CardTitle>
              <CardDescription>Click on a class to manage its sections</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : classes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No classes found</p>
                  <p className="text-sm">Add classes to organize students</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {classes.map((classItem) => (
                    <Card
                      key={classItem.id}
                      className="bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                              <BookOpen className={cn("w-5 h-5", primaryTextClass)} />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{classItem.name}</p>
                              <p className="text-xs text-gray-500">
                                Grade {classItem.gradeLevel}
                              </p>
                            </div>
                          </div>
                          <Badge variant={classItem.isActive ? "default" : "secondary"}>
                            {classItem.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-center mb-3">
                          <div className="p-2 rounded-lg bg-gray-50">
                            <p className="text-lg font-bold text-gray-900">{classItem.sections.length}</p>
                            <p className="text-xs text-gray-500">Sections</p>
                          </div>
                          <div className="p-2 rounded-lg bg-gray-50">
                            <p className="text-lg font-bold text-gray-900">{classItem.studentCount}</p>
                            <p className="text-xs text-gray-500">Students</p>
                          </div>
                        </div>

                        {classItem.sections.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs text-gray-500 mb-1">Sections:</p>
                            <div className="flex flex-wrap gap-1">
                              {classItem.sections.slice(0, 4).map((section) => (
                                <Badge key={section.id} variant="outline" className="text-xs">
                                  {section.name}
                                </Badge>
                              ))}
                              {classItem.sections.length > 4 && (
                                <Badge variant="outline" className="text-xs">
                                  +{classItem.sections.length - 4} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => openClassDialog(classItem)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            Manage
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteConfirm(classItem)}
                            disabled={classItem.studentCount > 0}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Class</DialogTitle>
            <DialogDescription>
              Create a new class for your school
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Class 1, Grade 10"
              />
            </div>

            <div className="space-y-2">
              <Label>Grade Level *</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={formData.gradeLevel}
                onChange={(e) => setFormData(prev => ({ ...prev, gradeLevel: e.target.value }))}
                placeholder="e.g., 1, 2, 3... 12"
              />
              <p className="text-xs text-gray-500">Enter a number from 1 to 12</p>
            </div>

            <div className="space-y-2">
              <Label>Initial Sections (optional)</Label>
              <Input
                value={formData.sections}
                onChange={(e) => setFormData(prev => ({ ...prev, sections: e.target.value }))}
                placeholder="A, B, C"
              />
              <p className="text-xs text-gray-500">Enter section names separated by commas</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAddClass}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Class
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Sections Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Sections - {selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Add sections for this class (e.g., A, B, C or Section 1, Section 2)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedClass && selectedClass.sections.length > 0 && (
              <div>
                <Label>Current Sections</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedClass.sections.map((section) => (
                    <Badge key={section.id} variant="secondary" className="text-sm">
                      {section.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Add More Sections (comma-separated)</Label>
              <Input
                value={formData.sections}
                onChange={(e) => setFormData(prev => ({ ...prev, sections: e.target.value }))}
                placeholder="A, B, C"
              />
              <p className="text-xs text-gray-500">Enter section names separated by commas</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowSectionDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAddSections}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Sections
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Class</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {deleteConfirm?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClass}
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
