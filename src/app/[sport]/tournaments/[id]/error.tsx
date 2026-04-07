'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, ArrowLeft, Trophy } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function TournamentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const sport = params?.sport as string || 'cornhole';

  useEffect(() => {
    console.error('Tournament error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Tournament Error</CardTitle>
          <CardDescription>
            Failed to load this tournament. It may not exist or there was a connection issue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {process.env.NODE_ENV === 'development' && (
            <div className="p-3 bg-muted rounded-lg text-left text-sm text-muted-foreground overflow-auto max-h-32">
              {error.message}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button onClick={reset} variant="default" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href={`/${sport}/tournaments`}>
                <ArrowLeft className="h-4 w-4" />
                All tournaments
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
