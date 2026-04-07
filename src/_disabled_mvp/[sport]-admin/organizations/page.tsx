"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Building2,
  Search,
  Loader2,
  MoreHorizontal,
  Ban,
  CheckCircle,
  Eye,
  AlertCircle,
  Filter,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  type: string;
  city: string | null;
  state: string | null;
  email: string;
  phone: string | null;
  isActive: boolean;
  verified: boolean;
  createdAt: string;
  _count?: { admins: number; rosterPlayers: number };
  subscription?: { status: string; endDate: string } | null;
}

interface OrgsResponse {
  organizations: Organization[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function AdminOrganizationsPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;

  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [actionDialog, setActionDialog] = useState<"suspend" | "activate" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  useEffect(() => { checkAuth(); }, [sport]);
  useEffect(() => { fetchOrganizations(); }, [sport, page, typeFilter, statusFilter]);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/admin/auth/check");
      if (!response.ok) router.push(`/${sport}/admin/login`);
    } catch { router.push(`/${sport}/admin/login`); }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        sport: sport.toUpperCase(),
        page: page.toString(),
        limit: "20",
        ...(typeFilter !== "all" && { type: typeFilter }),
        ...(statusFilter !== "all" && { status: statusFilter }),
        ...(search && { search }),
      });
      const response = await fetch(`/api/admin/organizations?${params}`);
      if (response.ok) {
        const data: OrgsResponse = await response.json();
        setOrganizations(data.organizations);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error("Failed to fetch organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchOrganizations();
  };

  const handleSuspend = async () => {
    if (!selectedOrg) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: suspendReason }),
      });
      if (response.ok) {
        fetchOrganizations();
        setActionDialog(null);
        setSelectedOrg(null);
        setSuspendReason("");
      }
    } catch (error) {
      console.error("Failed to suspend organization:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedOrg) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrg.id}/activate`, {
        method: "POST",
      });
      if (response.ok) {
        fetchOrganizations();
        setActionDialog(null);
        setSelectedOrg(null);
      }
    } catch (error) {
      console.error("Failed to activate organization:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString("en-IN");

  const getOrgTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      CLUB: "bg-purple-500/10 text-purple-400",
      SCHOOL: "bg-blue-500/10 text-blue-400",
      CORPORATE: "bg-amber-500/10 text-amber-400",
      ACADEMY: "bg-green-500/10 text-green-400",
    };
    return colors[type] || "bg-gray-500/10 text-gray-400";
  };

  if (loading && organizations.length === 0) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organization Management</h1>
            <p className="text-muted-foreground mt-1">Manage all registered organizations</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              <Building2 className="w-4 h-4 mr-1" />
              {pagination.total.toLocaleString()} total
            </Badge>
          </div>
        </div>

        {/* Filters */}
        <Card className="bg-gradient-card border-border/50 mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button onClick={handleSearch}><Search className="w-4 h-4" /></Button>
              </div>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CLUB">Club</SelectItem>
                  <SelectItem value="SCHOOL">School</SelectItem>
                  <SelectItem value="CORPORATE">Corporate</SelectItem>
                  <SelectItem value="ACADEMY">Academy</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-36">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Organizations Table */}
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Members</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getOrgTypeBadge(org.type)}>{org.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{org.city || "-"}, {org.state || "-"}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{org._count?.rosterPlayers || 0} players</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge className={org.isActive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}>
                          {org.isActive ? "Active" : "Suspended"}
                        </Badge>
                        {org.verified && (
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {org.subscription ? (
                        <Badge className={org.subscription.status === "ACTIVE" ? "bg-green-500/10 text-green-400" : "bg-gray-500/10 text-gray-400"}>
                          {org.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">None</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(org.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/${sport}/org/profile?id=${org.id}`)}>
                            <Eye className="w-4 h-4 mr-2" /> View Profile
                          </DropdownMenuItem>
                          {org.isActive ? (
                            <DropdownMenuItem onClick={() => { setSelectedOrg(org); setActionDialog("suspend"); }} className="text-red-600">
                              <Ban className="w-4 h-4 mr-2" /> Suspend
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => { setSelectedOrg(org); setActionDialog("activate"); }} className="text-green-600">
                              <CheckCircle className="w-4 h-4 mr-2" /> Activate
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {organizations.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No organizations found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pagination.limit) + 1} to {Math.min(page * pagination.limit, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">Page {page} of {pagination.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page === pagination.totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Suspend Dialog */}
        <Dialog open={actionDialog === "suspend"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Ban className="w-5 h-5 text-red-500" />
                Suspend Organization
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to suspend {selectedOrg?.name}? The organization and its members will lose access to the platform.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium">Reason for suspension</label>
              <Input
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Enter reason..."
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleSuspend} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Suspend"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Activate Dialog */}
        <Dialog open={actionDialog === "activate"} onOpenChange={() => setActionDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Activate Organization
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to reactivate {selectedOrg?.name}? The organization and its members will regain access to the platform.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setActionDialog(null)}>Cancel</Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={handleActivate} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
