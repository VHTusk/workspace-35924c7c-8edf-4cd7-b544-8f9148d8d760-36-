"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  UserPlus,
  Loader2,
  Search,
  Shield,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  Filter,
} from "lucide-react";

interface Assignment {
  id: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  role: string;
  sport: string | null;
  scope: {
    stateCode?: string | null;
    districtName?: string | null;
  };
  isActive: boolean;
  deactivatedAt: string | null;
  deactivationReason: string | null;
  trustLevel: number;
  assignedAt: string;
  expiresAt: string | null;
  permissions?: Record<string, boolean>;
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  elo?: number;
}

export default function AssignmentsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");

  // Dialog states
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchResult | null>(null);
  const [searching, setSearching] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    role: "",
    assignSport: "",
    stateCode: "",
    districtName: "",
    reason: "",
  });

  // Filter state
  const [filterRole, setFilterRole] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  useEffect(() => {
    fetchAssignments();
  }, [sport]);

  const fetchAssignments = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("sport", sport.toUpperCase());
      if (filterRole) params.append("role", filterRole);
      if (filterStatus) params.append("isActive", filterStatus);

      const response = await fetch(`/api/admin/assignments?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setAssignments(data.assignments || []);
      } else if (response.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      } else {
        setError("Failed to load assignments");
      }
    } catch (err) {
      setError("Failed to load assignments");
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/search/players?q=${encodeURIComponent(query)}&sport=${sport.toUpperCase()}`);
      if (response.ok) {
        const data = await response.json();
        setSearchResults(data.data?.results || data.results || []);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSelectedUser(null);
    // Debounce search
    setTimeout(() => searchUsers(value), 300);
  };

  const handleAssign = async () => {
    if (!selectedUser || !formData.role) {
      setError("Please select a user and role");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          adminRole: formData.role,
          sport: formData.assignSport || sport.toUpperCase(),
          stateCode: formData.stateCode || undefined,
          districtName: formData.districtName || undefined,
          reason: formData.reason || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setAssignments([data.assignment, ...assignments]);
        setShowAssignDialog(false);
        setSelectedUser(null);
        setSearchQuery("");
        setSearchResults([]);
        setFormData({
          role: "",
          assignSport: "",
          stateCode: "",
          districtName: "",
          reason: "",
        });
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create assignment");
      }
    } catch (err) {
      setError("Failed to create assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      SUPER_ADMIN: "bg-red-500/10 text-red-400 border-red-500/30",
      SPORT_ADMIN: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      STATE_ADMIN: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      DISTRICT_ADMIN: "bg-teal-500/10 text-teal-400 border-teal-500/30",
      TOURNAMENT_DIRECTOR: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    };
    return colors[role] || "bg-gray-500/10 text-gray-400 border-gray-500/30";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  // Separate active and inactive assignments
  const activeAssignments = assignments.filter((a) => a.isActive);
  const inactiveAssignments = assignments.filter((a) => !a.isActive);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-primary" />
              Director Assignments
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage admin and tournament director assignments
            </p>
          </div>
          <Button className={`${primaryBgClass} text-white`} onClick={() => setShowAssignDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            New Assignment
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Shield className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-foreground">{activeAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Active Assignments</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <p className="text-2xl font-bold text-foreground">
                {activeAssignments.filter((a) => a.role === "TOURNAMENT_DIRECTOR").length}
              </p>
              <p className="text-xs text-muted-foreground">Tournament Directors</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <p className="text-2xl font-bold text-foreground">
                {activeAssignments.filter((a) => a.scope.stateCode).length}
              </p>
              <p className="text-xs text-muted-foreground">Regional Admins</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <XCircle className="w-6 h-6 mx-auto mb-2 text-red-400" />
              <p className="text-2xl font-bold text-foreground">{inactiveAssignments.length}</p>
              <p className="text-xs text-muted-foreground">Deactivated</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Filter:</span>
              </div>
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Roles</SelectItem>
                  <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                  <SelectItem value="SPORT_ADMIN">Sport Admin</SelectItem>
                  <SelectItem value="STATE_ADMIN">State Admin</SelectItem>
                  <SelectItem value="DISTRICT_ADMIN">District Admin</SelectItem>
                  <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={fetchAssignments}>
                Apply Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Assignments Tabs */}
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <CheckCircle className="w-4 h-4" />
              Active ({activeAssignments.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2">
              <Clock className="w-4 h-4" />
              History ({inactiveAssignments.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Active Assignments</CardTitle>
                <CardDescription>
                  Current admin and director assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No active assignments</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {activeAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-foreground">
                                  {assignment.user.firstName} {assignment.user.lastName}
                                </h4>
                                <p className="text-xs text-muted-foreground">{assignment.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={getRoleBadgeColor(assignment.role)} variant="outline">
                                {assignment.role.replace(/_/g, " ")}
                              </Badge>
                              {assignment.sport && (
                                <Badge variant="outline" className="bg-muted/50">
                                  {assignment.sport}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-3 border-t border-border/50">
                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              {assignment.scope.stateCode && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {assignment.scope.stateCode}
                                  {assignment.scope.districtName && `, ${assignment.scope.districtName}`}
                                </span>
                              )}

                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Assigned: {formatDate(assignment.assignedAt)}
                              </span>
                              {assignment.expiresAt && (
                                <span className="flex items-center gap-1 text-amber-400">
                                  Expires: {formatDate(assignment.expiresAt)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Assignment History</CardTitle>
                <CardDescription>
                  Past and deactivated assignments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inactiveAssignments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No assignment history</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-3">
                      {inactiveAssignments.map((assignment) => (
                        <div
                          key={assignment.id}
                          className="p-4 rounded-lg bg-muted/20 border border-border/30"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10 opacity-50">
                                <AvatarFallback className="bg-muted text-muted-foreground">
                                  {assignment.user.firstName[0]}{assignment.user.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <h4 className="font-medium text-muted-foreground">
                                  {assignment.user.firstName} {assignment.user.lastName}
                                </h4>
                                <p className="text-xs text-muted-foreground">{assignment.user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className="bg-gray-500/10 text-gray-400 border-gray-500/30" variant="outline">
                                {assignment.role.replace(/_/g, " ")}
                              </Badge>
                              <Badge className="bg-red-500/10 text-red-400 border-red-500/30" variant="outline">
                                Deactivated
                              </Badge>
                            </div>
                          </div>

                          {assignment.deactivationReason && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <p className="text-sm text-muted-foreground">
                                Reason: {assignment.deactivationReason}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Assign Dialog */}
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Admin Assignment</DialogTitle>
              <DialogDescription>
                Search for a user and assign them an admin role
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* User Search */}
              <div className="space-y-2">
                <Label>Search User *</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin" />
                  )}
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && !selectedUser && (
                <ScrollArea className="h-40 border rounded-lg">
                  <div className="divide-y">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="p-3 hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery(`${user.firstName} ${user.lastName}`);
                          setSearchResults([]);
                        }}
                      >
                        <p className="font-medium text-foreground">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Selected User */}
              {selectedUser && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(null);
                        setSearchQuery("");
                      }}
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Role Selection */}
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                    <SelectItem value="SPORT_ADMIN">Sport Admin</SelectItem>
                    <SelectItem value="STATE_ADMIN">State Admin</SelectItem>
                    <SelectItem value="DISTRICT_ADMIN">District Admin</SelectItem>
                    <SelectItem value="TOURNAMENT_DIRECTOR">Tournament Director</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sport Selection */}
              <div className="space-y-2">
                <Label>Sport</Label>
                <Select value={formData.assignSport} onValueChange={(v) => setFormData({ ...formData, assignSport: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder={sport.toUpperCase()} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                    <SelectItem value="DARTS">Darts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* State Code (for STATE_ADMIN, DISTRICT_ADMIN) */}
              {(formData.role === "STATE_ADMIN" || formData.role === "DISTRICT_ADMIN") && (
                <div className="space-y-2">
                  <Label>State Code</Label>
                  <Input
                    placeholder="e.g., RJ, MH, DL"
                    value={formData.stateCode}
                    onChange={(e) => setFormData({ ...formData, stateCode: e.target.value.toUpperCase() })}
                    maxLength={5}
                  />
                </div>
              )}

              {/* District Name (for DISTRICT_ADMIN) */}
              {formData.role === "DISTRICT_ADMIN" && (
                <div className="space-y-2">
                  <Label>District Name</Label>
                  <Input
                    placeholder="e.g., Jaipur, Mumbai"
                    value={formData.districtName}
                    onChange={(e) => setFormData({ ...formData, districtName: e.target.value })}
                  />
                </div>
              )}

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  placeholder="e.g., Promoted to state admin"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                Cancel
              </Button>
              <Button
                className={`${primaryBgClass} text-white`}
                onClick={handleAssign}
                disabled={submitting || !selectedUser || !formData.role}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
