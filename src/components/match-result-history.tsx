"use client";

import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { History, ArrowRight, User, Clock } from "lucide-react";

interface HistoryEntry {
  id: string;
  oldScoreA: number | null;
  oldScoreB: number | null;
  newScoreA: number | null;
  newScoreB: number | null;
  reason: string;
  editedAt: string;
  editedBy?: {
    firstName: string;
    lastName: string;
  };
}

interface MatchResultHistoryProps {
  history: HistoryEntry[];
  showTitle?: boolean;
}

export default function MatchResultHistory({ history, showTitle = false }: MatchResultHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No edit history available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showTitle && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
          <History className="w-4 h-4" />
          <span>Edit History</span>
        </div>
      )}
      
      {history.map((entry, index) => (
        <div
          key={entry.id}
          className={`relative pl-6 pb-4 ${
            index !== history.length - 1 ? "border-l border-border/50 ml-3" : ""
          }`}
        >
          {/* Timeline dot */}
          <div className="absolute left-0 top-0 w-6 h-6 -translate-x-1/2 rounded-full bg-muted flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
          </div>

          <div className="bg-muted/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3 h-3" />
                {new Date(entry.editedAt).toLocaleString()}
              </div>
              {entry.editedBy && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="w-3 h-3" />
                  {entry.editedBy.firstName} {entry.editedBy.lastName}
                </div>
              )}
            </div>

            {/* Score Change */}
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                  {entry.oldScoreA ?? "—"} - {entry.oldScoreB ?? "—"}
                </Badge>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary">
                  {entry.newScoreA ?? "—"} - {entry.newScoreB ?? "—"}
                </Badge>
              </div>
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground italic">
              "{entry.reason}"
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
