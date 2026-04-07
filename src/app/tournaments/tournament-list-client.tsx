"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TournamentCard } from "@/components/public/tournament-card";
import {
  Search,
  Filter,
  Trophy,
  MapPin,
  Loader2,
  X,
  ArrowLeft,
} from "lucide-react";

interface Tournament {
  id: string;
  name: string;
  sport: string;
  type: string;
  scope: string | null;
  location: string;
  city: string | null;
  state: string | null;
  startDate: string;
  endDate: string;
  regDeadline: string;
  prizePool: number;
  entryFee: number;
  maxPlayers: number;
  currentRegistrations: number;
  status: string;
  bracketFormat: string | null;
  hostOrg: {
    id: string;
    name: string;
    logoUrl: string | null;
  } | null;
  earlyBirdFee: number | null;
  earlyBirdDeadline: string | null;
}

interface TournamentsResponse {
  tournaments: Tournament[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function TournamentListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [sport, setSport] = useState(searchParams.get("sport") || "all");
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "open");
  const [scopeFilter, setScopeFilter] = useState(searchParams.get("scope") || "all");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Fetch tournaments
  useEffect(() => {
    const fetchTournaments = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        if (sport !== "all") params.set("sport", sport);
        
        // Map status filter
        if (statusFilter === "open") {
          params.set("status", "REGISTRATION_OPEN");
        } else if (statusFilter === "live") {
          params.set("status", "IN_PROGRESS");
        } else if (statusFilter === "completed") {
          params.set("status", "COMPLETED");
        } else if (statusFilter === "all") {
          params.set("status", "REGISTRATION_OPEN,IN_PROGRESS,BRACKET_GENERATED");
        }
        
        if (scopeFilter !== "all") params.set("scope", scopeFilter);
        if (searchQuery) params.set("search", searchQuery);
        params.set("page", page.toString());
        params.set("limit", "12");

        const response = await fetch(`/api/public/tournaments?${params.toString()}`);
        const data: TournamentsResponse = await response.json();

        if (!response.ok) {
          throw new Error(data ? "Failed to fetch tournaments" : "Unknown error");
        }

        setTournaments(data.tournaments);
        setTotalPages(data.pagination.totalPages);
      } catch (err) {
        console.error("Error fetching tournaments:", err);
        setError("Failed to load tournaments. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchTournaments();
  }, [sport, statusFilter, scopeFilter, searchQuery, page]);

  // Update URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (sport !== "all") params.set("sport", sport);
    if (statusFilter !== "open") params.set("status", statusFilter);
    if (scopeFilter !== "all") params.set("scope", scopeFilter);
    if (searchQuery) params.set("search", searchQuery);
    
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    router.replace(newUrl, { scroll: false });
  }, [sport, statusFilter, scopeFilter, searchQuery, router]);

  const clearFilters = () => {
    setSport("all");
    setStatusFilter("open");
    setScopeFilter("all");
    setSearchQuery("");
    setPage(1);
  };

  const hasActiveFilters = sport !== "all" || statusFilter !== "open" || scopeFilter !== "all" || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tournament Discovery</h1>
              <p className="text-sm text-gray-500">
                Find and follow Cornhole & Darts tournaments across India
              </p>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tournaments..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={sport} onValueChange={(v) => { setSport(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sport" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sports</SelectItem>
                  <SelectItem value="CORNHOLE">Cornhole</SelectItem>
                  <SelectItem value="DARTS">Darts</SelectItem>
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Registration Open</SelectItem>
                  <SelectItem value="live">Live Now</SelectItem>
                  <SelectItem value="all">All Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={scopeFilter} onValueChange={(v) => { setScopeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="CITY">City</SelectItem>
                  <SelectItem value="DISTRICT">District</SelectItem>
                  <SelectItem value="STATE">State</SelectItem>
                  <SelectItem value="NATIONAL">National</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="icon" onClick={clearFilters}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border p-4 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No tournaments found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your filters or check back later for new tournaments.
            </p>
            <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-500">
              Showing {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  {totalPages > 5 && <span className="px-2">...</span>}
                  {totalPages > 5 && (
                    <Button
                      variant={page === totalPages ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPage(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <Link href="/" className="font-semibold text-gray-900 hover:underline">
            VALORHIVE
          </Link>
          {" "}- India's Premier Cornhole & Darts Tournament Platform
        </div>
      </footer>
    </div>
  );
}

export function TournamentListClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    }>
      <TournamentListContent />
    </Suspense>
  );
}
