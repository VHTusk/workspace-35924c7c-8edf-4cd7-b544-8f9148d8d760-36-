"use client";

import { useEffect } from "react";
import { WifiOff, RefreshCw, Home, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function OfflinePage() {
  useEffect(() => {
    // Register service worker for offline support (production only)
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <WifiOff className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">You&apos;re Offline</CardTitle>
          <CardDescription>
            ValorHive needs an internet connection for most features. 
            Some cached content may still be available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <h3 className="font-medium mb-2 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Available Offline
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• View cached tournament info</li>
              <li>• Browse cached leaderboards</li>
              <li>• View your profile</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => window.location.reload()} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            <Link href="/">
              <Button variant="outline" className="w-full gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Your data will sync automatically when you&apos;re back online.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
