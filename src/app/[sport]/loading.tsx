import { Loader2, Trophy } from 'lucide-react';

export default function SportLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Trophy className="h-12 w-12 text-primary animate-pulse" />
          <Loader2 className="h-5 w-5 absolute -bottom-1 -right-1 animate-spin text-primary" />
        </div>
        <p className="text-muted-foreground text-sm">Loading sport...</p>
      </div>
    </div>
  );
}
