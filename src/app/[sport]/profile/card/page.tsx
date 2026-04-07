"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Sidebar from "@/components/layout/sidebar";
import { PlayerCard } from "@/components/player-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Download,
  Printer,
  Share2,
  Loader2,
  CheckCircle,
  AlertCircle,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlayerData {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  photoUrl?: string | null;
  visiblePoints: number;
  hiddenElo: number;
  sport: string;
  city?: string | null;
  state?: string | null;
  organization?: {
    name: string;
  } | null;
  rating?: {
    matchesPlayed: number;
    wins: number;
    losses: number;
    tournamentsPlayed: number;
    tournamentsWon: number;
  };
}

export default function PlayerCardPage() {
  const params = useParams();
  const router = useRouter();
  const sport = params.sport as string;
  const isCornhole = sport === "cornhole";
  const cardRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<PlayerData | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchPlayerData();
  }, []);

  const fetchPlayerData = async () => {
    try {
      const response = await fetch("/api/player/me");
      if (!response.ok) {
        throw new Error("Failed to fetch player data");
      }
      const data = await response.json();
      setPlayer(data);
    } catch (err) {
      console.error("Failed to fetch player data:", err);
      setError("Failed to load player data");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    setPrinting(true);
    setError("");

    try {
      // Use browser print
      window.print();
    } catch (err) {
      console.error("Print error:", err);
      setError("Failed to print card");
    } finally {
      setPrinting(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setError("");

    try {
      // Fetch the SVG card from the API
      const response = await fetch(`/api/players/${player?.id}/card`);
      if (!response.ok) {
        throw new Error("Failed to generate card");
      }

      // Get the SVG content
      const svgContent = await response.text();

      // Create a blob and download
      const blob = new Blob([svgContent], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${player?.firstName}-${player?.lastName}-card.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess("Card downloaded successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Download error:", err);
      setError("Failed to download card");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    if (navigator.share && player) {
      try {
        await navigator.share({
          title: `${player.firstName} ${player.lastName} - VALORHIVE Player Card`,
          text: `Check out my player card! ${player.visiblePoints} points, ${player.rating?.wins || 0} wins`,
          url: window.location.href,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Share error:", err);
        }
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(window.location.href);
        setSuccess("Link copied to clipboard!");
        setTimeout(() => setSuccess(""), 3000);
      } catch (err) {
        console.error("Clipboard error:", err);
        setError("Failed to copy link");
      }
    }
  };

  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBtnClass = isCornhole
    ? "bg-green-600 hover:bg-green-700"
    : "bg-teal-600 hover:bg-teal-700";

  if (loading) {
    return (
      <div className="bg-muted min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="bg-muted min-h-screen">
        <Sidebar userType="player" />
        <main className="ml-0 md:ml-72">
          <div className="p-6 max-w-4xl">
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>
                Unable to load player data. Please try again.
              </AlertDescription>
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-muted min-h-screen">
      <Sidebar userType="player" />
      <main className="ml-0 md:ml-72">
        <div className="p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">Player Card</h1>
            <p className="text-muted-foreground">
              View and download your official VALORHIVE player card
            </p>
          </div>

          {/* Success Message */}
          {success && (
            <Alert className="mb-6 bg-emerald-50 border-emerald-200">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              <AlertDescription className="text-emerald-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Card Preview */}
          <Card className="bg-card border-border shadow-sm mb-6">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Card Preview
              </CardTitle>
              <CardDescription>
                Your official player card with stats and verification QR code
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center print:block">
                <div className="print:hidden">
                  <PlayerCard
                    player={player}
                    stats={player.rating}
                    sport={sport as "cornhole" | "darts"}
                    ref={cardRef}
                  />
                </div>
                {/* Print version */}
                <div className="hidden print:block">
                  <PlayerCard
                    player={player}
                    stats={player.rating}
                    sport={sport as "cornhole" | "darts"}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card className="bg-card border-border shadow-sm print:hidden">
            <CardHeader>
              <CardTitle className="text-foreground">Actions</CardTitle>
              <CardDescription>
                Print or download your player card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handlePrint}
                  disabled={printing}
                  className={cn("text-white gap-2", primaryBtnClass)}
                >
                  {printing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Printer className="w-4 h-4" />
                  )}
                  Print Card
                </Button>

                <Button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={cn("text-white gap-2", primaryBtnClass)}
                >
                  {downloading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download SVG
                </Button>

                <Button
                  variant="outline"
                  onClick={handleShare}
                  className="gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </div>

              <p className="text-sm text-muted-foreground mt-4">
                Tip: Download the SVG file to share your card on social media or
                print it for offline verification.
              </p>
            </CardContent>
          </Card>

          {/* Card Features */}
          <Card className="bg-card border-border shadow-sm mt-6 print:hidden">
            <CardHeader>
              <CardTitle className="text-foreground">Card Features</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-medium text-foreground mb-2">
                    Tier Badge
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Your current tier based on points: Bronze, Silver, Gold,
                    Platinum, Diamond, or Champion
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-medium text-foreground mb-2">
                    Player Stats
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Shows your points, matches played, and win rate at a glance
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-medium text-foreground mb-2">
                    QR Verification
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Scannable QR code for instant profile verification
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted border border-border">
                  <h4 className="font-medium text-foreground mb-2">
                    Organization
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Displays your affiliated organization if you&apos;re part of
                    one
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
