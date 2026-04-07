"use client";

import { useEffect, useState, use } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import RecapViewer from "@/components/recap/recap-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Trophy, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SeasonRecapData } from "@/lib/season-recap-generator";

interface RecapPageProps {
  params: Promise<{
    sport: string;
    year: string;
  }>;
}

export default function RecapPage({ params }: RecapPageProps) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const sport = resolvedParams.sport.toUpperCase();
  const year = parseInt(resolvedParams.year);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recap, setRecap] = useState<SeasonRecapData | null>(null);
  const [playerName, setPlayerName] = useState("Player");
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [shareableText, setShareableText] = useState<string>("");

  const fetchRecap = async (targetYear: number, forceRegenerate = false) => {
    setLoading(true);
    setError(null);

    try {
      // Generate/regenerate if needed
      if (forceRegenerate) {
        await fetch(`/api/recap/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year: targetYear, sport })
        });
      }

      // Fetch the recap
      const response = await fetch(`/api/recap/${targetYear}?sport=${sport}`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to load recap");
      }

      setRecap(data.data.recap);
      setAvailableYears(data.data.availableYears || [targetYear]);
      setShareableText(data.data.shareableText || "");

      // Get player name from session or recap
      const userResponse = await fetch('/api/player/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setPlayerName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim() || "Player");
      }
    } catch (err) {
      console.error("Error fetching recap:", err);
      setError(err instanceof Error ? err.message : "Failed to load season recap");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecap(year);
  }, [year, sport]);

  const handleYearChange = (newYear: number) => {
    router.push(`/${resolvedParams.sport}/recap/${newYear}`);
  };

  const handleRegenerate = () => {
    fetchRecap(year, true);
  };

  // Check for valid sport
  if (!['CORNHOLE', 'DARTS'].includes(sport)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Sport</h1>
            <p className="text-gray-600 mb-4">The sport &quot;{resolvedParams.sport}&quot; is not supported.</p>
            <Button onClick={() => router.push('/')}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check for valid year
  const currentYear = new Date().getFullYear();
  if (isNaN(year) || year < 2020 || year > currentYear + 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <h1 className="text-xl font-bold text-red-600 mb-2">Invalid Year</h1>
            <p className="text-gray-600 mb-4">The year &quot;{resolvedParams.year}&quot; is not valid.</p>
            <Button onClick={() => router.push(`/${resolvedParams.sport}`)}>Go to {resolvedParams.sport}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-white/10 flex items-center justify-center animate-pulse">
            <Trophy className="w-8 h-8 text-white/60" />
          </div>
          <p className="text-white/80">Generating your season recap...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !recap) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">No Season Data</h1>
            <p className="text-gray-600">
              {error || `You don't have any ${sport.toLowerCase()} matches recorded for ${year}.`}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push(`/${resolvedParams.sport}`)}>
                Go to {resolvedParams.sport.charAt(0).toUpperCase() + resolvedParams.sport.slice(1)}
              </Button>
              {availableYears.length > 0 && (
                <Button variant="outline" onClick={() => handleYearChange(availableYears[0])}>
                  View {availableYears[0]} Season
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if no matches this season
  if (recap.totalMatchesPlayed === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">No Matches in {year}</h1>
            <p className="text-gray-600">
              You didn&apos;t play any {sport.toLowerCase()} matches in {year}. Start playing to generate your season recap!
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => router.push(`/${resolvedParams.sport}/tournaments`)}>
                Find Tournaments
              </Button>
              {availableYears.length > 1 && (
                <Button variant="outline" onClick={() => {
                  const otherYear = availableYears.find(y => y !== year);
                  if (otherYear) handleYearChange(otherYear);
                }}>
                  View Another Year
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the recap viewer
  return (
    <RecapViewer
      recap={recap}
      playerName={playerName}
      availableYears={availableYears.length > 0 ? availableYears : [year]}
      currentYear={year}
      onYearChange={handleYearChange}
      onRegenerate={handleRegenerate}
      shareableText={shareableText}
    />
  );
}
