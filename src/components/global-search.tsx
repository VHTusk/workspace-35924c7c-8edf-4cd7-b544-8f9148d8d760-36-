"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search,
  Users,
  Trophy,
  Building2,
  Loader2,
  X,
  Command,
} from "lucide-react";

interface SearchResult {
  id: string;
  type: "player" | "tournament" | "org";
  name: string;
  subtitle?: string;
  image?: string;
  sport?: string;
  status?: string;
}

interface GlobalSearchProps {
  trigger?: React.ReactNode;
  onResultClick?: (result: SearchResult) => void;
}

export function GlobalSearch({ trigger, onResultClick }: GlobalSearchProps) {
  const router = useRouter();
  const params = useParams();
  const sport = params?.sport as string || "cornhole";

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [results, setResults] = useState<{
    players: SearchResult[];
    tournaments: SearchResult[];
    orgs: SearchResult[];
  }>({ players: [], tournaments: [], orgs: [] });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (query.length >= 2) {
      searchAll();
    } else {
      setResults({ players: [], tournaments: [], orgs: [] });
    }
  }, [query]);

  const searchAll = async () => {
    setLoading(true);
    try {
      const [playersRes, tournamentsRes, orgsRes] = await Promise.all([
        fetch(`/api/search/players?q=${encodeURIComponent(query)}&sport=${sport.toUpperCase()}&limit=5`),
        fetch(`/api/search/tournaments?q=${encodeURIComponent(query)}&sport=${sport.toUpperCase()}&limit=5`),
        fetch(`/api/search/orgs?q=${encodeURIComponent(query)}&limit=5`),
      ]);

      const players = playersRes.ok ? await playersRes.json() : { players: [] };
      const tournaments = tournamentsRes.ok ? await tournamentsRes.json() : { tournaments: [] };
      const orgs = orgsRes.ok ? await orgsRes.json() : { orgs: [] };

      setResults({
        players: (players.players || []).map((p: any) => ({
          id: p.id,
          type: "player" as const,
          name: `${p.firstName} ${p.lastName}`,
          subtitle: p.city ? `${p.city}, ${p.state}` : undefined,
          sport: p.sport,
        })),
        tournaments: (tournaments.tournaments || []).map((t: any) => ({
          id: t.id,
          type: "tournament" as const,
          name: t.name,
          subtitle: t.location,
          sport: t.sport,
          status: t.status,
        })),
        orgs: (orgs.orgs || []).map((o: any) => ({
          id: o.id,
          type: "org" as const,
          name: o.name,
          subtitle: `${o.type} - ${o.city || "N/A"}`,
          sport: o.sport,
        })),
      });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    setOpen(false);
    setQuery("");

    if (onResultClick) {
      onResultClick(result);
      return;
    }

    switch (result.type) {
      case "player":
        router.push(`/${sport}/players/${result.id}`);
        break;
      case "tournament":
        router.push(`/${sport}/tournaments/${result.id}`);
        break;
      case "org":
        router.push(`/${sport}/org/profile?id=${result.id}`);
        break;
    }
  };

  const allResults = [
    ...results.players,
    ...results.tournaments,
    ...results.orgs,
  ];

  const getFilteredResults = () => {
    if (activeTab === "all") return allResults;
    if (activeTab === "players") return results.players;
    if (activeTab === "tournaments") return results.tournaments;
    if (activeTab === "orgs") return results.orgs;
    return [];
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      REGISTRATION_OPEN: "bg-green-500/10 text-green-400",
      IN_PROGRESS: "bg-red-500/10 text-red-400",
      COMPLETED: "bg-gray-500/10 text-gray-400",
      DRAFT: "bg-amber-500/10 text-amber-400",
    };
    return colors[status] || "bg-gray-500/10 text-gray-400";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "player":
        return <Users className="w-4 h-4 text-blue-400" />;
      case "tournament":
        return <Trophy className="w-4 h-4 text-amber-400" />;
      case "org":
        return <Building2 className="w-4 h-4 text-purple-400" />;
      default:
        return <Search className="w-4 h-4" />;
    }
  };

  return (
    <>
      {/* Trigger */}
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button
          variant="outline"
          className="relative h-10 w-full max-w-sm justify-start text-muted-foreground sm:pr-12"
          onClick={() => setOpen(true)}
        >
          <Search className="w-4 h-4 mr-2" />
          <span className="hidden lg:inline-flex">Search players, tournaments...</span>
          <span className="inline-flex lg:hidden">Search...</span>
          <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <Command className="w-3 h-3" />K
          </kbd>
        </Button>
      )}

      {/* Search Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 gap-0">
          <DialogHeader className="p-4 border-b border-border/50">
            <div className="flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search players, tournaments, organizations..."
                className="border-0 shadow-none focus-visible:ring-0 text-lg"
              />
              {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
              {query && (
                <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </DialogHeader>

          {query.length >= 2 && (
            <div className="p-4">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-4">
                  <TabsTrigger value="all">All ({allResults.length})</TabsTrigger>
                  <TabsTrigger value="players">Players ({results.players.length})</TabsTrigger>
                  <TabsTrigger value="tournaments">Tournaments ({results.tournaments.length})</TabsTrigger>
                  <TabsTrigger value="orgs">Organizations ({results.orgs.length})</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-0">
                  <div className="max-h-80 overflow-y-auto space-y-2">
                    {getFilteredResults().length > 0 ? (
                      getFilteredResults().map((result) => (
                        <div
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                        >
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            {getTypeIcon(result.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{result.name}</p>
                            {result.subtitle && (
                              <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {result.status && (
                              <Badge className={getStatusBadge(result.status)}>
                                {result.status.replace(/_/g, " ")}
                              </Badge>
                            )}
                            {result.sport && (
                              <Badge variant="outline">{result.sport}</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No results found for &quot;{query}&quot;</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {query.length < 2 && (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Start typing to search</p>
              <p className="text-xs mt-1">Search for players, tournaments, or organizations</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GlobalSearch;
