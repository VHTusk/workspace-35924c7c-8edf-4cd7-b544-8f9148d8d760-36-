"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  className?: string;
}

export function GlobalSearch({ sport, className }: GlobalSearchProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<NodeJS.Timeout | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const isCornhole = sport === "cornhole";
  const primaryTextClass = isCornhole
    ? "text-green-600 dark:text-green-400"
    : "text-teal-600 dark:text-teal-400";

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
            subtitle: p.city ? `${p.city}${p.state ? `, ${p.state}` : ""}` : (p.state as string | undefined),
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
            subtitle: t.state ? `${t.district ? `${t.district}, ` : ""}${t.state}` : undefined,
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
            subtitle: (o.state as string) || (o.type as string),
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
      }, 250);
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
    const updated = [searchQuery, ...recentSearches.filter((s) => s !== searchQuery)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem(`recent-searches-${sport}`, JSON.stringify(updated));
  };

  const handleResultClick = (result: SearchResult) => {
    if (query.trim()) {
      saveToRecentSearches(query);
    }

    setOpen(false);
    setQuery("");
    setResults([]);

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
    setOpen(true);
    inputRef.current?.focus();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "player":
        return <Users className="h-4 w-4" />;
      case "tournament":
        return <Trophy className="h-4 w-4" />;
      case "organization":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Search className="h-4 w-4" />;
    }
  };

  const showDropdown =
    open && (query.length >= 2 || recentSearches.length > 0 || loading);

  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Search players, tournaments..."
          className="h-10 rounded-xl border-border/70 bg-background/85 pl-10 pr-10 shadow-sm"
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      {showDropdown ? (
        <div className="absolute top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-background shadow-xl">
          <ScrollArea className="max-h-[min(60dvh,24rem)]">
            {results.length > 0 ? (
              <div className="p-2">
                {results.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    onClick={() => handleResultClick(result)}
                    className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className={cn("rounded-lg bg-muted p-2", primaryTextClass)}>
                      {getIcon(result.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{result.name}</p>
                        {result.type === "tournament" &&
                        result.status &&
                        result.startDate &&
                        result.endDate ? (
                          <TournamentStatusBadge
                            startDate={result.startDate}
                            endDate={result.endDate}
                            dbStatus={result.status}
                            size="sm"
                          />
                        ) : null}
                      </div>
                      {result.subtitle ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {result.subtitle}
                        </p>
                      ) : null}
                    </div>
                    {result.type === "player" ? (
                      <div className="text-right">
                        {result.points !== undefined ? (
                          <p className={cn("text-sm font-medium", primaryTextClass)}>
                            {result.points} pts
                          </p>
                        ) : null}
                        {result.rank ? (
                          <p className="text-xs text-muted-foreground">#{result.rank}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : query.length >= 2 && !loading ? (
              <div className="py-10 text-center">
                <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No results for &quot;{query}&quot;
                </p>
              </div>
            ) : query.length < 2 && recentSearches.length > 0 ? (
              <div className="p-4">
                <p className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Recent Searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((search, index) => (
                    <Badge
                      key={`${search}-${index}`}
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
              <div className="py-10 text-center">
                <TrendingUp className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Type at least 2 characters to search
                </p>
              </div>
            ) : null}
          </ScrollArea>
        </div>
      ) : null}
    </div>
  );
}
