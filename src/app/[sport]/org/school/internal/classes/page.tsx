"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Users,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  isActive: boolean;
  studentCount: number;
  sections: { id: string; name: string; capacity?: number }[];
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function SchoolClassesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newClass, setNewClass] = useState({
    name: "",
    gradeLevel: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchClasses();
    }
  }, [org?.id, sport]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        if (data.type !== "SCHOOL") {
          router.push(`/${sport}/org/home`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/orgs/${org?.id}/school-classes?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      }
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      setError("Failed to load classes");
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClass.name || !newClass.gradeLevel) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org?.id}/school-classes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClass.name,
          gradeLevel: parseInt(newClass.gradeLevel),
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add class");
        return;
      }

      setSuccess("Class added successfully!");
      setShowAddDialog(false);
      setNewClass({ name: "", gradeLevel: "" });
      fetchClasses();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const totalStudents = classes.reduce((sum, c) => sum + c.studentCount, 0);
  const totalSections = classes.reduce((sum, c) => sum + c.sections.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push(`/${sport}/org/school/internal`)}
            className="mb-2 text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <BookOpen className="w-4 h-4" />
                <span>Internal School</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Classes & Sections</h1>
              <p className="text-gray-500">Manage classes and sections for organizing students</p>
            </div>
            <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowAddDialog(true)}>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <BookOpen className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
              <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
              <p className="text-xs text-gray-500">Total Classes</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Layers className="w-8 h-8 mx-auto mb-2 text-purple-500" />
              <p className="text-2xl font-bold text-gray-900">{totalSections}</p>
              <p className="text-xs text-gray-500">Total Sections</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
              <p className="text-xs text-gray-500">Total Students</p>
            </CardContent>
          </Card>
        </div>

        {/* Classes List */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Classes</CardTitle>
            <CardDescription>Classes and their sections for student organization</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : classes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No classes added yet</p>
                <p className="text-sm">Add classes to organize students by grade</p>
              </div>
            ) : (
              <div className="space-y-4">
                {classes.map((schoolClass) => (
                  <div
                    key={schoolClass.id}
                    className="border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", primaryBgClass)}>
                          <BookOpen className={cn("w-5 h-5", primaryTextClass)} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{schoolClass.name}</p>
                          <p className="text-xs text-gray-500">Grade {schoolClass.gradeLevel}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className="bg-blue-100 text-blue-700">
                          {schoolClass.studentCount} students
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-700">
                          {schoolClass.sections.length} sections
                        </Badge>
                      </div>
                    </div>
                    {schoolClass.sections.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {schoolClass.sections.map((section) => (
                          <Badge key={section.id} variant="outline" className="bg-gray-50">
                            {section.name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Add Class Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Class</DialogTitle>
            <DialogDescription>Add a new class/grade to your school</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Class Name *</Label>
              <Input
                value={newClass.name}
                onChange={(e) => setNewClass((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Class 10, Grade 10"
              />
            </div>
            <div className="space-y-2">
              <Label>Grade Level *</Label>
              <Input
                type="number"
                value={newClass.gradeLevel}
                onChange={(e) => setNewClass((prev) => ({ ...prev, gradeLevel: e.target.value }))}
                placeholder="e.g., 10"
                min="1"
                max="12"
              />
              <p className="text-xs text-gray-500">Enter a number from 1-12</p>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleAddClass} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Class
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
