"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Target,
  Trophy,
  Users,
  Clock,
  MapPin,
  Ruler,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  BookOpen,
  Gamepad2,
  Medal,
  Crown,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function RulesPage() {
  const params = useParams();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const sportName = isCornhole ? "Cornhole" : "Darts";
  
  const primaryBgClass = isCornhole 
    ? "bg-green-500/10 dark:bg-green-500/20" 
    : "bg-teal-500/10 dark:bg-teal-500/20";
  const primaryTextClass = isCornhole 
    ? "text-green-500 dark:text-green-400" 
    : "text-teal-500 dark:text-teal-400";
  const primaryBorderClass = isCornhole 
    ? "border-green-500/30" 
    : "border-teal-500/30";
  const gradientClass = isCornhole 
    ? "from-green-500 to-emerald-600" 
    : "from-teal-500 to-cyan-600";

  return (
    <div className="py-8 px-4">
      <div className="container mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Badge variant="outline" className={cn("mb-4", primaryBorderClass, primaryTextClass, primaryBgClass)}>
            <BookOpen className="w-3 h-3 mr-1" />
            Official Guide
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {sportName} Rules & Formats
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Everything you need to know about {sportName.toLowerCase()} tournaments on VALORHIVE. 
            From basic rules to competitive formats and scoring systems.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className={cn("w-5 h-5", primaryTextClass)} />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isCornhole ? "2-4" : "2+"}
                  </p>
                  <p className="text-sm text-muted-foreground">Players</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className={cn("w-5 h-5", primaryTextClass)} />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isCornhole ? "15-30" : "20-45"}
                  </p>
                  <p className="text-sm text-muted-foreground">Min/Match</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isCornhole ? "21" : "301/501"}
                  </p>
                  <p className="text-sm text-muted-foreground">Win Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border/50">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className={cn("w-5 h-5", primaryTextClass)} />
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {isCornhole ? "27ft" : "7'9.25\""}
                  </p>
                  <p className="text-sm text-muted-foreground">Distance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 h-auto">
            <TabsTrigger value="overview" className="text-xs sm:text-sm">Overview</TabsTrigger>
            <TabsTrigger value="formats" className="text-xs sm:text-sm">Formats</TabsTrigger>
            <TabsTrigger value="scoring" className="text-xs sm:text-sm">Scoring</TabsTrigger>
            <TabsTrigger value="equipment" className="text-xs sm:text-sm">Equipment</TabsTrigger>
            <TabsTrigger value="faq" className="text-xs sm:text-sm">FAQ</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {isCornhole ? (
              <>
                {/* Cornhole Overview */}
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      What is Cornhole?
                    </CardTitle>
                    <CardDescription>
                      America's favorite backyard game, now popular worldwide
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-muted-foreground">
                      Cornhole (also known as corn toss, bean bag toss, or soft horseshoes) is a lawn game 
                      in which players take turns throwing bags filled with corn (or resin pellets) at a 
                      raised platform with a hole at the far end. A bag in the hole scores 3 points, while 
                      a bag on the board scores 1 point. Play continues until a team or player reaches or 
                      exceeds the score of 21.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ruler className={cn("w-5 h-5", primaryTextClass)} />
                      Court Dimensions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Board Specifications</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Board Size: 48" x 24" (122cm x 61cm)</li>
                          <li>• Hole Diameter: 6" (15cm)</li>
                          <li>• Hole Center: 9" from top, 12" from sides</li>
                          <li>• Front Height: 3" to 4" from ground</li>
                          <li>• Back Height: 12" from ground</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Court Layout</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Pitcher's Box: 4' x 3' on each side</li>
                          <li>• Distance: 27 feet between board fronts</li>
                          <li>• Foul Line: Front of pitcher's box</li>
                          <li>• Recommended Width: 10 feet total</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gamepad2 className={cn("w-5 h-5", primaryTextClass)} />
                      Basic Gameplay
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">1</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Setup</h4>
                          <p className="text-sm text-muted-foreground">
                            Place boards 27 feet apart. Players stand in the pitcher's box next to their target board.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">2</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Throwing</h4>
                          <p className="text-sm text-muted-foreground">
                            Players alternate throwing 4 bags per inning. In singles, players walk to the other end after each inning.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">3</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Scoring</h4>
                          <p className="text-sm text-muted-foreground">
                            After all 8 bags are thrown, points are calculated using cancellation scoring. Only one team scores per inning.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">4</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Winning</h4>
                          <p className="text-sm text-muted-foreground">
                            First to reach exactly 21 points wins. Some formats allow going over, others require exact score.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Darts Overview */}
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      What is Darts?
                    </CardTitle>
                    <CardDescription>
                      A precision sport enjoyed by millions worldwide
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-muted-foreground">
                      Darts is a form of throwing sport in which small missiles are thrown at a circular 
                      target called a dartboard. Points are scored by hitting specific marked areas of the 
                      board. Though various games can be played, the most common competitive format is 
                      "501" where players start with 501 points and race to reduce their score to exactly 
                      zero, finishing with a double.
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ruler className={cn("w-5 h-5", primaryTextClass)} />
                      Board & Distance Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Dartboard Dimensions</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Overall Diameter: 18" (451mm)</li>
                          <li>• Double Ring: 6.69mm wide</li>
                          <li>• Triple Ring: 8mm wide</li>
                          <li>• Bull (outer): 31.8mm diameter</li>
                          <li>• Bullseye (inner): 12.7mm diameter</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Throwing Setup</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Throwing Distance: 7' 9.25" (2.37m)</li>
                          <li>• Board Height: 5' 8" (1.73m) to bullseye</li>
                          <li>• Diagonal: 9' 7.5" from throw line to bull</li>
                          <li>• Throw Line: 3' wide minimum</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      Board Scoring Segments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="text-2xl font-bold text-foreground">20</p>
                        <p className="text-xs text-muted-foreground">Highest Single</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="text-2xl font-bold text-foreground">T20</p>
                        <p className="text-xs text-muted-foreground">Triple 20 = 60 pts</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="text-2xl font-bold text-foreground">D20</p>
                        <p className="text-xs text-muted-foreground">Double 20 = 40 pts</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="text-2xl font-bold text-foreground">Bull</p>
                        <p className="text-xs text-muted-foreground">50 pts (inner)</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <h4 className="font-semibold text-foreground">Segment Values</h4>
                      <p className="text-sm text-muted-foreground">
                        The board is divided into 20 numbered segments (1-20) arranged in a specific pattern. 
                        Each segment has four scoring areas: single (face value), double (2x), triple (3x), 
                        and outer single. The bullseye (center) scores 50 points, while the outer bull scores 25.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gamepad2 className={cn("w-5 h-5", primaryTextClass)} />
                      Basic Gameplay (501)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">1</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Start</h4>
                          <p className="text-sm text-muted-foreground">
                            Each player begins with 501 points. The goal is to reduce the score to exactly zero.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">2</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Throwing</h4>
                          <p className="text-sm text-muted-foreground">
                            Players throw 3 darts per turn. The score from each turn is subtracted from their remaining total.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">3</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Finishing</h4>
                          <p className="text-sm text-muted-foreground">
                            The game must end with a double (including bullseye). If a player scores more than needed, the turn is void.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Badge className="bg-primary text-primary-foreground shrink-0">4</Badge>
                        <div>
                          <h4 className="font-medium text-foreground">Bust</h4>
                          <p className="text-sm text-muted-foreground">
                            If the score is reduced below zero or to 1, or exactly zero without a double, it's a "bust" - score resets to start of turn.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Formats Tab */}
          <TabsContent value="formats" className="space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className={cn("w-5 h-5", primaryTextClass)} />
                  Tournament Formats
                </CardTitle>
                <CardDescription>
                  Different competition formats available on VALORHIVE
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Medal className={cn("w-5 h-5", primaryTextClass)} />
                      <h4 className="font-semibold text-foreground">Single Elimination</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Classic knockout format. One loss eliminates you from the tournament. Fast-paced and exciting, 
                      ideal for large fields. No second chances - every match matters!
                    </p>
                    <Badge variant="outline" className="text-xs">Most Common</Badge>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Crown className={cn("w-5 h-5", primaryTextClass)} />
                      <h4 className="font-semibold text-foreground">Double Elimination</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Players drop to a losers bracket after their first loss. Must lose twice to be eliminated. 
                      Winners bracket champion needs one win in finals; losers bracket champion needs two.
                    </p>
                    <Badge variant="outline" className="text-xs">Fair Format</Badge>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className={cn("w-5 h-5", primaryTextClass)} />
                      <h4 className="font-semibold text-foreground">Round Robin</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Every player/team plays every other player/team. Best for smaller groups and ensures 
                      everyone gets maximum playing time. Winner determined by total wins/points.
                    </p>
                    <Badge variant="outline" className="text-xs">Guaranteed Matches</Badge>
                  </div>

                  <div className="p-4 border border-border rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className={cn("w-5 h-5", primaryTextClass)} />
                      <h4 className="font-semibold text-foreground">Swiss System</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Players with similar records play each other each round. No elimination - everyone plays 
                      all rounds. Tiebreakers: Buchholz and Sonneborn-Berger. Great for competitive events.
                    </p>
                    <Badge variant="outline" className="text-xs">Competitive</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className={cn("w-5 h-5", primaryTextClass)} />
                  Player Formats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                    <h4 className="font-semibold text-foreground">Singles</h4>
                    <p className="text-xs text-muted-foreground">1 vs 1</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Individual competition between two players
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                    <h4 className="font-semibold text-foreground">Doubles</h4>
                    <p className="text-xs text-muted-foreground">2 vs 2</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Teams of two players compete together
                    </p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-lg text-center">
                    <Users className={cn("w-8 h-8 mx-auto mb-2", primaryTextClass)} />
                    <h4 className="font-semibold text-foreground">Teams</h4>
                    <p className="text-xs text-muted-foreground">3-4 players</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Larger teams with rotating players
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className={cn("w-5 h-5", primaryTextClass)} />
                  Tournament Scopes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">City</Badge>
                    <p className="text-sm text-muted-foreground">Local tournaments within a city</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/30">District</Badge>
                    <p className="text-sm text-muted-foreground">Regional competitions across districts</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/30">State</Badge>
                    <p className="text-sm text-muted-foreground">State-level championships</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/30">National</Badge>
                    <p className="text-sm text-muted-foreground">Premier national-level events</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Scoring Tab */}
          <TabsContent value="scoring" className="space-y-6">
            {isCornhole ? (
              <>
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                      Cornhole Scoring System
                    </CardTitle>
                    <CardDescription>
                      Cancellation scoring - only one team scores per inning
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-500/10 dark:bg-green-500/20 rounded-lg text-center border border-green-500/30">
                        <p className="text-3xl font-bold text-green-500 dark:text-green-400">3</p>
                        <p className="font-medium text-foreground">Bag In Hole</p>
                        <p className="text-xs text-muted-foreground">Cornhole / Ace</p>
                      </div>
                      <div className="p-4 bg-yellow-500/10 dark:bg-yellow-500/20 rounded-lg text-center border border-yellow-500/30">
                        <p className="text-3xl font-bold text-yellow-500 dark:text-yellow-400">1</p>
                        <p className="font-medium text-foreground">Bag On Board</p>
                        <p className="text-xs text-muted-foreground">Woody / Boarder</p>
                      </div>
                      <div className="p-4 bg-red-500/10 dark:bg-red-500/20 rounded-lg text-center border border-red-500/30">
                        <p className="text-3xl font-bold text-red-500 dark:text-red-400">0</p>
                        <p className="font-medium text-foreground">Bag Off Board</p>
                        <p className="text-xs text-muted-foreground">Foul / Miss</p>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-semibold text-foreground mb-3">Cancellation Scoring Example</h4>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Team A:</strong> 1 bag in hole (3) + 2 bags on board (2) = <strong>5 points</strong>
                        </p>
                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Team B:</strong> 2 bags in hole (6) + 1 bag on board (1) = <strong>7 points</strong>
                        </p>
                        <Separator className="my-2" />
                        <p className="text-sm text-foreground">
                          <strong>Result:</strong> Team B scores 2 points (7 - 5 = 2)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className={cn("w-5 h-5", primaryTextClass)} />
                      Foul Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Crossing Foul Line</h4>
                        <p className="text-sm text-muted-foreground">
                          If a player's foot crosses the foul line during a throw, the bag is removed and scores 0.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Wrong Pitcher's Box</h4>
                        <p className="text-sm text-muted-foreground">
                          Throwing from the wrong side results in a foul - bag removed from play.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-foreground">Time Violation</h4>
                        <p className="text-sm text-muted-foreground">
                          Players have 20 seconds to throw. Repeated violations may result in bag removal.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className={cn("w-5 h-5", primaryTextClass)} />
                      Common Dart Games
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="p-4 border border-border rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">501 / 301</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Start with 501 or 301 points. Subtract each turn's score. Must finish on a double (including bullseye).
                          First to exactly zero wins the leg.
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">Standard Format</Badge>
                          <Badge variant="outline" className="text-xs">Best of Sets</Badge>
                        </div>
                      </div>

                      <div className="p-4 border border-border rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Cricket</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Close numbers 15-20 and bullseye by hitting each three times. Doubles count as 2, triples as 3.
                          Points can be scored if opponent hasn't closed a number.
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">Popular</Badge>
                          <Badge variant="outline" className="text-xs">Strategic</Badge>
                        </div>
                      </div>

                      <div className="p-4 border border-border rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Around the Clock</h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          Hit numbers 1-20 in sequence, then finish with outer bull and bullseye. Doubles and triples 
                          don't count extra - must hit the single segment.
                        </p>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">Practice Game</Badge>
                          <Badge variant="outline" className="text-xs">Beginner Friendly</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className={cn("w-5 h-5", primaryTextClass)} />
                      Special Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">180 (Maximum)</p>
                        <p className="text-sm text-muted-foreground">Three triple 20s = 180 points</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">9-Dart Finish</p>
                        <p className="text-sm text-muted-foreground">Perfect leg - 501 in 9 darts</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">Ton (100+)</p>
                        <p className="text-sm text-muted-foreground">A turn scoring 100+ points</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">High Finish</p>
                        <p className="text-sm text-muted-foreground">Big checkout to win leg</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Equipment Tab */}
          <TabsContent value="equipment" className="space-y-6">
            {isCornhole ? (
              <>
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      Cornhole Equipment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Boards</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Regulation size: 48" x 24"</li>
                          <li>• Plywood surface (finished smooth)</li>
                          <li>• Frame: 2x4 construction</li>
                          <li>• Weight: 25-40 lbs typical</li>
                          <li>• Tournament certified boards recommended</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Bags</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Size: 6" x 6" square</li>
                          <li>• Weight: 15.5-16 oz each</li>
                          <li>• Fill: Corn or resin pellets</li>
                          <li>• 4 bags per team (8 total)</li>
                          <li>• Tournament approved bags required</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className={cn("w-5 h-5", primaryTextClass)} />
                      Bag Types
                    </CardTitle>
                    <CardDescription>
                      Modern cornhole bags come in various styles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">Corn Filled</p>
                        <p className="text-xs text-muted-foreground">Traditional, breaks in over time</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">Resin Filled</p>
                        <p className="text-xs text-muted-foreground">Weather resistant, consistent</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="font-semibold text-foreground">Hybrid</p>
                        <p className="text-xs text-muted-foreground">Best of both worlds</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className={cn("w-5 h-5", primaryTextClass)} />
                      Darts Equipment
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Dartboards</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Bristle/Sisal boards (competition)</li>
                          <li>• 18" diameter standard size</li>
                          <li>• Wire spider or blade system</li>
                          <li>• Staple-free bullseye preferred</li>
                          <li>• Rotating number ring extends life</li>
                        </ul>
                      </div>
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <h4 className="font-semibold text-foreground mb-2">Darts</h4>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          <li>• Weight: 12-50 grams (22-26g common)</li>
                          <li>• Barrel: Brass, nickel, tungsten</li>
                          <li>• Tungsten (80-95%) preferred</li>
                          <li>• Shafts: Plastic, aluminum, carbon</li>
                          <li>• Flights: Standard, slim, kite shapes</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className={cn("w-5 h-5", primaryTextClass)} />
                      Dart Components
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid sm:grid-cols-4 gap-4">
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="font-semibold text-foreground">Point/Tip</p>
                        <p className="text-xs text-muted-foreground">Steel tip or soft tip</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="font-semibold text-foreground">Barrel</p>
                        <p className="text-xs text-muted-foreground">Main grip & weight</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="font-semibold text-foreground">Shaft/Stem</p>
                        <p className="text-xs text-muted-foreground">Connects flight</p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg text-center">
                        <p className="font-semibold text-foreground">Flight</p>
                        <p className="text-xs text-muted-foreground">Stabilizes dart</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <Card className="bg-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className={cn("w-5 h-5", primaryTextClass)} />
                  Frequently Asked Questions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCornhole ? (
                  <>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What happens if a bag bounces off the ground?</h4>
                      <p className="text-sm text-muted-foreground">
                        If a bag bounces off the ground and lands on the board or goes in the hole, it must be removed 
                        before the next throw. It scores 0 points.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">Can I throw overhand?</h4>
                      <p className="text-sm text-muted-foreground">
                        Official rules require underhand throwing. Overhand throws are considered fouls and the bag 
                        is removed from play.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What if a bag is hanging over the hole?</h4>
                      <p className="text-sm text-muted-foreground">
                        A bag that is hanging over the hole but hasn't fallen through scores 1 point. It only counts 
                        as 3 points if it's completely in the hole.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">Do I have to win by exactly 21?</h4>
                      <p className="text-sm text-muted-foreground">
                        This varies by tournament. Standard rules allow going over. Some recreational formats require exactly 
                        21. Check specific tournament rules.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What if a bag knocks another bag in the hole?</h4>
                      <p className="text-sm text-muted-foreground">
                        This is legal and part of the game! If your bag knocks an opponent's bag off the board, 
                        that bag is removed. If it knocks your own bag in the hole, it counts as 3 points.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What is a "bust" in 501?</h4>
                      <p className="text-sm text-muted-foreground">
                        A bust occurs when your score goes below zero, to exactly 1, or to zero without finishing on a 
                        double. Your score resets to what it was at the start of that turn.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">Do I have to finish on a double?</h4>
                      <p className="text-sm text-muted-foreground">
                        Yes, in standard 501/301, you must finish on a double (including bullseye which counts as 
                        double 25). This is called a "checkout" or "double out."
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What happens if a dart falls out?</h4>
                      <p className="text-sm text-muted-foreground">
                        A dart that falls out before being retrieved doesn't count. However, if it sticks and is 
                        knocked out by a subsequent dart, it still counts. Darts must remain in the board to score.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">Can I lean over the throw line?</h4>
                      <p className="text-sm text-muted-foreground">
                        Yes, you can lean over the oche (throw line) as long as your feet don't cross it. Many players 
                        lean forward for stability. Your foot must not touch or cross the line.
                      </p>
                    </div>
                    <div className="p-4 border border-border rounded-lg">
                      <h4 className="font-semibold text-foreground mb-2">What's the highest possible checkout?</h4>
                      <p className="text-sm text-muted-foreground">
                        The highest checkout is 170 (T20 + T20 + Bull). The highest checkout without bull is 167 
                        (T20 + T19 + Bull alternative: T20 + T19 + D25). Any score above 170 cannot be finished in 3 darts.
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer Note */}
        <Card className="bg-card border-border/50 mt-8">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <AlertCircle className={cn("w-6 h-6 shrink-0", primaryTextClass)} />
              <div>
                <h4 className="font-semibold text-foreground mb-1">Official Rules</h4>
                <p className="text-sm text-muted-foreground">
                  These rules are based on official {isCornhole ? "ACL (American Cornhole League)" : "WDF (World Darts Federation)"} 
                  standards. Individual tournaments may have variations. Always check the specific tournament rules 
                  before competing. For detailed official rulebooks, visit the respective governing body's website.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
