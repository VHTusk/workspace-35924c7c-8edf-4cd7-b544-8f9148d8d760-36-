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
import {
  Globe,
  Plus,
  Loader2,
  Edit,
  MapPin,
  Users,
  Building2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

interface Zone {
  id: string;
  name: string;
  code: string;
  sector: { id: string; name: string; code: string };
  states: string[];
  isActive: boolean;
  createdAt: string;
  adminCount: number;
}

interface Sector {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  zones: {
    id: string;
    name: string;
    code: string;
    states: string[];
    isActive: boolean;
    adminCount: number;
  }[];
  adminCount: number;
}

export default function ZonesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [error, setError] = useState("");

  // Dialog states
  const [showCreateSectorDialog, setShowCreateSectorDialog] = useState(false);
  const [showCreateZoneDialog, setShowCreateZoneDialog] = useState(false);
  const [showEditZoneDialog, setShowEditZoneDialog] = useState(false);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Expanded sectors state
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());

  // Form state for sector
  const [sectorForm, setSectorForm] = useState({
    name: "",
    code: "",
  });

  // Form state for zone
  const [zoneForm, setZoneForm] = useState({
    name: "",
    code: "",
    sectorId: "",
    states: "",
  });

  useEffect(() => {
    fetchData();
  }, [sport]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch sectors
      const sectorsRes = await fetch("/api/admin/sectors");
      if (sectorsRes.ok) {
        const sectorsData = await sectorsRes.json();
        setSectors(sectorsData.sectors || []);
      } else if (sectorsRes.status === 401) {
        router.push(`/${sport}/admin/login`);
        return;
      }

      // Fetch zones
      const zonesRes = await fetch("/api/admin/zones");
      if (zonesRes.ok) {
        const zonesData = await zonesRes.json();
        setZones(zonesData.zones || []);
      }
    } catch (err) {
      setError("Failed to load zone data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSector = async () => {
    if (!sectorForm.name || !sectorForm.code) {
      setError("Name and code are required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/sectors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sectorForm),
      });

      if (response.ok) {
        const data = await response.json();
        setSectors([...sectors, { ...data.sector, zones: [], adminCount: 0 }]);
        setShowCreateSectorDialog(false);
        setSectorForm({ name: "", code: "" });
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create sector");
      }
    } catch (err) {
      setError("Failed to create sector");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneForm.name || !zoneForm.code || !zoneForm.sectorId || !zoneForm.states) {
      setError("All fields are required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const states = zoneForm.states.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

      const response = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: zoneForm.name,
          code: zoneForm.code,
          sectorId: zoneForm.sectorId,
          states,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setZones([data.zone, ...zones]);
        // Update sectors to include the new zone
        setSectors(sectors.map((s) =>
          s.id === zoneForm.sectorId
            ? { ...s, zones: [...s.zones, data.zone] }
            : s
        ));
        setShowCreateZoneDialog(false);
        setZoneForm({ name: "", code: "", sectorId: "", states: "" });
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create zone");
      }
    } catch (err) {
      setError("Failed to create zone");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateZone = async () => {
    if (!selectedZone) return;

    setSubmitting(true);
    setError("");

    try {
      const states = zoneForm.states.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

      const response = await fetch("/api/admin/zones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zoneId: selectedZone.id,
          states,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setZones(zones.map((z) => (z.id === selectedZone.id ? { ...z, states: data.zone.states } : z)));
        setShowEditZoneDialog(false);
        setSelectedZone(null);
        setZoneForm({ name: "", code: "", sectorId: "", states: "" });
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to update zone");
      }
    } catch (err) {
      setError("Failed to update zone");
    } finally {
      setSubmitting(false);
    }
  };

  const openEditZoneDialog = (zone: Zone) => {
    setSelectedZone(zone);
    setZoneForm({
      name: zone.name,
      code: zone.code,
      sectorId: zone.sector.id,
      states: zone.states.join(", "),
    });
    setShowEditZoneDialog(true);
  };

  const toggleSector = (sectorId: string) => {
    const newExpanded = new Set(expandedSectors);
    if (newExpanded.has(sectorId)) {
      newExpanded.delete(sectorId);
    } else {
      newExpanded.add(sectorId);
    }
    setExpandedSectors(newExpanded);
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

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
              <Globe className="w-6 h-6 text-primary" />
              Zone & Sector Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage geographic boundaries and admin assignments by region
            </p>
          </div>
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
              <Building2 className="w-6 h-6 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold text-foreground">{sectors.length}</p>
              <p className="text-xs text-muted-foreground">Sectors</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Globe className="w-6 h-6 mx-auto mb-2 text-amber-400" />
              <p className="text-2xl font-bold text-foreground">{zones.length}</p>
              <p className="text-xs text-muted-foreground">Zones</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <MapPin className="w-6 h-6 mx-auto mb-2 text-blue-400" />
              <p className="text-2xl font-bold text-foreground">
                {zones.reduce((acc, z) => acc + z.states.length, 0)}
              </p>
              <p className="text-xs text-muted-foreground">States Covered</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <p className="text-2xl font-bold text-foreground">
                {zones.reduce((acc, z) => acc + z.adminCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Admins Assigned</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <Button className={`${primaryBgClass} text-white`} onClick={() => setShowCreateSectorDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Sector
          </Button>
          <Button variant="outline" onClick={() => setShowCreateZoneDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Create Zone
          </Button>
        </div>

        {/* Sector/Zone Tree */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle>Sector & Zone Structure</CardTitle>
            <CardDescription>
              Click on a sector to expand and view its zones
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sectors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No sectors created yet</p>
                <p className="text-sm">Create a sector to start organizing your geographic structure</p>
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <div className="space-y-2">
                  {sectors.map((sector) => (
                    <div key={sector.id} className="border border-border/50 rounded-lg overflow-hidden">
                      {/* Sector Header */}
                      <div
                        className="p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => toggleSector(sector.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {expandedSectors.has(sector.id) ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                            <Building2 className="w-5 h-5 text-primary" />
                            <div>
                              <h4 className="font-medium text-foreground">{sector.name}</h4>
                              <p className="text-xs text-muted-foreground">Code: {sector.code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-muted/50">
                              {sector.zones.length} zones
                            </Badge>
                            <Badge variant="outline" className="bg-muted/50">
                              <Users className="w-3 h-3 mr-1" />
                              {sector.adminCount}
                            </Badge>
                            {!sector.isActive && (
                              <Badge className="bg-red-500/10 text-red-400">Inactive</Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Zones */}
                      {expandedSectors.has(sector.id) && (
                        <div className="border-t border-border/50">
                          {sector.zones.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground text-sm">
                              No zones in this sector
                            </div>
                          ) : (
                            <div className="divide-y divide-border/50">
                              {sector.zones.map((zone) => (
                                <div
                                  key={zone.id}
                                  className="p-4 pl-12 hover:bg-muted/20 transition-colors"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Globe className="w-4 h-4 text-amber-400" />
                                      <div>
                                        <h5 className="font-medium text-foreground">{zone.name}</h5>
                                        <p className="text-xs text-muted-foreground">
                                          Code: {zone.code}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <div className="flex flex-wrap gap-1 justify-end">
                                          {zone.states.slice(0, 4).map((state) => (
                                            <Badge key={state} variant="outline" className="text-xs">
                                              {state}
                                            </Badge>
                                          ))}
                                          {zone.states.length > 4 && (
                                            <Badge variant="outline" className="text-xs">
                                              +{zone.states.length - 4}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                      <Badge variant="outline" className="bg-muted/50">
                                        <Users className="w-3 h-3 mr-1" />
                                        {zone.adminCount}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => openEditZoneDialog(zone as unknown as Zone)}
                                      >
                                        <Edit className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Create Sector Dialog */}
        <Dialog open={showCreateSectorDialog} onOpenChange={setShowCreateSectorDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Sector</DialogTitle>
              <DialogDescription>
                Create a new geographic sector for admin organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sector-name">Sector Name *</Label>
                <Input
                  id="sector-name"
                  placeholder="e.g., North Region"
                  value={sectorForm.name}
                  onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sector-code">Sector Code *</Label>
                <Input
                  id="sector-code"
                  placeholder="e.g., NR"
                  value={sectorForm.code}
                  onChange={(e) => setSectorForm({ ...sectorForm, code: e.target.value.toUpperCase() })}
                  maxLength={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateSectorDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleCreateSector} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Sector
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Zone Dialog */}
        <Dialog open={showCreateZoneDialog} onOpenChange={setShowCreateZoneDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Zone</DialogTitle>
              <DialogDescription>
                Create a zone within a sector to organize states
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="zone-name">Zone Name *</Label>
                <Input
                  id="zone-name"
                  placeholder="e.g., Delhi NCR Zone"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-code">Zone Code *</Label>
                <Input
                  id="zone-code"
                  placeholder="e.g., DNR"
                  value={zoneForm.code}
                  onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value.toUpperCase() })}
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label>Parent Sector *</Label>
                <Select value={zoneForm.sectorId} onValueChange={(v) => setZoneForm({ ...zoneForm, sectorId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select sector" />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zone-states">States (comma-separated) *</Label>
                <Input
                  id="zone-states"
                  placeholder="e.g., DL, HR, UP"
                  value={zoneForm.states}
                  onChange={(e) => setZoneForm({ ...zoneForm, states: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Enter state codes separated by commas (e.g., DL, HR, UP)
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateZoneDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleCreateZone} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Zone
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Zone Dialog */}
        <Dialog open={showEditZoneDialog} onOpenChange={setShowEditZoneDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Zone: {selectedZone?.name}</DialogTitle>
              <DialogDescription>
                Update zone boundaries and state assignments
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Zone Code</p>
                <p className="font-medium">{selectedZone?.code}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Parent Sector</p>
                <p className="font-medium">{selectedZone?.sector?.name}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-zone-states">States (comma-separated)</Label>
                <Input
                  id="edit-zone-states"
                  placeholder="e.g., DL, HR, UP"
                  value={zoneForm.states}
                  onChange={(e) => setZoneForm({ ...zoneForm, states: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditZoneDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleUpdateZone} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
