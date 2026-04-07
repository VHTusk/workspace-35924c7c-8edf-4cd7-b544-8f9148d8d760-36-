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
import { Switch } from "@/components/ui/switch";
import {
  FileText,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Copy,
  Users,
  IndianRupee,
  Trophy,
  RefreshCw,
} from "lucide-react";

interface Template {
  id: string;
  name: string;
  sport: string;
  type: string;
  scope: string;
  maxPlayers: number;
  entryFee: number;
  bracketFormat: string;
  scoringMode: string;
  isActive: boolean;
  isRecurring: boolean;
  timesUsed: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function TournamentTemplatesPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportType = sport.toUpperCase() as "CORNHOLE" | "DARTS";

  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [error, setError] = useState("");

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "INDIVIDUAL",
    scope: "OPEN",
    maxPlayers: 32,
    entryFee: 0,
    earlyBirdFee: null as number | null,
    earlyBirdDeadlineDays: 7,
    groupDiscountMin: null as number | null,
    groupDiscountPercent: null as number | null,
    bracketFormat: "SINGLE_ELIMINATION",
    ageMin: null as number | null,
    ageMax: null as number | null,
    gender: "ANY",
    scoringMode: "STAFF_ONLY",
    maxPlayersPerOrg: null as number | null,
    prizePoolDefault: null as number | null,
    regDeadlineDays: 7,
    durationDays: 1,
    isPublic: true,
  });

  useEffect(() => {
    fetchTemplates();
  }, [sport]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/tournament-templates?sport=${sportType}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      } else if (response.status === 401) {
        router.push(`/${sport}/org/login`);
      } else {
        setError("Failed to load templates");
      }
    } catch (err) {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "INDIVIDUAL",
      scope: "OPEN",
      maxPlayers: 32,
      entryFee: 0,
      earlyBirdFee: null,
      earlyBirdDeadlineDays: 7,
      groupDiscountMin: null,
      groupDiscountPercent: null,
      bracketFormat: "SINGLE_ELIMINATION",
      ageMin: null,
      ageMax: null,
      gender: "ANY",
      scoringMode: "STAFF_ONLY",
      maxPlayersPerOrg: null,
      prizePoolDefault: null,
      regDeadlineDays: 7,
      durationDays: 1,
      isPublic: true,
    });
  };

  const handleCreate = async () => {
    if (!formData.name) {
      setError("Template name is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/tournament-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          sport: sportType,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates([data.template, ...templates]);
        setShowCreateDialog(false);
        resetForm();
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create template");
      }
    } catch (err) {
      setError("Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedTemplate || !formData.name) {
      setError("Template name is required");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/tournament-templates/${selectedTemplate.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setTemplates(templates.map((t) => (t.id === selectedTemplate.id ? { ...t, ...data.template } : t)));
        setShowEditDialog(false);
        setSelectedTemplate(null);
        resetForm();
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to update template");
      }
    } catch (err) {
      setError("Failed to update template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const response = await fetch(`/api/tournament-templates/${templateId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setTemplates(templates.filter((t) => t.id !== templateId));
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to delete template");
      }
    } catch (err) {
      setError("Failed to delete template");
    }
  };

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      scope: template.scope,
      maxPlayers: template.maxPlayers,
      entryFee: template.entryFee,
      earlyBirdFee: null,
      earlyBirdDeadlineDays: 7,
      groupDiscountMin: null,
      groupDiscountPercent: null,
      bracketFormat: template.bracketFormat,
      ageMin: null,
      ageMax: null,
      gender: "ANY",
      scoringMode: template.scoringMode,
      maxPlayersPerOrg: null,
      prizePoolDefault: null,
      regDeadlineDays: 7,
      durationDays: 1,
      isPublic: true,
    });
    setShowEditDialog(true);
  };

  const handleCreateTournament = async (templateId: string) => {
    try {
      const response = await fetch(`/api/tournament-templates/${templateId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: undefined,
          startDate: undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/${sport}/admin/tournaments/${data.tournament.id}`);
      } else {
        const errData = await response.json();
        setError(errData.error || "Failed to create tournament");
      }
    } catch (err) {
      setError("Failed to create tournament");
    }
  };

  const getScopeBadge = (scope: string) => {
    const colors: Record<string, string> = {
      OPEN: "bg-green-500/10 text-green-400 border-green-500/30",
      INTRA_ORG: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      INTER_ORG: "bg-blue-500/10 text-blue-400 border-blue-500/30",
      CITY: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      DISTRICT: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      STATE: "bg-red-500/10 text-red-400 border-red-500/30",
    };
    return colors[scope] || "bg-muted text-muted-foreground border-border";
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
            <h1 className="text-2xl font-bold text-foreground">Tournament Templates</h1>
            <p className="text-muted-foreground mt-1">
              Create and manage reusable tournament configurations
            </p>
          </div>
          <Button className={`${primaryBgClass} text-white`} onClick={() => { resetForm(); setShowCreateDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Create Template
          </Button>
        </div>

        {error && (
          <div className="bg-red-500/10 text-red-400 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="py-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Templates Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create templates to quickly set up recurring tournaments
              </p>
              <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className={`${primaryBgClass} text-white`}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
              <Card key={template.id} className="bg-gradient-card border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className={getScopeBadge(template.scope)} variant="outline">
                          {template.scope.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline" className="bg-muted/50">
                          {template.type}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-500"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {template.maxPlayers}
                    </span>
                    <span className="flex items-center gap-1">
                      <IndianRupee className="w-4 h-4" />
                      {template.entryFee}
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="w-4 h-4" />
                      {template.bracketFormat.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <RefreshCw className="w-3 h-3" />
                      Used {template.timesUsed} times
                    </span>
                    {template.lastUsedAt && (
                      <span>Last: {new Date(template.lastUsedAt).toLocaleDateString()}</span>
                    )}
                  </div>

                  <div className="pt-3 border-t border-border/50">
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => handleCreateTournament(template.id)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Create Tournament
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Template Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Create Tournament Template</DialogTitle>
              <DialogDescription>
                Save tournament settings as a reusable template
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Monthly Open Tournament"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tournament Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="TEAM">Team</SelectItem>
                      <SelectItem value="DOUBLES">Doubles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="INTRA_ORG">Intra-Org</SelectItem>
                      <SelectItem value="INTER_ORG">Inter-Org</SelectItem>
                      <SelectItem value="CITY">City</SelectItem>
                      <SelectItem value="DISTRICT">District</SelectItem>
                      <SelectItem value="STATE">State</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Players</Label>
                  <Input
                    type="number"
                    value={formData.maxPlayers}
                    onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) || 32 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Entry Fee (₹)</Label>
                  <Input
                    type="number"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bracket Format</Label>
                  <Select value={formData.bracketFormat} onValueChange={(v) => setFormData({ ...formData, bracketFormat: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_ELIMINATION">Single Elimination</SelectItem>
                      <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="SWISS">Swiss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scoring Mode</Label>
                  <Select value={formData.scoringMode} onValueChange={(v) => setFormData({ ...formData, scoringMode: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF_ONLY">Staff Only</SelectItem>
                      <SelectItem value="PLAYER_SELF">Player Self-Report</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Registration Deadline (days before)</Label>
                  <Input
                    type="number"
                    value={formData.regDeadlineDays}
                    onChange={(e) => setFormData({ ...formData, regDeadlineDays: parseInt(e.target.value) || 7 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    value={formData.durationDays}
                    onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value) || 1 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Gender Restriction</Label>
                  <Select value={formData.gender} onValueChange={(v) => setFormData({ ...formData, gender: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANY">Any</SelectItem>
                      <SelectItem value="MALE">Male Only</SelectItem>
                      <SelectItem value="FEMALE">Female Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Prize Pool Default (₹)</Label>
                  <Input
                    type="number"
                    value={formData.prizePoolDefault || ""}
                    onChange={(e) => setFormData({ ...formData, prizePoolDefault: e.target.value ? parseInt(e.target.value) : null })}
                    placeholder="Optional"
                  />
                </div>

                <div className="col-span-2 flex items-center space-x-2">
                  <Switch
                    id="isPublic"
                    checked={formData.isPublic}
                    onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                  />
                  <Label htmlFor="isPublic">Public tournament (visible to all)</Label>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleCreate} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Create Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Template Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Edit Template</DialogTitle>
              <DialogDescription>
                Update template settings
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="grid grid-cols-2 gap-4 py-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="edit-name">Template Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tournament Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                      <SelectItem value="TEAM">Team</SelectItem>
                      <SelectItem value="DOUBLES">Doubles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scope</Label>
                  <Select value={formData.scope} onValueChange={(v) => setFormData({ ...formData, scope: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="INTRA_ORG">Intra-Org</SelectItem>
                      <SelectItem value="INTER_ORG">Inter-Org</SelectItem>
                      <SelectItem value="CITY">City</SelectItem>
                      <SelectItem value="DISTRICT">District</SelectItem>
                      <SelectItem value="STATE">State</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Max Players</Label>
                  <Input
                    type="number"
                    value={formData.maxPlayers}
                    onChange={(e) => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) || 32 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Entry Fee (₹)</Label>
                  <Input
                    type="number"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bracket Format</Label>
                  <Select value={formData.bracketFormat} onValueChange={(v) => setFormData({ ...formData, bracketFormat: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SINGLE_ELIMINATION">Single Elimination</SelectItem>
                      <SelectItem value="DOUBLE_ELIMINATION">Double Elimination</SelectItem>
                      <SelectItem value="ROUND_ROBIN">Round Robin</SelectItem>
                      <SelectItem value="SWISS">Swiss</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Scoring Mode</Label>
                  <Select value={formData.scoringMode} onValueChange={(v) => setFormData({ ...formData, scoringMode: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="STAFF_ONLY">Staff Only</SelectItem>
                      <SelectItem value="PLAYER_SELF">Player Self-Report</SelectItem>
                      <SelectItem value="HYBRID">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button className={`${primaryBgClass} text-white`} onClick={handleEdit} disabled={submitting}>
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
