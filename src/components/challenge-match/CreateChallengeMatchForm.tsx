'use client';

import { useState } from 'react';
import {
  Calendar, MapPin, Users, IndianRupee, Trophy, Building2,
  Plus, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CreateChallengeMatchFormProps {
  cityId: string;
  sport: string;
  userId: string;
  onSuccess?: () => void;
  compact?: boolean;
  isCornhole?: boolean;
}

export function CreateChallengeMatchForm({
  cityId,
  sport,
  userId,
  onSuccess,
  compact = false,
  isCornhole = false,
}: CreateChallengeMatchFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSponsor, setHasSponsor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    matchDate: '',
    registrationDeadline: '',
    venueName: '',
    venueAddress: '',
    venueMapsUrl: '',
    format: 'INDIVIDUAL',
    minPlayers: '8',
    maxPlayers: '32',
    entryFee: '100',
    basePrizePool: '0',
    sponsorName: '',
    sponsorLogo: '',
    sponsorAmount: '0',
    sponsorMessage: '',
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title.trim()) {
      toast.error('Please enter a match title');
      return;
    }
    if (!formData.matchDate) {
      toast.error('Please select a match date');
      return;
    }
    if (!formData.registrationDeadline) {
      toast.error('Please select a registration deadline');
      return;
    }
    if (!formData.venueName.trim()) {
      toast.error('Please enter a venue name');
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert entry fee and other amounts to paise
      const entryFeePaise = Math.round(parseFloat(formData.entryFee) * 100);
      const basePrizePaise = Math.round(parseFloat(formData.basePrizePool) * 100);
      const sponsorAmountPaise = hasSponsor ? Math.round(parseFloat(formData.sponsorAmount) * 100) : 0;

      const response = await fetch('/api/challenge-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          sport: sport.toUpperCase(),
          title: formData.title,
          description: formData.description || null,
          matchDate: formData.matchDate,
          registrationDeadline: formData.registrationDeadline,
          venueName: formData.venueName,
          venueAddress: formData.venueAddress || null,
          venueMapsUrl: formData.venueMapsUrl || null,
          format: formData.format,
          minPlayers: parseInt(formData.minPlayers),
          maxPlayers: parseInt(formData.maxPlayers),
          entryFee: entryFeePaise,
          basePrizePool: basePrizePaise,
          sponsorName: hasSponsor ? formData.sponsorName : null,
          sponsorLogo: hasSponsor ? formData.sponsorLogo : null,
          sponsorAmount: sponsorAmountPaise,
          sponsorMessage: hasSponsor ? formData.sponsorMessage : null,
          createdById: userId,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Challenge match created successfully!');
        // Reset form
        setFormData({
          title: '',
          description: '',
          matchDate: '',
          registrationDeadline: '',
          venueName: '',
          venueAddress: '',
          venueMapsUrl: '',
          format: 'INDIVIDUAL',
          minPlayers: '8',
          maxPlayers: '32',
          entryFee: '100',
          basePrizePool: '0',
          sponsorName: '',
          sponsorLogo: '',
          sponsorAmount: '0',
          sponsorMessage: '',
        });
        setHasSponsor(false);
        onSuccess?.();
      } else {
        toast.error(data.error || 'Failed to create challenge match');
      }
    } catch (error) {
      console.error('Error creating challenge match:', error);
      toast.error('Failed to create challenge match');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get minimum dates for date inputs
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-900/20" : "bg-teal-50 dark:bg-teal-900/20";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="space-y-4">
        <h3 className={cn("text-sm font-semibold uppercase tracking-wider", primaryTextClass)}>
          Basic Information
        </h3>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">Match Title <span className="text-red-500">*</span></Label>
            <Input
              id="title"
              placeholder="e.g., Weekend Challenge - Jaipur"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="bg-background border-border"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the challenge match, rules, etc."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={2}
              className="bg-background border-border resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="matchDate" className="text-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Match Date <span className="text-red-500">*</span>
              </Label>
              <Input
                id="matchDate"
                type="date"
                min={tomorrow}
                value={formData.matchDate}
                onChange={(e) => handleChange('matchDate', e.target.value)}
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationDeadline" className="text-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Registration Deadline <span className="text-red-500">*</span>
              </Label>
              <Input
                id="registrationDeadline"
                type="date"
                min={today}
                max={formData.matchDate || undefined}
                value={formData.registrationDeadline}
                onChange={(e) => handleChange('registrationDeadline', e.target.value)}
                className="bg-background border-border"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="format" className="text-foreground">Format</Label>
            <Select value={formData.format} onValueChange={(v) => handleChange('format', v)}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Individual (1v1)</SelectItem>
                <SelectItem value="DOUBLES">Doubles (2v2)</SelectItem>
                <SelectItem value="TEAM">Team</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Venue */}
      <div className="space-y-4">
        <h3 className={cn("text-sm font-semibold uppercase tracking-wider flex items-center gap-2", primaryTextClass)}>
          <MapPin className="h-4 w-4" />
          Venue
        </h3>
        
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="venueName" className="text-foreground">Venue Name <span className="text-red-500">*</span></Label>
            <Input
              id="venueName"
              placeholder="e.g., Jaipur Sports Complex"
              value={formData.venueName}
              onChange={(e) => handleChange('venueName', e.target.value)}
              className="bg-background border-border"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venueAddress" className="text-foreground">Full Address</Label>
            <Textarea
              id="venueAddress"
              placeholder="Complete address with landmarks"
              value={formData.venueAddress}
              onChange={(e) => handleChange('venueAddress', e.target.value)}
              rows={2}
              className="bg-background border-border resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="venueMapsUrl" className="text-foreground">Google Maps Link</Label>
            <Input
              id="venueMapsUrl"
              type="url"
              placeholder="https://maps.google.com/..."
              value={formData.venueMapsUrl}
              onChange={(e) => handleChange('venueMapsUrl', e.target.value)}
              className="bg-background border-border"
            />
          </div>
        </div>
      </div>

      {/* Players & Fees */}
      <div className="space-y-4">
        <h3 className={cn("text-sm font-semibold uppercase tracking-wider flex items-center gap-2", primaryTextClass)}>
          <Users className="h-4 w-4" />
          Players & Fees
        </h3>
        
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minPlayers" className="text-foreground">Min Players <span className="text-red-500">*</span></Label>
              <Input
                id="minPlayers"
                type="number"
                min="2"
                max="128"
                value={formData.minPlayers}
                onChange={(e) => handleChange('minPlayers', e.target.value)}
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPlayers" className="text-foreground">Max Players <span className="text-red-500">*</span></Label>
              <Input
                id="maxPlayers"
                type="number"
                min={formData.minPlayers}
                max="256"
                value={formData.maxPlayers}
                onChange={(e) => handleChange('maxPlayers', e.target.value)}
                className="bg-background border-border"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entryFee" className="text-foreground flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                Entry Fee (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="entryFee"
                type="number"
                min="0"
                step="10"
                value={formData.entryFee}
                onChange={(e) => handleChange('entryFee', e.target.value)}
                className="bg-background border-border"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="basePrizePool" className="text-foreground flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                Base Prize Pool (₹)
              </Label>
              <Input
                id="basePrizePool"
                type="number"
                min="0"
                step="100"
                value={formData.basePrizePool}
                onChange={(e) => handleChange('basePrizePool', e.target.value)}
                className="bg-background border-border"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
            💡 70% of entry fees go to prize pool. 30% covers platform & organization costs.
          </p>
        </div>
      </div>

      {/* Sponsor - Collapsible */}
      <div className={cn("rounded-lg border", primaryBorderClass, primaryBgClass)}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 flex items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <Building2 className={cn("h-4 w-4", primaryTextClass)} />
            <span className="font-medium text-foreground">Sponsor Details (Optional)</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        
        {showAdvanced && (
          <div className="p-4 pt-0 space-y-4 border-t border-inherit">
            <div className="flex items-center gap-2 mb-2">
              <Switch
                checked={hasSponsor}
                onCheckedChange={setHasSponsor}
              />
              <Label className="text-foreground">Has Sponsor?</Label>
            </div>

            {hasSponsor && (
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sponsorName" className="text-foreground">Sponsor Name</Label>
                    <Input
                      id="sponsorName"
                      placeholder="Company/Organization name"
                      value={formData.sponsorName}
                      onChange={(e) => handleChange('sponsorName', e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sponsorAmount" className="text-foreground flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" />
                      Sponsorship Amount (₹)
                    </Label>
                    <Input
                      id="sponsorAmount"
                      type="number"
                      min="0"
                      step="100"
                      value={formData.sponsorAmount}
                      onChange={(e) => handleChange('sponsorAmount', e.target.value)}
                      className="bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sponsorLogo" className="text-foreground">Sponsor Logo URL</Label>
                  <Input
                    id="sponsorLogo"
                    type="url"
                    placeholder="https://..."
                    value={formData.sponsorLogo}
                    onChange={(e) => handleChange('sponsorLogo', e.target.value)}
                    className="bg-background border-border"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sponsorMessage" className="text-foreground">Sponsor Message</Label>
                  <Textarea
                    id="sponsorMessage"
                    placeholder="A message from the sponsor..."
                    value={formData.sponsorMessage}
                    onChange={(e) => handleChange('sponsorMessage', e.target.value)}
                    rows={2}
                    className="bg-background border-border resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="pt-4">
        <Button 
          type="submit" 
          disabled={isSubmitting} 
          className={cn("w-full text-white font-medium py-3", primaryBtnClass)}
          size="lg"
        >
          {isSubmitting ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating Match...
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Plus className="h-5 w-5" />
              Create Challenge Match
            </div>
          )}
        </Button>
      </div>

      {/* Info Box */}
      <div className="p-4 bg-muted/50 rounded-lg text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-2">How Challenge Matches Work:</p>
        <ol className="list-decimal list-inside space-y-1 ml-2">
          <li>Create a challenge match with minimum player requirement</li>
          <li>Players join for free until minimum is reached</li>
          <li>Once minimum players join, all are asked to pay entry fee</li>
          <li>Match is confirmed when all players pay</li>
        </ol>
      </div>
    </form>
  );
}
