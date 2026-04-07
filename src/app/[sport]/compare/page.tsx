'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Trophy, Users, Target, TrendingUp, Medal, BarChart3, Search, ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface PlayerData {
  id: string;
  name: string;
  location: string | null;
  tier: { tier: string; color: string };
  joinedAt: string;
  rating: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    highestElo: number;
    currentStreak: number;
    bestStreak: number;
    tournamentsPlayed: number;
    tournamentsWon: number;
  };
  achievements: Array<{ id: string; type: string; title: string }>;
}

interface ComparisonData {
  player1: number;
  player2: number;
  winner: 'player1' | 'player2' | 'tie';
}

interface ComparisonResponse {
  success: boolean;
  data: {
    player1: PlayerData;
    player2: PlayerData;
    comparison: Record<string, ComparisonData>;
    summary: {
      player1CategoryWins: number;
      player2CategoryWins: number;
      ties: number;
    };
    headToHead: {
      totalMatches: number;
      player1Wins: number;
      player2Wins: number;
      recentMatches: Array<{
        date: string;
        tournament: string;
        winnerId: string;
        player1Score: number;
        player2Score: number;
      }>;
    };
    prediction: {
      player1WinProbability: number;
      player2WinProbability: number;
    };
    sport: string;
  };
}

interface SearchResult {
  id: string;
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
  visiblePoints: number;
  hiddenElo: number;
}

export default function PlayerComparisonPage() {
  const params = useParams();
  const sport = params.sport as string;
  
  const [player1Id, setPlayer1Id] = useState('');
  const [player2Id, setPlayer2Id] = useState('');
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<{ player1: SearchResult[]; player2: SearchResult[] }>({ player1: [], player2: [] });
  const [searching, setSearching] = useState<{ player1: boolean; player2: boolean }>({ player1: false, player2: false });
  const [activeSearch, setActiveSearch] = useState<'player1' | 'player2' | null>(null);

  // Search players
  const searchPlayers = async (query: string, target: 'player1' | 'player2') => {
    if (query.length < 2) {
      setSearchResults(prev => ({ ...prev, [target]: [] }));
      return;
    }

    setSearching(prev => ({ ...prev, [target]: true }));
    
    try {
      const response = await fetch(`/api/search/players?q=${encodeURIComponent(query)}&sport=${sport.toUpperCase()}&limit=5`);
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(prev => ({ ...prev, [target]: data.data.results }));
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(prev => ({ ...prev, [target]: false }));
    }
  };

  // Run comparison
  const runComparison = async () => {
    if (!player1Id || !player2Id) return;

    setLoading(true);
    
    try {
      const response = await fetch(`/api/player/compare?player1=${player1Id}&player2=${player2Id}&sport=${sport.toUpperCase()}`);
      const data = await response.json();
      
      if (data.success) {
        setComparison(data);
      }
    } catch (error) {
      console.error('Comparison error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Select player from search
  const selectPlayer = (player: SearchResult, target: 'player1' | 'player2') => {
    if (target === 'player1') {
      setPlayer1Id(player.id);
    } else {
      setPlayer2Id(player.id);
    }
    setSearchResults(prev => ({ ...prev, [target]: [] }));
    setActiveSearch(null);
  };

  const StatComparison = ({ label, data, format = (v: number) => v.toString() }: { label: string; data: ComparisonData; format?: (v: number) => string }) => {
    const p1Wins = data.winner === 'player1';
    const p2Wins = data.winner === 'player2';
    
    return (
      <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
        <div className={`flex items-center gap-2 ${p1Wins ? 'font-bold text-green-600' : ''}`}>
          <span className="text-lg">{format(data.player1)}</span>
          {p1Wins && <Trophy className="h-4 w-4 text-green-600" />}
        </div>
        <span className="text-sm text-muted-foreground w-24 text-center">{label}</span>
        <div className={`flex items-center gap-2 ${p2Wins ? 'font-bold text-green-600' : ''}`}>
          {p2Wins && <Trophy className="h-4 w-4 text-green-600" />}
          <span className="text-lg">{format(data.player2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-6xl">
      <div className="mb-6">
        <Link href={`/${sport}`} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back to {sport}
        </Link>
        <h1 className="text-3xl font-bold mt-2">Player Comparison</h1>
        <p className="text-muted-foreground">Compare two players side-by-side</p>
      </div>

      {/* Player Selection */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Player 1 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Player 1
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search player..."
                  onChange={(e) => {
                    searchPlayers(e.target.value, 'player1');
                    setActiveSearch('player1');
                  }}
                  onFocus={() => setActiveSearch('player1')}
                />
                {activeSearch === 'player1' && searchResults.player1.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg z-10 mt-1 max-h-60 overflow-auto">
                    {searchResults.player1.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => selectPlayer(player, 'player1')}
                        className="w-full text-left p-3 hover:bg-muted flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{player.firstName} {player.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.city}, {player.state} • {player.visiblePoints} pts
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {player1Id && comparison && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="font-medium">{comparison.data.player1.name}</p>
                <Badge 
                  style={{ backgroundColor: comparison.data.player1.tier.color, color: 'white' }}
                  className="mt-1"
                >
                  {comparison.data.player1.tier.tier}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Player 2 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Player 2
            </CardTitle>
          </CardHeader>
          <CardContent className="relative">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Search player..."
                  onChange={(e) => {
                    searchPlayers(e.target.value, 'player2');
                    setActiveSearch('player2');
                  }}
                  onFocus={() => setActiveSearch('player2')}
                />
                {activeSearch === 'player2' && searchResults.player2.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-background border rounded-lg shadow-lg z-10 mt-1 max-h-60 overflow-auto">
                    {searchResults.player2.map((player) => (
                      <button
                        key={player.id}
                        onClick={() => selectPlayer(player, 'player2')}
                        className="w-full text-left p-3 hover:bg-muted flex items-center gap-3"
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{player.firstName} {player.lastName}</p>
                          <p className="text-xs text-muted-foreground">
                            {player.city}, {player.state} • {player.visiblePoints} pts
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {player2Id && comparison && (
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="font-medium">{comparison.data.player2.name}</p>
                <Badge 
                  style={{ backgroundColor: comparison.data.player2.tier.color, color: 'white' }}
                  className="mt-1"
                >
                  {comparison.data.player2.tier.tier}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compare Button */}
      <div className="flex justify-center mb-8">
        <Button 
          onClick={runComparison} 
          disabled={!player1Id || !player2Id || loading}
          size="lg"
        >
          {loading ? 'Comparing...' : 'Compare Players'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Comparison Results */}
      {comparison && (
        <div className="space-y-6">
          {/* Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Comparison Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-green-600">{comparison.data.summary.player1CategoryWins}</p>
                  <p className="text-sm text-muted-foreground">Categories Won by {comparison.data.player1.name.split(' ')[0]}</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-muted-foreground">{comparison.data.summary.ties}</p>
                  <p className="text-sm text-muted-foreground">Ties</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{comparison.data.summary.player2CategoryWins}</p>
                  <p className="text-sm text-muted-foreground">Categories Won by {comparison.data.player2.name.split(' ')[0]}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prediction */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <p className="text-3xl font-bold">{comparison.data.prediction.player1WinProbability}%</p>
                  <p className="text-sm text-muted-foreground">Win Probability</p>
                </div>
                <div className="px-8 text-center">
                  <Target className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-medium mt-1">Predicted Outcome</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-3xl font-bold">{comparison.data.prediction.player2WinProbability}%</p>
                  <p className="text-sm text-muted-foreground">Win Probability</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Stats Comparison
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-right">
                  <p className="font-medium">{comparison.data.player1.name}</p>
                </div>
                <div></div>
                <div className="text-left">
                  <p className="font-medium">{comparison.data.player2.name}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <StatComparison label="ELO Rating" data={comparison.data.comparison.elo} format={(v) => Math.round(v).toString()} />
                <StatComparison label="Points" data={comparison.data.comparison.points} />
                <StatComparison label="Win Rate" data={comparison.data.comparison.winRate} format={(v) => `${v}%`} />
                <StatComparison label="Matches" data={comparison.data.comparison.matchesPlayed} />
                <StatComparison label="Tournaments Won" data={comparison.data.comparison.tournamentsWon} />
                <StatComparison label="Highest ELO" data={comparison.data.comparison.highestElo} format={(v) => Math.round(v).toString()} />
                <StatComparison label="Current Streak" data={comparison.data.comparison.currentStreak} />
                <StatComparison label="Best Streak" data={comparison.data.comparison.bestStreak} />
              </div>
            </CardContent>
          </Card>

          {/* Head to Head */}
          {comparison.data.headToHead.totalMatches > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Medal className="h-5 w-5" />
                  Head-to-Head Record
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center mb-4">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{comparison.data.headToHead.player1Wins}</p>
                    <p className="text-sm text-muted-foreground">Wins</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{comparison.data.headToHead.totalMatches}</p>
                    <p className="text-sm text-muted-foreground">Total Matches</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{comparison.data.headToHead.player2Wins}</p>
                    <p className="text-sm text-muted-foreground">Wins</p>
                  </div>
                </div>

                {comparison.data.headToHead.recentMatches.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Recent Matches</h4>
                    <div className="space-y-2">
                      {comparison.data.headToHead.recentMatches.map((match, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded">
                          <span className="text-sm text-muted-foreground">
                            {new Date(match.date).toLocaleDateString()}
                          </span>
                          <span className="text-sm font-medium">
                            {match.player1Score} - {match.player2Score}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {match.tournament}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
