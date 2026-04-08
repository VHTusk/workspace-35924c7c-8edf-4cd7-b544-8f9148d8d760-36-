"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const SPORTS = [
  {
    slug: "cornhole",
    label: "Cornhole",
    description: "Continue into cornhole tournaments, rankings, and player dashboard.",
  },
  {
    slug: "darts",
    label: "Darts",
    description: "Continue into darts tournaments, rankings, and player dashboard.",
  },
];

type SelectSportClientProps = {
  hasPendingGoogleSelection: boolean;
};

export function SelectSportClient({ hasPendingGoogleSelection }: SelectSportClientProps) {
  const router = useRouter();
  const [loadingSport, setLoadingSport] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSelect = async (sport: string) => {
    setLoadingSport(sport);
    setError("");

    try {
      const response = await fetch("/api/auth/google-onetap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sport }),
      });

      const data = (await response.json()) as {
        success: boolean;
        message?: string;
        redirectTo?: string;
      };

      if (!response.ok || !data.success) {
        setError(data.message || "Google sign-in is unavailable right now. Please try again.");
        return;
      }

      router.push(data.redirectTo || "/post-login");
    } catch (requestError) {
      console.error("Google sport selection failed", requestError);
      setError("Google sign-in is unavailable right now. Please try again.");
    } finally {
      setLoadingSport(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">Choose your sport</h1>
          <p className="mt-2 text-muted-foreground">
            {hasPendingGoogleSelection
              ? "Pick the sport you want to use with your Google account."
              : "Start from a sport page to continue with Google sign-in."}
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {SPORTS.map((sport) => (
            <Card key={sport.slug} className="border-border/60">
              <CardHeader>
                <CardTitle>{sport.label}</CardTitle>
                <CardDescription>{sport.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {hasPendingGoogleSelection ? (
                  <Button
                    className="w-full"
                    onClick={() => void handleSelect(sport.slug)}
                    disabled={loadingSport !== null}
                  >
                    {loadingSport === sport.slug ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Continuing...
                      </>
                    ) : (
                      `Continue with ${sport.label}`
                    )}
                  </Button>
                ) : (
                  <Button asChild className="w-full">
                    <Link href={`/${sport.slug}/login`}>Go to {sport.label}</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
