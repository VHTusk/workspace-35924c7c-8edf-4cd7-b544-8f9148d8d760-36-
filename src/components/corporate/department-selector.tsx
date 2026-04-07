"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Department {
  id: string;
  name: string;
  code: string | null;
  totalEmployees: number;
  activePlayers: number;
}

interface DepartmentSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  orgId: string;
  sport: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  showEmployeeCount?: boolean;
  allowCreate?: boolean;
}

export function DepartmentSelector({
  value,
  onChange,
  orgId,
  sport,
  placeholder = "Select department",
  disabled = false,
  required = false,
  className,
  showEmployeeCount = true,
  allowCreate = true,
}: DepartmentSelectorProps) {
  const params = useParams();
  const currentSport = sport || (params.sport as string);
  const isCornhole = currentSport === "cornhole";

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Inline create department
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const fetchDepartments = useCallback(async () => {
    if (!orgId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/org/${orgId}/departments?sport=${currentSport.toUpperCase()}`
      );

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.departments || []);
      } else {
        setError("Failed to load departments");
      }
    } catch (err) {
      console.error("Failed to fetch departments:", err);
      setError("Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, [orgId, currentSport]);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleCreateDepartment = async () => {
    if (!newDeptName.trim()) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/org/${orgId}/departments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDeptName.trim(),
          code: newDeptCode.trim() || undefined,
          sport: currentSport.toUpperCase(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Add new department to list
        setDepartments([...departments, data.department]);
        // Select the new department
        onChange(data.department.id);
        // Close dialog and reset form
        setShowCreateDialog(false);
        setNewDeptName("");
        setNewDeptCode("");
      } else {
        setError(data.error || "Failed to create department");
      }
    } catch (err) {
      console.error("Failed to create department:", err);
      setError("Failed to create department");
    } finally {
      setSaving(false);
    }
  };

  const selectedDepartment = departments.find((d) => d.id === value);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 p-2 border rounded-md bg-gray-50", className)}>
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
        <span className="text-sm text-gray-500">Loading departments...</span>
      </div>
    );
  }

  if (error && departments.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 p-2 border border-red-200 rounded-md bg-red-50", className)}>
        <AlertCircle className="w-4 h-4 text-red-500" />
        <span className="text-sm text-red-600">{error}</span>
        <Button variant="ghost" size="sm" onClick={fetchDepartments}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        required={required}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={placeholder}>
            {selectedDepartment && (
              <div className="flex items-center gap-2">
                <Building2 className={cn("w-4 h-4", primaryTextClass)} />
                <span>{selectedDepartment.name}</span>
                {selectedDepartment.code && (
                  <Badge variant="outline" className="text-xs font-mono">
                    {selectedDepartment.code}
                  </Badge>
                )}
                {showEmployeeCount && (
                  <span className="text-xs text-gray-500">
                    ({selectedDepartment.totalEmployees} employees)
                  </span>
                )}
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Create new department option */}
          {allowCreate && (
            <div className="p-1 border-b">
              <Button
                variant="ghost"
                className={cn("w-full justify-start text-sm", primaryTextClass)}
                onClick={() => setShowCreateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Create New Department
              </Button>
            </div>
          )}

          {/* Department list */}
          {departments.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-500">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No departments found</p>
              {allowCreate && (
                <Button
                  variant="link"
                  className={cn("p-0 h-auto mt-1", primaryTextClass)}
                  onClick={() => setShowCreateDialog(true)}
                >
                  Create your first department
                </Button>
              )}
            </div>
          ) : (
            departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>{dept.name}</span>
                  {dept.code && (
                    <Badge variant="outline" className="text-xs font-mono">
                      {dept.code}
                    </Badge>
                  )}
                  {showEmployeeCount && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      {dept.totalEmployees}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Create Department Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Department</DialogTitle>
            <DialogDescription>
              Add a new department to your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deptName">Department Name *</Label>
              <Input
                id="deptName"
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g., Engineering, Sales, HR"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="deptCode">Department Code</Label>
              <Input
                id="deptCode"
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                placeholder="e.g., ENG, SAL, HR"
                maxLength={10}
              />
              <p className="text-xs text-gray-500">Short code (max 10 characters)</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              className={cn("text-white", primaryBtnClass)}
              onClick={handleCreateDepartment}
              disabled={saving || !newDeptName.trim()}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Department
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact variant for inline forms
export function DepartmentSelectorCompact({
  value,
  onChange,
  orgId,
  sport,
  placeholder = "Select department",
  disabled = false,
  className,
}: Omit<DepartmentSelectorProps, "showEmployeeCount" | "allowCreate" | "required">) {
  const params = useParams();
  const currentSport = sport || (params.sport as string);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;

    const fetchDepartments = async () => {
      try {
        const response = await fetch(
          `/api/org/${orgId}/departments?sport=${currentSport.toUpperCase()}`
        );

        if (response.ok) {
          const data = await response.json();
          setDepartments(data.departments || []);
        }
      } catch (err) {
        console.error("Failed to fetch departments:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [orgId, currentSport]);

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1 text-sm text-gray-500", className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("h-8 text-sm", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {departments.map((dept) => (
          <SelectItem key={dept.id} value={dept.id}>
            {dept.name}
            {dept.code && ` (${dept.code})`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default DepartmentSelector;
