"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Copy,
  Loader2,
  Calendar,
  Trophy,
  CheckCircle,
} from "lucide-react";

interface TournamentCloneProps {
  tournamentId: string;
  tournamentName: string;
  sport: string;
  series?: { id: string; name: string }[];
}

export function TournamentCloneButton({ tournamentId, tournamentName, sport, series }: TournamentCloneProps) {
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    newName: "",
    newStartDate: "",
    newEndDate: "",
    newRegDeadline: "",
    seriesId: "",
  });

  const isCornhole = sport === "cornhole";
  const primaryBgClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";

  const handleClone = async () => {
    setCloning(true);
    setError("");

    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newName: formData.newName || undefined,
          newStartDate: formData.newStartDate || undefined,
          newEndDate: formData.newEndDate || undefined,
          newRegDeadline: formData.newRegDeadline || undefined,
          seriesId: formData.seriesId || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setShowDialog(false);
        router.push(`/${sport}/admin/tournaments/${data.tournament.id}`);
      } else {
        setError(data.error || "Failed to clone tournament");
      }
    } catch (err) {
      setError("Failed to clone tournament");
    } finally {
      setCloning(false);
    }
  };

  return (
    <>
      <Button variant="outline" onClick={() => setShowDialog(true)} className="gap-2">
        <Copy className="w-4 h-4" />
        Clone Tournament
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5" />
              Clone Tournament
            </DialogTitle>
            <DialogDescription>
              Create a copy of "{tournamentName}" with the same settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="clone-name">New Tournament Name</Label>
              <Input
                id="clone-name"
                placeholder={`${tournamentName} (Copy)`}
                value={formData.newName}
                onChange={(e) => setFormData({ ...formData, newName: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clone-start">Start Date</Label>
                <Input
                  id="clone-start"
                  type="date"
                  value={formData.newStartDate}
                  onChange={(e) => setFormData({ ...formData, newStartDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clone-end">End Date</Label>
                <Input
                  id="clone-end"
                  type="date"
                  value={formData.newEndDate}
                  onChange={(e) => setFormData({ ...formData, newEndDate: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="clone-reg">Registration Deadline</Label>
              <Input
                id="clone-reg"
                type="date"
                value={formData.newRegDeadline}
                onChange={(e) => setFormData({ ...formData, newRegDeadline: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">Defaults to 7 days before start date</p>
            </div>

            {series && series.length > 0 && (
              <div className="space-y-2">
                <Label>Link to Series</Label>
                <Select value={formData.seriesId} onValueChange={(v) => setFormData({ ...formData, seriesId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a series (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {series.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              className={`${primaryBgClass} text-white`}
              onClick={handleClone} 
              disabled={cloning}
            >
              {cloning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cloning...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Clone Tournament
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
