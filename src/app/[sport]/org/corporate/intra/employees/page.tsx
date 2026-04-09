"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationLayoutWrapper from "@/components/org/organization-layout-wrapper";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Users,
  Plus,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Building2,
  UserPlus,
  LayoutDashboard,
  Trophy,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";


interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string;
  designation?: string;
  isVerified: boolean;
  isActive: boolean;
  joinedAt: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function IntraEmployeesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [org, setOrg] = useState<OrgData | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    designation: "",
  });

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50" : "bg-teal-50";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    fetchOrg();
    fetchEmployees();
  }, [sport]);

  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      setFilteredEmployees(
        employees.filter(
          (e) =>
            e.firstName.toLowerCase().includes(query) ||
            e.lastName.toLowerCase().includes(query) ||
            e.email.toLowerCase().includes(query) ||
            e.department?.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchQuery, employees]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const orgResponse = await fetch("/api/org/me");
      if (orgResponse.ok) {
        const orgData = await orgResponse.json();
        const response = await fetch(`/api/orgs/${orgData.id}/employees?sport=${sport.toUpperCase()}`);
        if (response.ok) {
          const data = await response.json();
          setEmployees(data.employees || []);
          setFilteredEmployees(data.employees || []);
        }
      }
    } catch (err) {
      console.error("Failed to fetch employees:", err);
      setError("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async () => {
    if (!newEmployee.firstName || !newEmployee.lastName || !newEmployee.email) {
      setError("Please fill in all required fields");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/orgs/${org?.id}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newEmployee,
          sport: sport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to add employee");
        return;
      }

      setSuccess("Employee added successfully!");
      setShowAddDialog(false);
      setNewEmployee({ firstName: "", lastName: "", email: "", department: "", designation: "" });
      fetchEmployees();
    } catch (err) {
      setError("An error occurred");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const verifiedCount = employees.filter((e) => e.isVerified).length;
  const verificationRate = employees.length > 0 ? Math.round((verifiedCount / employees.length) * 100) : 0;

  return (
    <OrganizationLayoutWrapper>
      <div className="space-y-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/corporate/intra`)}
              className="mb-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <Building2 className="w-4 h-4" />
                  <span>Internal</span>
                </div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employees</h1>
                <p className="text-gray-500 dark:text-gray-400">Manage your employee roster for internal tournaments</p>
              </div>
              <Button className={cn("text-white", primaryBtnClass)} onClick={() => setShowAddDialog(true)}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Employee
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
            <Alert className="mb-4 bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-800 dark:text-emerald-300">
              <CheckCircle className="w-4 h-4" />
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{employees.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Employees</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{verifiedCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Verified</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{employees.length - verifiedCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pending Verification</p>
              </CardContent>
            </Card>
            <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
              <CardContent className="p-4 text-center">
                <div className={cn("w-8 h-8 mx-auto mb-2 rounded-full flex items-center justify-center", primaryBgClass)}>
                  <span className={cn("text-sm font-bold", primaryTextClass)}>{verificationRate}%</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Verification Rate</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search employees..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Employees List */}
          <Card className="bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 dark:text-white">Employee Roster</CardTitle>
              <CardDescription>All employees eligible for intra-corporate tournaments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{searchQuery ? "No employees match your search" : "No employees added yet"}</p>
                  <p className="text-sm">Add employees to organize internal tournaments</p>
                </div>
              ) : (
                <div className="border rounded-lg divide-y dark:border-gray-700 dark:divide-gray-700">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                            {employee.firstName[0]}
                            {employee.lastName[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {employee.firstName} {employee.lastName}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                            {employee.department && <span>{employee.department}</span>}
                            {employee.department && employee.designation && <span>•</span>}
                            {employee.designation && <span>{employee.designation}</span>}
                            {(employee.department || employee.designation) && <span>•</span>}
                            <span>{employee.email}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {employee.isVerified ? (
                          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Add Employee Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>Add a new employee to your organization</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">First Name *</label>
                <Input
                  value={newEmployee.firstName}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Last Name *</label>
                <Input
                  value={newEmployee.lastName}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email *</label>
              <Input
                type="email"
                value={newEmployee.email}
                onChange={(e) => setNewEmployee((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john.doe@company.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Department</label>
                <Input
                  value={newEmployee.department}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, department: e.target.value }))}
                  placeholder="Engineering"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Designation</label>
                <Input
                  value={newEmployee.designation}
                  onChange={(e) => setNewEmployee((prev) => ({ ...prev, designation: e.target.value }))}
                  placeholder="Software Engineer"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button className={cn("text-white", primaryBtnClass)} onClick={handleAddEmployee} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Employee
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </OrganizationLayoutWrapper>
  );
}
