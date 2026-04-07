'use client';

/**
 * Tournament Invite Share Component
 * Generate and share tournament invitation deep links
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Share2, Link, Users, Copy, Check, Mail, MessageCircle, ExternalLink, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface TournamentInviteShareProps {
  tournamentId: string;
  tournamentName: string;
  sport: 'CORNHOLE' | 'DARTS';
  entryFee: number;
  maxPlayers: number;
  currentRegistrations: number;
  regDeadline: Date;
}

interface InviteData {
  inviteCode: string;
  inviteUrl: string;
  shortUrl: string;
  deepLinkUrl: string;
}

export function TournamentInviteShare({
  tournamentId,
  tournamentName,
  sport,
  entryFee,
  maxPlayers,
  currentRegistrations,
  regDeadline,
}: TournamentInviteShareProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Generate invite link
  const generateInvite = useCallback(async () => {
    if (inviteData) return; // Already generated

    setIsLoading(true);
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DIRECT' }),
      });

      if (response.ok) {
        const data = await response.json();
        setInviteData(data.data);
      } else {
        toast.error('Failed to generate invite link');
      }
    } catch {
      toast.error('Failed to generate invite link');
    } finally {
      setIsLoading(false);
    }
  }, [tournamentId, inviteData]);

  // Copy to clipboard
  const copyToClipboard = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success('Link copied!');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  // Share via native share API
  const nativeShare = useCallback(async () => {
    if (!inviteData) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${tournamentName}`,
          text: `Join me at ${tournamentName} on VALORHIVE! ${sport} tournament ${entryFee > 0 ? `(Entry: ₹${entryFee})` : '(Free entry)'}`,
          url: inviteData.shortUrl,
        });
      } catch {
        // User cancelled
      }
    }
  }, [inviteData, tournamentName, sport, entryFee]);

  // WhatsApp share
  const shareViaWhatsApp = useCallback(() => {
    if (!inviteData) return;
    const text = encodeURIComponent(
      `Join me at ${tournamentName} on VALORHIVE! 🎯\n\n` +
      `${sport} tournament\n` +
      `${entryFee > 0 ? `Entry: ₹${entryFee}\n` : 'Free entry!\n'}` +
      `Register now: ${inviteData.shortUrl}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }, [inviteData, tournamentName, sport, entryFee]);

  // Email share
  const shareViaEmail = useCallback(() => {
    if (!inviteData) return;
    const subject = encodeURIComponent(`Join ${tournamentName} on VALORHIVE`);
    const body = encodeURIComponent(
      `Hi,\n\n` +
      `I'd like to invite you to join me at ${tournamentName}!\n\n` +
      `Tournament Details:\n` +
      `- Sport: ${sport}\n` +
      `- Entry: ${entryFee > 0 ? `₹${entryFee}` : 'Free'}\n` +
      `- Deadline: ${new Date(regDeadline).toLocaleDateString()}\n\n` +
      `Register here: ${inviteData.shortUrl}\n\n` +
      `See you there!`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  }, [inviteData, tournamentName, sport, entryFee, regDeadline]);

  const spotsRemaining = maxPlayers - currentRegistrations;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button onClick={generateInvite} className="gap-2">
          <Share2 className="h-4 w-4" />
          Invite Players
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite Players to {tournamentName}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : inviteData ? (
          <div className="space-y-6">
            {/* Tournament Info */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <p className="font-medium">{tournamentName}</p>
                <p className="text-sm text-muted-foreground">{sport}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  {spotsRemaining} spots left
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentRegistrations}/{maxPlayers} registered
                </p>
              </div>
            </div>

            {/* Invite Link */}
            <div className="space-y-2">
              <Label>Your Invite Link</Label>
              <div className="flex gap-2">
                <Input
                  value={inviteData.shortUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(inviteData.shortUrl, 'url')}
                >
                  {copied === 'url' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Quick Share */}
            <div className="space-y-3">
              <Label>Quick Share</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareViaWhatsApp}
                  className="gap-2"
                >
                  <MessageCircle className="h-4 w-4 text-green-600" />
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={shareViaEmail}
                  className="gap-2"
                >
                  <Mail className="h-4 w-4 text-blue-600" />
                  Email
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={nativeShare}
                  className="gap-2"
                >
                  <Share2 className="h-4 w-4" />
                  More
                </Button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Clicks</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">0</div>
                <div className="text-xs text-muted-foreground">Signups</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Expires in</div>
                <div className="text-sm font-medium">7 days</div>
              </div>
            </div>

            {/* Deep Link Info */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-400 mb-1">
                Deep Link
              </p>
              <code className="text-xs text-blue-600 dark:text-blue-300 break-all">
                {inviteData.deepLinkUrl}
              </code>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Failed to generate invite link
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Compact invite button for inline use
export function CompactInviteButton({
  tournamentId,
  tournamentName,
}: {
  tournamentId: string;
  tournamentName: string;
}) {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateAndCopy = useCallback(async () => {
    try {
      const response = await fetch(`/api/tournaments/${tournamentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'DIRECT' }),
      });

      if (response.ok) {
        const data = await response.json();
        setInviteUrl(data.data.shortUrl);
        
        await navigator.clipboard.writeText(data.data.shortUrl);
        setCopied(true);
        toast.success('Invite link copied!');
        
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      toast.error('Failed to generate invite');
    }
  }, [tournamentId]);

  return (
    <Button variant="ghost" size="sm" onClick={generateAndCopy} className="gap-1">
      {copied ? (
        <>
          <Check className="h-3 w-3 text-green-500" />
          Copied!
        </>
      ) : (
        <>
          <Link className="h-3 w-3" />
          Copy Invite Link
        </>
      )}
    </Button>
  );
}
