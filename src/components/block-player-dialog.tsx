"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Search,
  UserX,
  VolumeX,
  Check,
  ChevronsUpDown,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  city?: string | null;
  state?: string | null;
  visiblePoints: number;
  tier: string;
}

interface BlockPlayerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sport: string;
  onBlocked: () => void;
}

export function BlockPlayerDialog({
  open,
  onOpenChange,
  sport,
  onBlocked,
}: BlockPlayerDialogProps) {
  const [step, setStep] = useState<"search" | "confirm">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [reason, setReason] = useState("");
  const [isMute, setIsMute] = useState(false);
  const [searching, setSearching] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [error, setError] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchPlayers();
    } else {
      setPlayers([]);
    }
  }, [searchQuery]);

  const searchPlayers = async () => {
    setSearching(true);
    try {
      const response = await fetch(
        `/api/search/players?q=${encodeURIComponent(searchQuery)}&sport=${sport.toUpperCase()}&limit=10`
      );
      if (response.ok) {
        const data = await response.json();
        setPlayers(data.data?.results || data.players || []);
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectPlayer = (player: Player) => {
    setSelectedPlayer(player);
    setStep("confirm");
    setPopoverOpen(false);
  };

  const handleBlock = async () => {
    if (!selectedPlayer) return;

    setBlocking(true);
    setError("");

    try {
      const response = await fetch("/api/blocked-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedId: selectedPlayer.id,
          reason: reason || null,
          isMute,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to block player");
        return;
      }

      // Reset and close
      setStep("search");
      setSelectedPlayer(null);
      setSearchQuery("");
      setReason("");
      setIsMute(false);
      onBlocked();
      onOpenChange(false);
    } catch (err) {
      console.error("Block error:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setBlocking(false);
    }
  };

  const handleClose = () => {
    setStep("search");
    setSelectedPlayer(null);
    setSearchQuery("");
    setReason("");
    setIsMute(false);
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5" />
            {step === "search" ? "Block a Player" : "Confirm Block"}
          </DialogTitle>
          <DialogDescription>
            {step === "search"
              ? "Search for a player to block or mute. They won't be able to message you or match with you in tournaments."
              : "Review your selection before confirming."}
          </DialogDescription>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            {/* Player Search */}
            <div className="space-y-2">
              <Label>Search Player</Label>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {selectedPlayer ? (
                      <span>
                        {selectedPlayer.firstName} {selectedPlayer.lastName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Search by name...
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type to search..."
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {searching ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-4 h-4 animate-spin" />
                          </div>
                        ) : searchQuery.length < 2 ? (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            Type at least 2 characters to search
                          </p>
                        ) : (
                          <p className="py-6 text-center text-sm text-muted-foreground">
                            No players found
                          </p>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        <ScrollArea className="h-64">
                          {players.map((player) => (
                            <CommandItem
                              key={player.id}
                              value={player.id}
                              onSelect={() => handleSelectPlayer(player)}
                              className="flex items-center justify-between"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                  <User className="h-4 w-4 text-gray-500" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {player.firstName} {player.lastName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {player.city && player.state
                                      ? `${player.city}, ${player.state}`
                                      : player.city || player.state || ""}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {player.tier}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {player.visiblePoints} pts
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </ScrollArea>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Quick Search */}
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Or search by name directly..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results (direct list) */}
            {players.length > 0 && searchQuery.length >= 2 && (
              <ScrollArea className="h-48 border rounded-lg">
                <div className="p-2 space-y-1">
                  {players.map((player) => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer(player)}
                      className="w-full p-2 rounded-lg hover:bg-gray-100 flex items-center justify-between text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                          <User className="h-4 w-4 text-gray-500" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {player.firstName} {player.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {player.city && player.state
                              ? `${player.city}, ${player.state}`
                              : player.city || player.state || "No location"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {player.tier}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {player.visiblePoints} pts
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Selected Player */}
            <div className="p-4 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-6 w-6 text-gray-500" />
                </div>
                <div>
                  <p className="font-medium">
                    {selectedPlayer?.firstName} {selectedPlayer?.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedPlayer?.city && selectedPlayer?.state
                      ? `${selectedPlayer.city}, ${selectedPlayer.state}`
                      : "No location"}
                  </p>
                </div>
              </div>
            </div>

            {/* Block Type */}
            <div className="space-y-2">
              <Label>Block Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsMute(false)}
                  className={cn(
                    "p-3 rounded-lg border-2 flex items-center gap-2 transition-colors",
                    !isMute
                      ? isCornhole
                        ? "border-green-500 bg-green-50"
                        : "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <UserX className={cn("w-5 h-5", !isMute && (isCornhole ? "text-green-600" : "text-teal-600"))} />
                  <div className="text-left">
                    <p className="font-medium text-sm">Block</p>
                    <p className="text-xs text-muted-foreground">
                      Can&apos;t message or match
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => setIsMute(true)}
                  className={cn(
                    "p-3 rounded-lg border-2 flex items-center gap-2 transition-colors",
                    isMute
                      ? "border-amber-500 bg-amber-50"
                      : "border-gray-200 hover:border-gray-300"
                  )}
                >
                  <VolumeX className={cn("w-5 h-5", isMute && "text-amber-600")} />
                  <div className="text-left">
                    <p className="font-medium text-sm">Mute</p>
                    <p className="text-xs text-muted-foreground">
                      Hide their messages
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>Reason (Optional)</Label>
              <Input
                placeholder="Why are you blocking this player?"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                This helps us understand patterns of abuse.
              </p>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            {/* Warning */}
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> {isMute ? "Muted" : "Blocked"} players
                won&apos;t be notified. You can undo this action anytime from
                your settings.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "search" ? (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("search")}>
                Back
              </Button>
              <Button
                onClick={handleBlock}
                disabled={blocking}
                className={cn("text-white", primaryBtnClass)}
              >
                {blocking ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isMute ? "Mute Player" : "Block Player"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
