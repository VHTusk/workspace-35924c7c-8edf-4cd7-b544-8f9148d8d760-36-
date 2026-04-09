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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  Mail,
  Phone,
  ArrowLeft,
  Filter,
  BookOpen,
  Home,
  Edit,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  userId?: string;
  enrollmentId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  classId?: string;
  className?: string;
  sectionId?: string;
  sectionName?: string;
  houseId?: string;
  houseName?: string;
  houseColor?: string;
  isVerified: boolean;
  status: string;
  joinedAt: string;
  tournamentsPlayed?: number;
  matchesWon?: number;
  matchesLost?: number;
  totalPoints?: number;
}

interface ClassData {
  id: string;
  name: string;
  gradeLevel: number;
  sections: { id: string; name: string }[];
}

interface HouseData {
  id: string;
  name: string;
  color: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function StudentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [houses, setHouses] = useState<HouseData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [houseFilter, setHouseFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    enrollmentId: "",
    classId: "",
    sectionId: "",
    houseId: "",
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
    try {
      const response = await fetch(`/api/orgs/${org.id}/school-classes?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setClasses(data.classes || []);
      }
    } catch (err) {
      console.error("Failed to fetch classes:", err);
    }
  }, [org?.id, sport]);

  const fetchHouses = useCallback(async () => {
    if (!org?.id) return;
    try {
      const response = await fetch(`/api/orgs/${org.id}/school-houses?sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setHouses(data.houses || []);
      }
    } catch (err) {
      console.error("Failed to fetch houses:", err);
    }
  }, [org?.id, sport]);

  const fetchStudents = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sport: sport.toUpperCase(),
      });
      if (searchQuery) params.append("search", searchQuery);
      if (classFilter) params.append("classId", classFilter);
      if (houseFilter) params.append("houseId", houseFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetch(`/api/orgs/${org.id}/students?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setStudents(data.students || []);
      } else {
        setError("Failed to load students");
      }
    } catch (err) {
      console.error("Failed to fetch students:", err);
      setError("Failed to load students");
    } finally {
      setLoading(false);
    }
  }, [org?.id, sport, searchQuery, classFilter, houseFilter, statusFilter]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  useEffect(() => {
    if (org?.id) {
      fetchClasses();
      fetchHouses();
      fetchStudents();
    }
  }, [org?.id, fetchClasses, fetchHouses, fetchStudents]);

  const handleAddStudent = async () => {
    if (!formData.email || !formData.firstName || !formData.lastName) {
      setError("Please fill in all required fields");
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
      const response = await fetch(`/api/orgs/${org.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add student");
        return;
      }

      setSuccess("Student added successfully!");
      setShowAddDialog(false);
      setFormData({
        email: "",
        firstName: "",
        lastName: "",
        phone: "",
        enrollmentId: "",
        classId: "",
        sectionId: "",
        houseId: "",
      });
      fetchStudents();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = () => {
    fetchStudents();
  };

  const resetForm = () => {
    setFormData({
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      enrollmentId: "",
      classId: "",
      sectionId: "",
      houseId: "",
    });
    setEditingStudent(null);
  };

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      email: student.email,
      firstName: student.firstName,
      lastName: student.lastName,
      phone: student.phone || "",
      enrollmentId: student.enrollmentId || "",
      classId: student.classId || "",
      sectionId: student.sectionId || "",
      houseId: student.houseId || "",
    });
    setShowAddDialog(true);
  };

  const selectedClass = classes.find(c => c.id === formData.classId);

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
                <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
                <p className="text-gray-500">Manage students for internal tournaments (Campus Sports)</p>
              </div>
              <Button
                className={cn("text-white", primaryBtnClass)}
                onClick={() => {
                  resetForm();
                  setShowAddDialog(true);
                }}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Student
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
                <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">{students.length}</p>
                <p className="text-xs text-gray-500">Total Students</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {students.filter(s => s.isVerified).length}
                </p>
                <p className="text-xs text-gray-500">Verified</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
                <p className="text-xs text-gray-500">Classes</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Home className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">{houses.length}</p>
                <p className="text-xs text-gray-500">Houses</p>
              </CardContent>
            </Card>
          </div>

          {/* Search & Filter */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search by name, email, or enrollment ID..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      className="pl-10"
                    />
                  </div>
                </div>
                {classes.length > 0 && (
                  <Select value={classFilter} onValueChange={setClassFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Classes</SelectItem>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {houses.length > 0 && (
                  <Select value={houseFilter} onValueChange={setHouseFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="All Houses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Houses</SelectItem>
                      {houses.map((house) => (
                        <SelectItem key={house.id} value={house.id}>{house.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Status</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="GRADUATED">Graduated</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} className={cn("text-white", primaryBtnClass)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filter
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Students List */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900">Student Roster</CardTitle>
              <CardDescription>Students eligible for internal tournaments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No students found</p>
                  <p className="text-sm">Add students to organize internal tournaments</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y max-h-[600px] overflow-y-auto">
                  {students.map((student) => (
                    <div key={student.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {student.firstName[0]}{student.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {student.firstName} {student.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            {student.enrollmentId && (
                              <span className="bg-gray-100 px-2 py-0.5 rounded text-xs">
                                ID: {student.enrollmentId}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {student.email}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {student.className && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {student.className}
                                {student.sectionName && ` - ${student.sectionName}`}
                              </span>
                            )}
                            {student.houseName && (
                              <span 
                                className="flex items-center gap-1"
                                style={{ color: student.houseColor || undefined }}
                              >
                                <Home className="w-3 h-3" />
                                {student.houseName}
                              </span>
                            )}
                            {student.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {student.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {student.isVerified ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">
                            <Mail className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                        <Badge variant={student.status === 'ACTIVE' ? 'default' : 'secondary'}>
                          {student.status}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(student)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add/Edit Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStudent ? 'Edit Student' : 'Add Student'}</DialogTitle>
            <DialogDescription>
              {editingStudent ? 'Update student information' : 'Add a student to your school for internal tournaments'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@school.edu"
                disabled={!!editingStudent}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2">
                <Label>Enrollment ID</Label>
                <Input
                  value={formData.enrollmentId}
                  onChange={(e) => setFormData(prev => ({ ...prev, enrollmentId: e.target.value }))}
                  placeholder="2024001"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={formData.classId} onValueChange={(value) => setFormData(prev => ({ ...prev, classId: value, sectionId: "" }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select value={formData.sectionId} onValueChange={(value) => setFormData(prev => ({ ...prev, sectionId: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedClass?.sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>{section.name}</SelectItem>
                    )) || <SelectItem value="" disabled>No sections available</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>House</Label>
              <Select value={formData.houseId} onValueChange={(value) => setFormData(prev => ({ ...prev, houseId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select House" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((house) => (
                    <SelectItem key={house.id} value={house.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: house.color }}
                        />
                        {house.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => {
              setShowAddDialog(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleAddStudent}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {editingStudent ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  {editingStudent ? 'Update Student' : 'Add Student'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
