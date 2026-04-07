'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Trophy, MapPin, Users, IndianRupee, Calendar, Clock,
  ChevronRight, ChevronLeft, Loader2, Check, AlertCircle,
  Building2, Eye, Settings, Info, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types
interface Venue {
  id: string;
  name: string;
  displayName: string;
  address: string;
  locality?: string;
  totalPlayAreas: number;
  playAreas: Array<{ id: string; name: string; type: string; capacity: number }>;
  openingTime: number;
  closingTime: number;
  defaultMatchDuration: number;
  isVerified: boolean;
}

interface TimeSlot {
  id: string;
  playAreaId: string;
  playAreaName: string;
  startTime: number;
  endTime: number;
  startTimeStr: string;
  endTimeStr: string;
  duration: number;
  isAvailable: boolean;
}

interface VenueSlotsResponse {
  success: boolean;
  data: {
    venue: { id: string; name: string; displayName: string; address: string };
    date: string;
    requirements: {
      playerSlots: number;
      requiredDuration: number;
      requiredDurationStr: string;
    };
    playAreas: Array<{
      playAreaId: string;
      playAreaName: string;
      slots: TimeSlot[];
    }>;
    hasAvailability: boolean;
    alternatives: Array<{ type: string; message: string }>;
  };
}

interface FinancialPreview {
  entryFee: number;
  playerSlots: number;
  totalCollection: number;
  adminFeePercentage: number;
  adminFee: number;
  prizePoolPercentage: number;
  prizePool: number;
  firstPrizePercentage: number;
  firstPrize: number;
  secondPrizePercentage: number;
  secondPrize: number;
}

// Constants
const MATCH_TYPES = [
  { value: '1v1', label: '1 vs 1 (Individual)', minPlayers: 2 },
  { value: '2v2', label: '2 vs 2 (Doubles)', minPlayers: 4 },
  { value: 'TEAM', label: 'Team Match', minPlayers: 6 },
];

const PLAYER_SLOTS_OPTIONS = [2, 4, 8, 16, 32];

const MATCH_FORMATS = [
  { value: 'BEST_OF_1', label: 'Best of 1' },
  { value: 'BEST_OF_3', label: 'Best of 3' },
  { value: 'BEST_OF_5', label: 'Best of 5' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public', description: 'Anyone can see and join' },
  { value: 'DISTRICT_ONLY', label: 'District Only', description: 'Only players from this district' },
  { value: 'INVITE_ONLY', label: 'Invite Only', description: 'Players need an invite link' },
];

const SKILL_LEVELS = [
  { value: 'OPEN', label: 'Open', description: 'All skill levels welcome' },
  { value: 'BEGINNER', label: 'Beginner', description: 'New to the sport' },
  { value: 'INTERMEDIATE', label: 'Intermediate', description: 'Regular player' },
  { value: 'ADVANCED', label: 'Advanced', description: 'Competitive player' },
];

const ENTRY_FEE_OPTIONS = [
  { value: 50000, label: '₹500' },
  { value: 100000, label: '₹1,000', recommended: true },
  { value: 200000, label: '₹2,000' },
  { value: 500000, label: '₹5,000' },
  { value: 1000000, label: '₹10,000' },
];

const STEPS = [
  { id: 'details', title: 'Match Details', icon: Trophy },
  { id: 'venue', title: 'Venue & Schedule', icon: MapPin },
  { id: 'prize', title: 'Prize & Fees', icon: IndianRupee },
  { id: 'rules', title: 'Rules', icon: Settings },
  { id: 'visibility', title: 'Visibility', icon: Eye },
  { id: 'review', title: 'Review', icon: Check },
];

// Calculate financial preview
function calculateFinancials(entryFee: number, playerSlots: number): FinancialPreview {
  const adminFeePercentage = 30;
  const prizePoolPercentage = 70;
  
  const totalCollection = entryFee * playerSlots;
  const adminFee = Math.floor(totalCollection * (adminFeePercentage / 100));
  const prizePool = Math.floor(totalCollection * (prizePoolPercentage / 100));
  
  let firstPrize: number;
  let secondPrize: number;
  let firstPrizePercentage: number;
  let secondPrizePercentage: number;
  
  if (playerSlots === 2) {
    firstPrize = prizePool;
    secondPrize = 0;
    firstPrizePercentage = 100;
    secondPrizePercentage = 0;
  } else {
    firstPrizePercentage = 70;
    secondPrizePercentage = 30;
    firstPrize = Math.floor(prizePool * (firstPrizePercentage / 100));
    secondPrize = Math.floor(prizePool * (secondPrizePercentage / 100));
  }
  
  return {
    entryFee,
    playerSlots,
    totalCollection,
    adminFeePercentage,
    adminFee,
    prizePoolPercentage,
    prizePool,
    firstPrizePercentage,
    firstPrize,
    secondPrizePercentage,
    secondPrize,
  };
}

// Format minutes to time string
function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`;
}

interface CreateChallengeMatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cityId: string;
  cityName: string;
  stateName: string;
  sport: string;
  userId: string;
  onSuccess?: (matchId: string) => void;
  isCornhole?: boolean;
}

export function CreateChallengeMatchModal({
  open,
  onOpenChange,
  cityId,
  cityName,
  stateName,
  sport,
  userId,
  onSuccess,
  isCornhole = false,
}: CreateChallengeMatchModalProps) {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Data
  const [venues, setVenues] = useState<Venue[]>([]);
  const [availableSlots, setAvailableSlots] = useState<VenueSlotsResponse['data'] | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    // Match Details
    title: '',
    description: '',
    matchType: '1v1',
    playerSlots: 8,
    entryFee: 100000, // ₹1000 default (in paise)
    
    // Venue & Schedule
    venueId: '',
    selectedVenue: null as Venue | null,
    matchDate: '',
    startTime: null as number | null,
    estimatedDuration: 120, // 2 hours default
    
    // Rules
    matchFormat: 'BEST_OF_1',
    scoreTarget: '',
    rules: '',
    tieBreakRule: '',
    
    // Visibility
    visibility: 'PUBLIC',
    skillLevel: 'OPEN',
  });
  
  // Derived state
  const financials = calculateFinancials(formData.entryFee, formData.playerSlots);
  
  const primaryBtnClass = isCornhole ? "bg-green-600 hover:bg-green-700" : "bg-teal-600 hover:bg-teal-700";
  const primaryTextClass = isCornhole ? "text-green-600" : "text-teal-600";
  const primaryBgClass = isCornhole ? "bg-green-50 dark:bg-green-900/20" : "bg-teal-50 dark:bg-teal-900/20";
  const primaryBorderClass = isCornhole ? "border-green-200 dark:border-green-800" : "border-teal-200 dark:border-teal-800";
  
  // Fetch venues when modal opens
  useEffect(() => {
    if (open && cityId) {
      fetchVenues();
    }
  }, [open, cityId]);
  
  const fetchVenues = async () => {
    setLoadingVenues(true);
    try {
      const response = await fetch(`/api/venues?cityId=${cityId}&sport=${sport}`);
      const data = await response.json();
      if (data.success) {
        setVenues(data.data.venues);
      }
    } catch (error) {
      console.error('Failed to fetch venues:', error);
    } finally {
      setLoadingVenues(false);
    }
  };
  
  // Fetch slots when venue and date are selected
  const fetchSlots = useCallback(async () => {
    if (!formData.venueId || !formData.matchDate || !formData.playerSlots) return;
    
    setLoadingSlots(true);
    try {
      const response = await fetch(
        `/api/venues/${formData.venueId}/slots?date=${formData.matchDate}&playerSlots=${formData.playerSlots}&matchType=${formData.matchType}&matchFormat=${formData.matchFormat}&sport=${sport}`
      );
      const data = await response.json();
      if (data.success) {
        setAvailableSlots(data.data);
        // Update estimated duration from server calculation
        if (data.data.requirements?.requiredDuration) {
          setFormData(prev => ({
            ...prev,
            estimatedDuration: data.data.requirements.requiredDuration
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  }, [formData.venueId, formData.matchDate, formData.playerSlots, formData.matchType, formData.matchFormat, sport]);
  
  useEffect(() => {
    if (formData.venueId && formData.matchDate) {
      fetchSlots();
    }
  }, [formData.venueId, formData.matchDate, fetchSlots]);
  
  // Handle venue selection
  const handleVenueChange = (venueId: string) => {
    const venue = venues.find(v => v.id === venueId);
    setFormData(prev => ({
      ...prev,
      venueId,
      selectedVenue: venue || null,
      startTime: null,
    }));
    setAvailableSlots(null);
  };
  
  // Handle form field changes
  const handleChange = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  // Navigation
  const nextStep = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };
  
  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };
  
  // Validation
  const validateCurrentStep = (): boolean => {
    switch (STEPS[currentStep].id) {
      case 'details':
        if (!formData.title.trim()) {
          toast.error('Please enter a match title');
          return false;
        }
        return true;
      case 'venue':
        if (!formData.venueId) {
          toast.error('Please select a venue');
          return false;
        }
        if (!formData.matchDate) {
          toast.error('Please select a match date');
          return false;
        }
        if (!formData.startTime) {
          toast.error('Please select a start time');
          return false;
        }
        return true;
      case 'prize':
        if (formData.entryFee < 50000) {
          toast.error('Minimum entry fee is ₹500');
          return false;
        }
        return true;
      default:
        return true;
    }
  };
  
  // Submit
  const handleSubmit = async () => {
    if (!validateCurrentStep()) return;
    
    setIsSubmitting(true);
    try {
      const registrationDeadline = new Date(formData.matchDate);
      registrationDeadline.setDate(registrationDeadline.getDate() - 1); // 1 day before match
      
      const response = await fetch('/api/challenge-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cityId,
          sport: sport.toUpperCase(),
          title: formData.title,
          description: formData.description || null,
          matchDate: formData.matchDate,
          registrationDeadline: registrationDeadline.toISOString(),
          // Venue
          venueId: formData.venueId,
          venueName: formData.selectedVenue?.name,
          venueAddress: formData.selectedVenue?.address,
          // Scheduling
          startTime: formData.startTime,
          estimatedDuration: formData.estimatedDuration,
          // Format
          matchType: formData.matchType,
          playerSlots: formData.playerSlots,
          minPlayers: formData.playerSlots,
          maxPlayers: formData.playerSlots,
          // Rules
          matchFormat: formData.matchFormat,
          scoreTarget: formData.scoreTarget ? parseInt(formData.scoreTarget) : null,
          rules: formData.rules || null,
          tieBreakRule: formData.tieBreakRule || null,
          // Fee
          entryFee: formData.entryFee,
          // Visibility
          visibility: formData.visibility,
          skillLevel: formData.skillLevel,
          // Creator
          createdById: userId,
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Challenge match created successfully!');
        onSuccess?.(data.data.id);
        onOpenChange(false);
        resetForm();
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
  
  const resetForm = () => {
    setCurrentStep(0);
    setFormData({
      title: '',
      description: '',
      matchType: '1v1',
      playerSlots: 8,
      entryFee: 100000,
      venueId: '',
      selectedVenue: null,
      matchDate: '',
      startTime: null,
      estimatedDuration: 120,
      matchFormat: 'BEST_OF_1',
      scoreTarget: '',
      rules: '',
      tieBreakRule: '',
      visibility: 'PUBLIC',
      skillLevel: 'OPEN',
    });
    setAvailableSlots(null);
  };
  
  // Get minimum date (tomorrow)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  
  // Get all available slots from all play areas
  const allSlots = availableSlots?.playAreas?.flatMap(pa => pa.slots) || [];
  
  // Render step content
  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'details':
        return (
          <div className="space-y-6">
            {/* Auto-filled Sport & District */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Sport</Label>
                <div className={cn("p-3 rounded-lg border", primaryBgClass, primaryBorderClass)}>
                  <span className={cn("font-medium capitalize", primaryTextClass)}>
                    {sport.toLowerCase()}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">District</Label>
                <div className={cn("p-3 rounded-lg border", primaryBgClass, primaryBorderClass)}>
                  <span className={cn("font-medium", primaryTextClass)}>
                    {cityName}, {stateName}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Match Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                placeholder="e.g., Weekend Challenge - Jaipur"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className="bg-background"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe your challenge match..."
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="bg-background resize-none"
              />
            </div>
            
            {/* Match Type & Player Slots */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Match Type</Label>
                <Select value={formData.matchType} onValueChange={(v) => handleChange('matchType', v)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATCH_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Player Slots</Label>
                <Select 
                  value={formData.playerSlots.toString()} 
                  onValueChange={(v) => handleChange('playerSlots', parseInt(v))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAYER_SLOTS_OPTIONS.map(slots => (
                      <SelectItem key={slots} value={slots.toString()}>
                        {slots} Players
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );
        
      case 'venue':
        return (
          <div className="space-y-6">
            {/* Venue Selection */}
            <div className="space-y-2">
              <Label>Select Venue <span className="text-red-500">*</span></Label>
              {loadingVenues ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : venues.length === 0 ? (
                <div className="p-4 border-2 border-dashed rounded-lg text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground text-sm">No venues available in this district</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Contact admin to add venues</p>
                </div>
              ) : (
                <Select value={formData.venueId} onValueChange={handleVenueChange}>
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venues.map(venue => (
                      <SelectItem key={venue.id} value={venue.id}>
                        <div className="flex items-center gap-2">
                          <span>{venue.displayName || venue.name}</span>
                          {venue.locality && (
                            <span className="text-muted-foreground text-xs">
                              ({venue.locality})
                            </span>
                          )}
                          {venue.isVerified && (
                            <Badge variant="outline" className="text-xs ml-1">Verified</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              
              {/* Selected venue details */}
              {formData.selectedVenue && (
                <Card className={cn("mt-3", primaryBorderClass, primaryBgClass)}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <MapPin className={cn("h-5 w-5 mt-0.5", primaryTextClass)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{formData.selectedVenue.name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {formData.selectedVenue.address}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{formData.selectedVenue.totalPlayAreas} play areas</span>
                          <span>
                            {formatTime(formData.selectedVenue.openingTime)} - {formatTime(formData.selectedVenue.closingTime)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
            
            {/* Date Selection */}
            <div className="space-y-2">
              <Label>Match Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                min={tomorrow}
                value={formData.matchDate}
                onChange={(e) => {
                  handleChange('matchDate', e.target.value);
                  handleChange('startTime', null);
                }}
                className="bg-background"
              />
            </div>
            
            {/* Time Slot Selection */}
            {formData.venueId && formData.matchDate && (
              <div className="space-y-2">
                <Label>Start Time <span className="text-red-500">*</span></Label>
                
                {loadingSlots ? (
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : availableSlots ? (
                  <div className="space-y-3">
                    {/* Estimated Duration Info */}
                    {availableSlots.requirements && (
                      <div className={cn("p-3 rounded-lg flex items-center gap-2", primaryBgClass)}>
                        <Clock className={cn("h-4 w-4", primaryTextClass)} />
                        <span className="text-sm">
                          Estimated duration: <strong>{availableSlots.requirements.requiredDurationStr}</strong>
                        </span>
                      </div>
                    )}
                    
                    {/* Time Slots Grid */}
                    {allSlots.length > 0 ? (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {allSlots.map((slot, idx) => (
                          <button
                            key={`${slot.playAreaId}-${idx}`}
                            type="button"
                            disabled={!slot.isAvailable}
                            onClick={() => handleChange('startTime', slot.startTime)}
                            className={cn(
                              "p-2 rounded-lg border text-sm text-center transition-all",
                              formData.startTime === slot.startTime
                                ? cn("border-2", primaryBorderClass, primaryBgClass)
                                : "border-border hover:border-primary/50",
                              !slot.isAvailable && "opacity-50 cursor-not-allowed"
                            )}
                          >
                            <div className="font-medium">{slot.startTimeStr}</div>
                            <div className="text-xs text-muted-foreground">{slot.playAreaName}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 border-2 border-dashed rounded-lg text-center">
                        <AlertCircle className="h-6 w-6 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No slots available for this date</p>
                        {availableSlots.alternatives?.map((alt, idx) => (
                          <p key={idx} className="text-xs text-muted-foreground/70 mt-1">
                            💡 {alt.message}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {formData.startTime && (
                      <div className="text-sm text-muted-foreground">
                        Match time: <strong>{formatTime(formData.startTime)}</strong> - 
                        <strong> {formatTime(formData.startTime + formData.estimatedDuration)}</strong>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
        
      case 'prize':
        return (
          <div className="space-y-6">
            {/* Entry Fee Selection */}
            <div className="space-y-2">
              <Label>Entry Fee Per Player <span className="text-red-500">*</span></Label>
              <div className="grid grid-cols-3 gap-2">
                {ENTRY_FEE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('entryFee', option.value)}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all relative",
                      formData.entryFee === option.value
                        ? cn("border-2", primaryBorderClass, primaryBgClass)
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <div className="font-semibold">{option.label}</div>
                    {option.recommended && (
                      <Badge className={cn("absolute -top-2 -right-2 text-[10px]", primaryBtnClass)}>
                        Recommended
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
              
              {/* Custom fee input */}
              <div className="mt-3">
                <Label className="text-sm text-muted-foreground">Or enter custom amount (₹)</Label>
                <Input
                  type="number"
                  min={500}
                  step={100}
                  value={formData.entryFee / 100}
                  onChange={(e) => handleChange('entryFee', Math.max(50000, parseFloat(e.target.value) * 100))}
                  className="bg-background mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum entry fee: ₹500
                </p>
              </div>
            </div>
            
            {/* Financial Preview */}
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IndianRupee className="h-5 w-5" />
                  Financial Preview
                </CardTitle>
                <CardDescription>
                  Live calculation based on {formData.playerSlots} players at ₹{(formData.entryFee / 100).toLocaleString()} each
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Collection</p>
                    <p className="text-xl font-bold text-blue-600">
                      ₹{(financials.totalCollection / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                    <p className="text-xs text-muted-foreground">Admin Fee (30%)</p>
                    <p className="text-xl font-bold text-amber-600">
                      ₹{(financials.adminFee / 100).toLocaleString()}
                    </p>
                  </div>
                </div>
                
                <Separator />
                
                {/* Prize Pool */}
                <div className={cn("p-4 rounded-lg", primaryBgClass)}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium">Net Prize Pool</p>
                    <p className={cn("text-2xl font-bold", primaryTextClass)}>
                      ₹{(financials.prizePool / 100).toLocaleString()}
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        1st Place ({financials.firstPrizePercentage}%)
                      </span>
                      <span className="font-semibold text-yellow-600">
                        ₹{(financials.firstPrize / 100).toLocaleString()}
                      </span>
                    </div>
                    
                    {financials.secondPrize > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <Trophy className="h-4 w-4 text-gray-400" />
                          2nd Place ({financials.secondPrizePercentage}%)
                        </span>
                        <span className="font-semibold text-gray-600">
                          ₹{(financials.secondPrize / 100).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
                  <Info className="h-3 w-3 inline mr-1" />
                  {formData.playerSlots === 2 
                    ? "For 2-player matches, the winner takes 100% of the prize pool."
                    : "Prize is awarded to 1st and 2nd place only (70%/30% split)."}
                </div>
              </CardContent>
            </Card>
          </div>
        );
        
      case 'rules':
        return (
          <div className="space-y-6">
            {/* Match Format */}
            <div className="space-y-2">
              <Label>Match Format</Label>
              <Select value={formData.matchFormat} onValueChange={(v) => handleChange('matchFormat', v)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_FORMATS.map(format => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Best of 1 = single game, Best of 3 = first to win 2 games, etc.
              </p>
            </div>
            
            {/* Score Target (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="scoreTarget">Score Target (Optional)</Label>
              <Input
                id="scoreTarget"
                type="number"
                placeholder="e.g., 21 points to win"
                value={formData.scoreTarget}
                onChange={(e) => handleChange('scoreTarget', e.target.value)}
                className="bg-background"
              />
              <p className="text-xs text-muted-foreground">
                Points or score needed to win each game
              </p>
            </div>
            
            {/* Additional Rules */}
            <div className="space-y-2">
              <Label htmlFor="rules">Additional Rules (Optional)</Label>
              <Textarea
                id="rules"
                placeholder="Any specific rules or requirements..."
                value={formData.rules}
                onChange={(e) => handleChange('rules', e.target.value)}
                rows={3}
                className="bg-background resize-none"
              />
            </div>
            
            {/* Tie-Break Rule */}
            <div className="space-y-2">
              <Label htmlFor="tieBreakRule">Tie-Break / Dispute Resolution (Optional)</Label>
              <Textarea
                id="tieBreakRule"
                placeholder="How ties or disputes will be resolved..."
                value={formData.tieBreakRule}
                onChange={(e) => handleChange('tieBreakRule', e.target.value)}
                rows={2}
                className="bg-background resize-none"
              />
            </div>
          </div>
        );
        
      case 'visibility':
        return (
          <div className="space-y-6">
            {/* Visibility */}
            <div className="space-y-2">
              <Label>Visibility</Label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleChange('visibility', option.value)}
                    className={cn(
                      "w-full p-3 rounded-lg border text-left transition-all",
                      formData.visibility === option.value
                        ? cn("border-2", primaryBorderClass, primaryBgClass)
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-muted-foreground">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Skill Level */}
            <div className="space-y-2">
              <Label>Skill Level</Label>
              <div className="grid grid-cols-2 gap-2">
                {SKILL_LEVELS.map(level => (
                  <button
                    key={level.value}
                    type="button"
                    onClick={() => handleChange('skillLevel', level.value)}
                    className={cn(
                      "p-3 rounded-lg border text-left transition-all",
                      formData.skillLevel === level.value
                        ? cn("border-2", primaryBorderClass, primaryBgClass)
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="font-medium">{level.label}</div>
                    <div className="text-xs text-muted-foreground">{level.description}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
        
      case 'review':
        return (
          <div className="space-y-6">
            {/* Match Summary */}
            <Card className="border-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className={cn("h-5 w-5", primaryTextClass)} />
                  {formData.title}
                </CardTitle>
                <CardDescription>
                  {cityName}, {stateName}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Match Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Sport</p>
                    <p className="font-medium capitalize">{sport.toLowerCase()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Format</p>
                    <p className="font-medium">{formData.matchType}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Players</p>
                    <p className="font-medium">{formData.playerSlots}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Match Type</p>
                    <p className="font-medium">{MATCH_FORMATS.find(f => f.value === formData.matchFormat)?.label}</p>
                  </div>
                </div>
                
                <Separator />
                
                {/* Venue & Timing */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">{formData.selectedVenue?.name}</p>
                      <p className="text-sm text-muted-foreground">{formData.selectedVenue?.address}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm">
                      {new Date(formData.matchDate).toLocaleDateString('en-IN', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  
                  {formData.startTime && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">
                        {formatTime(formData.startTime)} - {formatTime(formData.startTime + formData.estimatedDuration)}
                        <span className="text-muted-foreground ml-2">
                          ({Math.floor(formData.estimatedDuration / 60)}h {formData.estimatedDuration % 60}m)
                        </span>
                      </p>
                    </div>
                  )}
                </div>
                
                <Separator />
                
                {/* Prize Details */}
                <div className={cn("p-3 rounded-lg", primaryBgClass)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Entry Fee</span>
                    <span className="font-medium">₹{(formData.entryFee / 100).toLocaleString()} / player</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Prize Pool</span>
                    <span className={cn("font-bold", primaryTextClass)}>
                      ₹{(financials.prizePool / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      1st Prize
                    </span>
                    <span className="font-medium text-yellow-600">
                      ₹{(financials.firstPrize / 100).toLocaleString()}
                    </span>
                  </div>
                  {financials.secondPrize > 0 && (
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-gray-400" />
                        2nd Prize
                      </span>
                      <span className="font-medium text-gray-600">
                        ₹{(financials.secondPrize / 100).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {/* Additional Info */}
                {(formData.visibility !== 'PUBLIC' || formData.skillLevel !== 'OPEN') && (
                  <>
                    <Separator />
                    <div className="flex flex-wrap gap-2">
                      {formData.visibility !== 'PUBLIC' && (
                        <Badge variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          {VISIBILITY_OPTIONS.find(v => v.value === formData.visibility)?.label}
                        </Badge>
                      )}
                      {formData.skillLevel !== 'OPEN' && (
                        <Badge variant="outline">
                          {SKILL_LEVELS.find(s => s.value === formData.skillLevel)?.label}
                        </Badge>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
            
            {/* Confirmation */}
            <div className="p-4 bg-muted rounded-lg text-sm">
              <p className="font-medium mb-2">By creating this match:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>You'll be automatically registered as the first player</li>
                <li>The venue slot will be reserved</li>
                <li>Other players can join until the registration deadline</li>
                <li>Match will be confirmed when minimum players join</li>
              </ul>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Target className={cn("h-6 w-6", primaryTextClass)} />
            Create Challenge Match
          </DialogTitle>
          <DialogDescription>
            Set up a new challenge match in {cityName}. Fill in all details to create a competitive match.
          </DialogDescription>
        </DialogHeader>
        
        {/* Progress Steps */}
        <div className="px-2 py-3 border-y bg-muted/30">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === currentStep;
              const isCompleted = index < currentStep;
              
              return (
                <div
                  key={step.id}
                  className="flex items-center"
                >
                  <div
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                      isActive && cn("border-primary", primaryTextClass, primaryBgClass),
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      !isActive && !isCompleted && "border-muted text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Icon className="h-4 w-4" />
                    )}
                  </div>
                  <span className={cn(
                    "hidden sm:block ml-2 text-xs font-medium",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.title}
                  </span>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "hidden sm:block w-8 h-0.5 mx-2",
                      index < currentStep ? "bg-primary" : "bg-muted"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-1">
          {renderStepContent()}
        </div>
        
        {/* Footer Navigation */}
        <DialogFooter className="border-t pt-4 mt-4">
          <div className="flex items-center justify-between w-full">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Step {currentStep + 1} of {STEPS.length}
              </span>
            </div>
            
            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={nextStep}
                className={cn("text-white", primaryBtnClass)}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={cn("text-white", primaryBtnClass)}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Create Challenge Match
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Import Target icon
import { Target } from 'lucide-react';
