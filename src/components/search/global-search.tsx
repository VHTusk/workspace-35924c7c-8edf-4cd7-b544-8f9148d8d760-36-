"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Trophy,
  Users,
  Building2,
  Loader2,
  X,
  Clock,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentStatusBadge } from "@/components/tournament/tournament-status-badge";

interface SearchResult {
  id: string;
  type: "player" | "tournament" | "organization";
  name: string;
  subtitle?: string;
  image?: string;
  sport?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  points?: number;
  rank?: number;
}

interface GlobalSearchProps {
  sport: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ sport, isOpen, onClose }: GlobalSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(`recent-searches-${sport}`);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // ignore parse errors
      }
    }
  }, [sport]);

  // Focus input when dialog opens
  const focusTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery("");
      setResults([]);
    }

    return () => {
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, [isOpen]);

  // Debounced search
  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const sportParam = sport.toUpperCase();
      const [playersRes, tournamentsRes, orgsRes] = await Promise.all([
        fetch(`/api/search/players?q=${encodeURIComponent(searchQuery)}&sport=${sportParam}&limit=5`, {
          cache: "no-store",
        }),
        fetch(`/api/search/tournaments?q=${encodeURIComponent(searchQuery)}&sport=${sportParam}&limit=5`, {
          cache: "no-store",
        }),
        fetch(`/api/search/orgs?q=${encodeURIComponent(searchQuery)}&sport=${sportParam}&limit=3`, {
          cache: "no-store",
        }),
      ]);

      const allResults: SearchResult[] = [];

      if (playersRes.ok) {
        const data = await playersRes.json();
        const playerResults = data?.data?.results || data?.players || [];
        playerResults.forEach((p: Record<string, unknown>) => {
          allResults.push({
            id: p.id as string,
            type: "player",
            name:
              (p.fullName as string) ||
              (p.name as string) ||
              `${p.firstName || ""} ${p.lastName || ""}`.trim(),
            subtitle: p.city ? `${p.city}${p.state ? `, ${p.state}` : ''}` : undefined,
            image: (p.avatar as string) || (p.photoUrl as string),
            points: (p.visiblePoints as number) ?? (p.score as number),
            rank: p.rank as number,
          });
        });
      }

      if (tournamentsRes.ok) {
        const data = await tournamentsRes.json();
        const tournamentResults = data?.data?.results || data?.results || data?.tournaments || [];
        tournamentResults.forEach((t: Record<string, unknown>) => {
          allResults.push({
            id: t.id as string,
            type: "tournament",
            name: t.name as string,
            subtitle: t.city ? `${t.city}` : undefined,
            status: t.status as string,
            startDate: t.startDate as string,
            endDate: t.endDate as string,
          });
        });
      }

      if (orgsRes.ok) {
        const data = await orgsRes.json();
        const orgResults = data?.data?.results || data?.orgs || [];
        orgResults.forEach((o: Record<string, unknown>) => {
          allResults.push({
            id: o.id as string,
            type: "organization",
            name: o.name as string,
            subtitle: o.type as string,
            image: (o.logoUrl as string) || (o.logo as string),
          });
        });
      }

      setResults(allResults);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  }, [sport]);

  useEffect(() => {
    if (searchRef.current) {
      clearTimeout(searchRef.current);
    }

    if (query.length >= 2) {
      searchRef.current = setTimeout(() => {
        performSearch(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchRef.current) {
        clearTimeout(searchRef.current);
      }
    };
  }, [query, performSearch]);

  const saveToRecentSearches = (searchQuery: string) => {
    const updated = [searchQuery, ...recentSearches.filter(s => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`recent-searches-${sport}`, JSON.stringify(updated));
  };

  const handleResultClick = (result: SearchResult) => {
    saveToRecentSearches(query);
    onClose();

    switch (result.type) {
      case "player":
        router.push(`/${sport}/players/${result.id}`);
        break;
      case "tournament":
        router.push(`/${sport}/tournaments/${result.id}`);
        break;
      case "organization":
        router.push(`/${sport}/organizations/${result.id}`);
        break;
    }
  };

  const handleRecentSearchClick = (searchQuery: string) => {
    setQuery(searchQuery);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "player":
        return <Users className="w-4 h-4" />;
      case "tournament":
        return <Trophy className="w-4 h-4" />;
      case "organization":
        return <Building2 className="w-4 h-4" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
        </DialogHeader>

        {/* Search Input */}
        <div className="flex items-center border-b px-3 sm:px-4">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, tournaments, organizations..."
            className="border-0 focus-visible:ring-0 text-base"
          />
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {query && !loading && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setQuery("")}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[min(65dvh,400px)]">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className={cn("p-2 rounded-lg bg-muted", primaryTextClass)}>
                    {getIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{result.name}</p>
                      {result.type === "tournament" && result.status && result.startDate && result.endDate && (
                        <TournamentStatusBadge
                          startDate={result.startDate}
                          endDate={result.endDate}
                          dbStatus={result.status}
                          size="sm"
                        />
                      )}
                    </div>
                    {result.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                  {result.type === "player" && (
                    <div className="text-right">
                      {result.points !== undefined && (
                        <p className={cn("text-sm font-medium", primaryTextClass)}>
                          {result.points} pts
                        </p>
                      )}
                      {result.rank && (
                        <p className="text-xs text-muted-foreground">#{result.rank}</p>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : query.length >= 2 && !loading ? (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">No results found for &quot;{query}&quot;</p>
            </div>
          ) : query.length < 2 && recentSearches.length > 0 ? (
            <div className="p-4">
              <p className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => handleRecentSearchClick(search)}
                  >
                    {search}
                  </Badge>
                ))}
              </div>
            </div>
          ) : query.length < 2 ? (
            <div className="py-12 text-center">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">
                Type at least 2 characters to search
              </p>
            </div>
          ) : null}
        </ScrollArea>

        {/* Footer */}
        {results.length > 0 && (
          <div className="border-t px-3 py-3 bg-muted/30 sm:px-4">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> to search,{" "}
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd> to close
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Search Button Component for Header
export function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "h-10 w-10 shrink-0 justify-center rounded-xl border-border/70 bg-background/80 px-0 text-muted-foreground shadow-sm transition-colors hover:bg-muted/50 hover:text-foreground sm:min-w-[210px] sm:justify-between sm:px-3 lg:min-w-[220px]",
      )}
      aria-label="Search players and tournaments"
    >
      <span className="flex items-center gap-2">
        <Search className="h-4 w-4" />
        <span className="hidden text-sm sm:inline">Search players, tournaments...</span>
      </span>
    </Button>
  );
}
