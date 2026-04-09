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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  BookOpen,
  Home,
  UserPlus,
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
  dob?: string;
  gender?: string;
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
  tournamentsPlayed: number;
  matchesWon: number;
  matchesLost: number;
  totalPoints: number;
}

interface SchoolClass {
  id: string;
  name: string;
  gradeLevel: number;
  sections: { id: string; name: string }[];
}

interface SchoolHouse {
  id: string;
  name: string;
  color: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function SchoolStudentsPage() {
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
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [houses, setHouses] = useState<SchoolHouse[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newStudent, setNewStudent] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    enrollmentId: "",
    classId: "",
    sectionId: "",
    houseId: "",
    gender: "",
    dob: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchData();
    }
  }, [org?.id, sport]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredStudents(
        students.filter(
          (s) =>
            s.firstName.toLowerCase().includes(query) ||
            s.lastName.toLowerCase().includes(query) ||
            s.email.toLowerCase().includes(query) ||
            s.className?.toLowerCase().includes(query) ||
            s.houseName?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredStudents(students);
    }
  }, [searchQuery, students]);

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

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch students
      const studentsResponse = await fetch(`/api/orgs/${org?.id}/students?sport=${sport.toUpperCase()}`);
      if (studentsResponse.ok) {
        const data = await studentsResponse.json();
        setStudents(data.students || []);
        setFilteredStudents(data.students || []);
      }

      // Fetch classes
      const classesResponse = await fetch(`/api/orgs/${org?.id}/school-classes?sport=${sport.toUpperCase()}`);
      if (classesResponse.ok) {
        const data = await classesResponse.json();
        setClasses(data.classes || []);
      }

      // Fetch houses
      const housesResponse = await fetch(`/api/orgs/${org?.id}/school-houses?sport=${sport.toUpperCase()}`);
      if (housesResponse.ok) {
        const data = await housesResponse.json();
        setHouses(data.houses || []);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
      setError("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.firstName || !newStudent.lastName || !newStudent.email) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org?.id}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newStudent,
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
      setNewStudent({
        firstName: "",
        lastName: "",
        email: "",
        phone: "",
        enrollmentId: "",
        classId: "",
        sectionId: "",
        houseId: "",
        gender: "",
        dob: "",
      });
      fetchData();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const getSelectedClassSections = () => {
    const selectedClass = classes.find((c) => c.id === newStudent.classId);
    return selectedClass?.sections || [];
  };

  const verifiedCount = students.filter((s) => s.isVerified).length;
  const verificationRate = students.length > 0 ? Math.round((verifiedCount / students.length) * 100) : 0;

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
              <h1 className="text-2xl font-bold text-gray-900">Students</h1>
              <p className="text-gray-500">Manage your student roster for internal school tournaments</p>
            </div>
            <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowAddDialog(true)}>
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

        {/* Important Notice */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900">Students Only</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Only students enrolled at your school can participate in school tournaments. No external or contract players allowed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
              <p className="text-2xl font-bold text-gray-900">{verifiedCount}</p>
              <p className="text-xs text-gray-500">Verified</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 mx-auto mb-2 text-amber-500" />
              <p className="text-2xl font-bold text-gray-900">{students.length - verifiedCount}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </CardContent>
          </Card>
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardContent className="p-4 text-center">
              <div className={cn("w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center", primaryBgClass)}>
                <span className={cn("text-sm font-bold", primaryTextClass)}>{verificationRate}%</span>
              </div>
              <p className="text-xs text-gray-500">Verification Rate</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search students by name, email, class, or house..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Students List */}
        <Card className="bg-white border-gray-100 shadow-sm">
          <CardHeader>
            <CardTitle className="text-gray-900">Student Roster</CardTitle>
            <CardDescription>All students eligible for internal school tournaments</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{searchQuery ? "No students match your search" : "No students added yet"}</p>
                <p className="text-sm">Add students to organize internal school tournaments</p>
              </div>
            ) : (
              <div className="border rounded-lg divide-y">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-600">
                          {student.firstName[0]}
                          {student.lastName[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {student.firstName} {student.lastName}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {student.className && (
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              {student.className}
                              {student.sectionName && ` - ${student.sectionName}`}
                            </span>
                          )}
                          {student.houseName && (
                            <span className="flex items-center gap-1">
                              <Home className="w-3 h-3" style={{ color: student.houseColor }} />
                              {student.houseName}
                            </span>
                          )}
                          <span>{student.email}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {student.isVerified ? (
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      {/* Add Student Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Student</DialogTitle>
            <DialogDescription>Add a new student to your school roster</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input
                  value={newStudent.firstName}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name *</Label>
                <Input
                  value={newStudent.lastName}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newStudent.email}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@school.edu"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={newStudent.phone}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+91 9876543210"
              />
            </div>
            <div className="space-y-2">
              <Label>Enrollment ID</Label>
              <Input
                value={newStudent.enrollmentId}
                onChange={(e) => setNewStudent((prev) => ({ ...prev, enrollmentId: e.target.value }))}
                placeholder="SCH-2024-001"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Class</Label>
                <Select
                  value={newStudent.classId}
                  onValueChange={(value) => setNewStudent((prev) => ({ ...prev, classId: value, sectionId: "" }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Section</Label>
                <Select
                  value={newStudent.sectionId}
                  onValueChange={(value) => setNewStudent((prev) => ({ ...prev, sectionId: value }))}
                  disabled={!newStudent.classId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSelectedClassSections().map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>House</Label>
              <Select
                value={newStudent.houseId}
                onValueChange={(value) => setNewStudent((prev) => ({ ...prev, houseId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select House" />
                </SelectTrigger>
                <SelectContent>
                  {houses.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: h.color }} />
                        {h.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={newStudent.gender}
                  onValueChange={(value) => setNewStudent((prev) => ({ ...prev, gender: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Male</SelectItem>
                    <SelectItem value="FEMALE">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input
                  type="date"
                  value={newStudent.dob}
                  onChange={(e) => setNewStudent((prev) => ({ ...prev, dob: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleAddStudent} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Student
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
