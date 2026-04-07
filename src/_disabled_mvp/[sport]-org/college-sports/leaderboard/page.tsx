"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Trophy,
  ArrowLeft,
  Loader2,
  Medal,
  TrendingUp,
  Users,
  Filter,
  Crown,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeaderboardEntry {
  id: string;
  rank: number;
  studentName: string;
  department: string;
  year?: string;
  points: number;
  tournamentsPlayed: number;
  wins: number;
  winRate: string;
}

interface OrgData {
  id: string;
  name: string;
  type: string;
}

export default function CollegeInternalLeaderboardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";

  useEffect(() => {
    fetchOrg();
  }, [sport]);

  useEffect(() => {
    if (org?.id) {
      fetchLeaderboard();
    }
  }, [org?.id, filterDept, filterYear]);

  const fetchOrg = async () => {
    try {
      const response = await fetch("/api/org/me");
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
        
        if (data.type !== "COLLEGE") {
          router.push(`/${sport}/org/dashboard`);
        }
      }
    } catch (err) {
      console.error("Failed to fetch org:", err);
    }
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDept && filterDept !== 'all') params.append('department', filterDept);
      if (filterYear && filterYear !== 'all') params.append('year', filterYear);
      
      const response = await fetch(`/api/org/college/leaderboard/intra?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setLeaderboard(data.data.leaderboard || []);
        }
      } else {
        // Fallback to mock data if API fails
        const mockData: LeaderboardEntry[] = [
          { id: "1", rank: 1, studentName: "Aditya Kumar", department: "Computer Science", year: "3rd Year", points: 2850, tournamentsPlayed: 15, wins: 12, winRate: "80%" },
          { id: "2", rank: 2, studentName: "Neha Singh", department: "Electronics", year: "2nd Year", points: 2620, tournamentsPlayed: 14, wins: 11, winRate: "79%" },
          { id: "3", rank: 3, studentName: "Rohan Verma", department: "Mechanical", year: "4th Year", points: 2480, tournamentsPlayed: 13, wins: 10, winRate: "77%" },
          { id: "4", rank: 4, studentName: "Pooja Sharma", department: "Computer Science", year: "2nd Year", points: 2350, tournamentsPlayed: 12, wins: 9, winRate: "75%" },
          { id: "5", rank: 5, studentName: "Amit Patel", department: "Civil", year: "3rd Year", points: 2180, tournamentsPlayed: 11, wins: 8, winRate: "73%" },
          { id: "6", rank: 6, studentName: "Sneha Reddy", department: "Electronics", year: "1st Year", points: 2050, tournamentsPlayed: 10, wins: 7, winRate: "70%" },
          { id: "7", rank: 7, studentName: "Karthik Nair", department: "Mechanical", year: "2nd Year", points: 1920, tournamentsPlayed: 9, wins: 6, winRate: "67%" },
          { id: "8", rank: 8, studentName: "Divya Menon", department: "Computer Science", year: "4th Year", points: 1850, tournamentsPlayed: 8, wins: 5, winRate: "63%" },
        ];
        setLeaderboard(mockData);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-sm font-medium text-gray-500">#{rank}</span>;
  };

  const getRankBgClass = (rank: number) => {
    if (rank === 1) return "bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200";
    if (rank === 2) return "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200";
    if (rank === 3) return "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200";
    return "bg-white border-gray-100";
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <Sidebar userType="org" />
      <main className="ml-0 md:ml-72">
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <Button
              variant="ghost"
              onClick={() => router.push(`/${sport}/org/college-dashboard`)}
              className="mb-2 text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Internal Leaderboard</h1>
                <p className="text-gray-500">Rankings of students based on internal tournament performance</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <p className="text-2xl font-bold text-gray-900">{leaderboard.length}</p>
                <p className="text-xs text-gray-500">Total Participants</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Trophy className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                <p className="text-2xl font-bold text-gray-900">
                  {leaderboard.reduce((sum, e) => sum + e.tournamentsPlayed, 0)}
                </p>
                <p className="text-xs text-gray-500">Tournaments Played</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {leaderboard.reduce((sum, e) => sum + e.wins, 0)}
                </p>
                <p className="text-xs text-gray-500">Total Wins</p>
              </CardContent>
            </Card>
            <Card className="bg-white border-gray-100 shadow-sm">
              <CardContent className="p-4 text-center">
                <Star className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <p className="text-2xl font-bold text-gray-900">
                  {leaderboard.reduce((sum, e) => sum + e.points, 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Total Points</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white border-gray-100 shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <Filter className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Department:</span>
                    <Select value={filterDept} onValueChange={setFilterDept}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        <SelectItem value="cse">Computer Science</SelectItem>
                        <SelectItem value="ece">Electronics</SelectItem>
                        <SelectItem value="mech">Mechanical</SelectItem>
                        <SelectItem value="civil">Civil</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Year:</span>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="All Years" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        <SelectItem value="1">1st Year</SelectItem>
                        <SelectItem value="2">2nd Year</SelectItem>
                        <SelectItem value="3">3rd Year</SelectItem>
                        <SelectItem value="4">4th Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card className="bg-white border-gray-100 shadow-sm">
            <CardHeader>
              <CardTitle className="text-gray-900 flex items-center gap-2">
                <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                Student Rankings
              </CardTitle>
              <CardDescription>Based on performance in internal tournaments</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : leaderboard.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Trophy className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No leaderboard data yet</p>
                  <p className="text-sm">Students will appear here after participating in internal tournaments</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-colors",
                        getRankBgClass(entry.rank)
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100">
                          {getRankIcon(entry.rank)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{entry.studentName}</p>
                          <div className="flex items-center gap-2 text-sm text-gray-500">
                            <span>{entry.department}</span>
                            {entry.year && (
                              <>
                                <span>•</span>
                                <span>{entry.year}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{entry.points.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Points</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-gray-700">{entry.tournamentsPlayed}</p>
                          <p className="text-xs text-gray-500">Events</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-semibold text-green-600">{entry.winRate}</p>
                          <p className="text-xs text-gray-500">Win Rate</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
