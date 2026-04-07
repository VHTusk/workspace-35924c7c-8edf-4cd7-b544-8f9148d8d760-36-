'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, ArrowLeft, Radio } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function LiveBracketError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const sport = params?.sport as string || 'cornhole';

  useEffect(() => {
    console.error('Live bracket error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Radio className="h-8 w-8 text-destructive animate-pulse" />
          </div>
          <CardTitle className="text-2xl">Live View Error</CardTitle>
          <CardDescription>
            Unable to load the live bracket view. The match may have ended or there was a connection issue.
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
              Reconnect
            </Button>
            <Button variant="outline" asChild className="gap-2">
              <Link href={`/${sport}/live`}>
                <ArrowLeft className="h-4 w-4" />
                All live matches
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
