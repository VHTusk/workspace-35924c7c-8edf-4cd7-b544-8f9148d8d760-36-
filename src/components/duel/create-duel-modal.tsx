'use client';

/**
 * Create Duel Modal - Multi-step wizard for creating open knockout challenges
 * 
 * Steps:
 * 1. Select Format & Participants
 * 2. Choose Venue & Time Slot
 * 3. Set Entry Fee & Prize
 * 4. Add Match Rules
 * 5. Review & Submit for Approval
 * 
 * @version 3.73.0
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { 
  ChevronLeft, 
  ChevronRight, 
  Trophy, 
  MapPin, 
  Clock, 
  IndianRupee,
  AlertCircle,
  Check,
  Calendar,
  Users,
  Clock4,
  Shield,
  Phone
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
interface CreateDuelModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (duelId: string) => void;
  hostId: string;
  defaultSport?: 'CORNHOLE' | 'DARTS';
  defaultCity?: string;
}

interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  phone?: string;
  venueType: string;
  amenities?: string;
  googleMapsUrl?: string;
}

interface TimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  slotFee: number;
  isAvailable: boolean;
}

// Step configuration
const STEPS = [
  { id: 1, title: 'Format', description: 'Challenge type' },
  { id: 2, title: 'Venue & Time', description: 'Where & when' },
  { id: 3, title: 'Entry Fee', description: 'Set stakes' },
  { id: 4, title: 'Rules', description: 'Match rules' },
  { id: 5, title: 'Review', description: 'Submit for approval' },
];

// Format options
const FORMAT_OPTIONS = [
  { 
    value: 'INDIVIDUAL', 
    label: 'Open Challenge Singles', 
    description: 'Individual knockout tournament',
    icon: '🎯',
    minParticipants: 4,
    maxParticipants: 16,
    defaultParticipants: 8
  },
  { 
    value: 'TEAM', 
    label: 'Open Team Challenge', 
    description: 'Team knockout tournament (2v2)',
    icon: '👥',
    minParticipants: 4,
    maxParticipants: 8,
    defaultParticipants: 4
  },
];

// Time slot duration based on participants
const getDurationForParticipants = (participants: number): number => {
  if (participants <= 4) return 120;      // 2 hours
  if (participants <= 8) return 180;      // 3 hours
  if (participants <= 16) return 240;     // 4 hours
  return 300;                              // 5 hours
};

export function CreateDuelModal({
  open,
  onClose,
  onSuccess,
  hostId,
  defaultSport = 'CORNHOLE',
  defaultCity,
}: CreateDuelModalProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetchingVenues, setIsFetchingVenues] = useState(false);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    // Step 1
    format: 'INDIVIDUAL',
    maxParticipants: 8,
    
    // Step 2
    venueId: '',
    selectedSlotId: '',
    customVenueName: '',
    customVenueAddress: '',
    customVenuePhone: '',
    customVenueMapsUrl: '',
    scheduledDate: '',
    scheduledTime: '',
    
    // Step 3
    entryFee: 2000, // ₹20 in paise
    
    // Step 4
    matchRules: '',
    customTerms: '',
    
    // Contact for approval
    contactPhone: '',
    contactEmail: '',
  });
  
  // City from user profile (required for geo-lock)
  const city = defaultCity || 'Mumbai';
  
  // Get selected format details
  const selectedFormat = FORMAT_OPTIONS.find(f => f.value === formData.format);
  
  // Calculate duration based on participants
  const estimatedDuration = getDurationForParticipants(formData.maxParticipants);
  
  // Calculate prize pool (90% goes to prize pool)
  const calculatedPrizePool = Math.round(
    formData.entryFee * formData.maxParticipants * 0.9
  );
  
  // Fetch venues when modal opens
  useEffect(() => {
    if (open && city) {
      fetchVenues();
    }
  }, [open, city]);
  
  // Fetch available slots when venue or participant count changes
  useEffect(() => {
    if (formData.venueId && formData.maxParticipants) {
      fetchAvailableSlots();
    }
  }, [formData.venueId, formData.maxParticipants]);
  
  const fetchVenues = async () => {
    setIsFetchingVenues(true);
    try {
      const response = await fetch(
        `/api/duels/venues?city=${encodeURIComponent(city)}&sport=${defaultSport}`
      );
      const data = await response.json();
      if (data.success) {
        setVenues(data.data.venues || []);
      }
    } catch (error) {
      console.error('Failed to fetch venues:', error);
    } finally {
      setIsFetchingVenues(false);
    }
  };
  
  const fetchAvailableSlots = async () => {
    setIsFetchingSlots(true);
    try {
      const response = await fetch(
        `/api/duels/venues/${formData.venueId}/slots?duration=${estimatedDuration}`
      );
      const data = await response.json();
      if (data.success) {
        setAvailableSlots(data.data.slots || []);
      }
    } catch (error) {
      console.error('Failed to fetch slots:', error);
    } finally {
      setIsFetchingSlots(false);
    }
  };
  
  // Get selected venue details
  const selectedVenue = venues.find(v => v.id === formData.venueId);
  
  // Get selected slot details
  const selectedSlot = availableSlots.find(s => s.id === formData.selectedSlotId);
  
  const updateFormData = (updates: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };
  
  const handleFormatChange = (format: string) => {
    const formatOption = FORMAT_OPTIONS.find(f => f.value === format);
    updateFormData({ 
      format,
      maxParticipants: formatOption?.defaultParticipants || 8,
      venueId: '',
      selectedSlotId: '' // Reset slot when format changes
    });
  };
  
  const handleNext = () => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }
    
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };
  
  const validateStep = (step: number): { valid: boolean; error?: string } => {
    switch (step) {
      case 1:
        if (!formData.format) return { valid: false, error: 'Select a format' };
        if (formData.maxParticipants < 4) return { valid: false, error: 'Minimum 4 participants required' };
        return { valid: true };
        
      case 2:
        if (!formData.venueId && !formData.customVenueName) {
          return { valid: false, error: 'Select a venue or enter custom venue details' };
        }
        if (formData.venueId && !formData.selectedSlotId) {
          return { valid: false, error: 'Select an available time slot' };
        }
        if (!formData.venueId && (!formData.scheduledDate || !formData.scheduledTime)) {
          return { valid: false, error: 'Enter date and time for the duel' };
        }
        return { valid: true };
        
      case 3:
        if (formData.entryFee < 500) return { valid: false, error: 'Minimum entry fee is ₹5' };
        if (formData.entryFee > 50000) return { valid: false, error: 'Maximum entry fee is ₹500' };
        return { valid: true };
        
      case 4:
        return { valid: true };
        
      case 5:
        if (!formData.contactPhone) return { valid: false, error: 'Contact phone is required for approval' };
        return { valid: true };
        
      default:
        return { valid: true };
    }
  };
  
  const handleSubmit = async () => {
    const validation = validateStep(currentStep);
    if (!validation.valid) {
      toast({
        title: 'Validation Error',
        description: validation.error,
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Calculate scheduled start
      let scheduledStart: string;
      if (formData.selectedSlotId && selectedSlot) {
        scheduledStart = `${new Date(selectedSlot.date).toISOString().split('T')[0]}T${selectedSlot.startTime}:00`;
      } else {
        scheduledStart = `${formData.scheduledDate}T${formData.scheduledTime}:00`;
      }
      
      // Prepare payload
      const payload = {
        sport: defaultSport,
        city,
        hostId,
        format: formData.format,
        maxParticipants: formData.maxParticipants,
        
        // Venue
        venueId: formData.venueId || null,
        venueSlotId: formData.selectedSlotId || null,
        venueName: formData.venueId ? null : formData.customVenueName,
        venueAddress: formData.venueId ? null : formData.customVenueAddress,
        venuePhone: formData.venueId ? null : formData.customVenuePhone,
        venueGoogleMapsUrl: formData.venueId ? null : formData.customVenueMapsUrl,
        scheduledStart,
        durationMinutes: estimatedDuration,
        
        // Financials
        entryFee: formData.entryFee,
        
        // Rules
        matchRules: formData.matchRules ? { description: formData.matchRules } : null,
        customTerms: formData.customTerms || null,
        
        // Contact for approval
        contactPhone: formData.contactPhone,
        contactEmail: formData.contactEmail,
      };
      
      const response = await fetch('/api/duels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: 'Duel Submitted for Approval! ⚔️',
          description: 'Your duel is pending admin approval. You will be notified once approved.',
        });
        onSuccess?.(data.data.duel.id);
        handleClose();
      } else {
        toast({
          title: 'Failed to Submit Duel',
          description: data.error || 'Something went wrong',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Create duel error:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit duel. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      format: 'INDIVIDUAL',
      maxParticipants: 8,
      venueId: '',
      selectedSlotId: '',
      customVenueName: '',
      customVenueAddress: '',
      customVenuePhone: '',
      customVenueMapsUrl: '',
      scheduledDate: '',
      scheduledTime: '',
      entryFee: 2000,
      matchRules: '',
      customTerms: '',
      contactPhone: '',
      contactEmail: '',
    });
    setAvailableSlots([]);
    onClose();
  };
  
  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Challenge Format</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Select the type of knockout challenge you want to host
              </p>
              <div className="grid grid-cols-1 gap-3">
                {FORMAT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleFormatChange(option.value)}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      formData.format === option.value
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{option.icon}</span>
                      <div>
                        <div className="font-semibold">{option.label}</div>
                        <div className="text-sm text-muted-foreground">{option.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Participant Count */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Maximum Participants</Label>
              <p className="text-sm text-muted-foreground">
                {selectedFormat?.minParticipants} - {selectedFormat?.maxParticipants} participants for knockout brackets
              </p>
              <Select
                value={formData.maxParticipants.toString()}
                onValueChange={(value) => updateFormData({ maxParticipants: parseInt(value) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: (selectedFormat?.maxParticipants || 16) - (selectedFormat?.minParticipants || 4) + 1 },
                    (_, i) => (selectedFormat?.minParticipants || 4) + i
                  ).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {formData.format === 'INDIVIDUAL' ? 'players' : 'teams'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Duration Info */}
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <div className="flex items-center gap-2 text-blue-600">
                <Clock4 className="h-5 w-5" />
                <span className="font-medium">Estimated Duration: {estimatedDuration} minutes</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Based on {formData.maxParticipants} participants in knockout format
              </p>
            </div>
            
            {/* Geo-lock Notice */}
            <div className="flex items-start gap-2 p-3 bg-amber-500/10 rounded-lg">
              <MapPin className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm">
                <span className="font-medium">Geo-locked to {city}</span>
                <p className="text-muted-foreground">
                  Only players in {city} can see and join your challenge
                </p>
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-6">
            {/* Venue Selection */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select Venue</Label>
              
              {isFetchingVenues ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading venues...
                </div>
              ) : venues.length === 0 ? (
                <div className="text-center py-6 p-4 border-2 border-dashed rounded-lg">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-muted-foreground">No venues available in {city}</p>
                  <p className="text-sm text-muted-foreground mt-1">Enter custom venue details below</p>
                </div>
              ) : (
                <div className="grid gap-3 max-h-48 overflow-y-auto">
                  {venues.map((venue) => (
                    <button
                      key={venue.id}
                      type="button"
                      onClick={() => updateFormData({ venueId: venue.id, selectedSlotId: '' })}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        formData.venueId === venue.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium">{venue.name}</div>
                      <div className="text-sm text-muted-foreground">{venue.address}</div>
                      {venue.phone && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {venue.phone}
                        </div>
                      )}
                      {venue.venueType && (
                        <Badge variant="secondary" className="mt-2">
                          {venue.venueType}
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Time Slot Selection */}
            {formData.venueId && (
              <div className="space-y-3">
                <Label className="font-semibold">Select Time Slot</Label>
                <p className="text-sm text-muted-foreground">
                  Slots available for {estimatedDuration} min duration
                </p>
                
                {isFetchingSlots ? (
                  <div className="text-center py-6 text-muted-foreground">
                    Checking available slots...
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="text-center py-4 p-4 border rounded-lg text-muted-foreground">
                    <Clock className="h-6 w-6 mx-auto mb-2" />
                    No slots available for the selected duration
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                    {availableSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => updateFormData({ selectedSlotId: slot.id })}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          formData.selectedSlotId === slot.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium text-sm">
                          {new Date(slot.date).toLocaleDateString('en-IN', { 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {slot.startTime} - {slot.endTime}
                        </div>
                        {slot.slotFee > 0 && (
                          <div className="text-xs text-green-600 mt-1">
                            Slot: ₹{slot.slotFee / 100}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Custom Venue (if no venue selected) */}
            {!formData.venueId && venues.length === 0 && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="font-medium">Custom Venue Details</div>
                
                <div className="space-y-2">
                  <Label>Venue Name *</Label>
                  <Input
                    placeholder="e.g., Central Sports Club"
                    value={formData.customVenueName}
                    onChange={(e) => updateFormData({ customVenueName: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Address *</Label>
                  <Input
                    placeholder="Full address"
                    value={formData.customVenueAddress}
                    onChange={(e) => updateFormData({ customVenueAddress: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => updateFormData({ scheduledDate: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Start Time *</Label>
                    <Input
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(e) => updateFormData({ scheduledTime: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Selected Slot Info */}
            {selectedSlot && (
              <div className="p-3 bg-green-500/10 rounded-lg">
                <div className="font-medium text-green-600">Slot Selected</div>
                <div className="text-sm mt-1">
                  {new Date(selectedSlot.date).toLocaleDateString('en-IN', { 
                    weekday: 'long',
                    day: 'numeric', 
                    month: 'long' 
                  })} • {selectedSlot.startTime} - {selectedSlot.endTime}
                </div>
                <div className="text-sm text-muted-foreground">
                  Duration: {selectedSlot.durationMinutes} minutes
                </div>
              </div>
            )}
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-6">
            {/* Entry Fee */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Entry Fee (per participant)</Label>
              <div className="flex items-center gap-2">
                <IndianRupee className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="number"
                  min={5}
                  max={500}
                  step={5}
                  value={formData.entryFee / 100}
                  onChange={(e) => updateFormData({ 
                    entryFee: Math.max(500, Math.min(50000, parseInt(e.target.value) * 100 || 0))
                  })}
                  className="text-lg"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Entry fee range: ₹5 - ₹500
              </p>
            </div>
            
            {/* Prize Pool Preview */}
            <Card className="bg-green-500/10 border-green-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-muted-foreground">Prize Pool</div>
                    <div className="text-3xl font-bold text-green-600">
                      ₹{calculatedPrizePool / 100}
                    </div>
                  </div>
                  <Trophy className="h-12 w-12 text-green-500" />
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {formData.maxParticipants} {formData.format === 'INDIVIDUAL' ? 'players' : 'teams'} × ₹{formData.entryFee / 100} - 10% platform fee
                </div>
              </CardContent>
            </Card>
            
            {/* Financial Breakdown */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium mb-2">Financial Breakdown</div>
              <div className="space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Total Entry Fees:</span>
                  <span>₹{(formData.entryFee * formData.maxParticipants) / 100}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee (10%):</span>
                  <span>₹{(formData.entryFee * formData.maxParticipants * 0.1) / 100}</span>
                </div>
                <div className="flex justify-between font-medium text-foreground border-t pt-1 mt-1">
                  <span>Winner Takes:</span>
                  <span className="text-green-600">₹{calculatedPrizePool / 100}</span>
                </div>
              </div>
            </div>
            
            {/* Knockout Format Info */}
            <div className="p-3 bg-blue-500/10 rounded-lg text-sm">
              <div className="font-medium text-blue-600 mb-1">Knockout Format</div>
              <p className="text-muted-foreground">
                Single elimination bracket. Winner takes all prize pool.
              </p>
            </div>
          </div>
        );
        
      case 4:
        return (
          <div className="space-y-6">
            {/* Match Rules */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Match Rules</Label>
              <Textarea
                placeholder="e.g., Best of 3 games, 21 points to win, cancel scoring..."
                value={formData.matchRules}
                onChange={(e) => updateFormData({ matchRules: e.target.value })}
                rows={3}
              />
            </div>
            
            {/* Additional Terms */}
            <div className="space-y-2">
              <Label>Additional Terms (Optional)</Label>
              <Textarea
                placeholder="Any specific rules or terms participants should know..."
                value={formData.customTerms}
                onChange={(e) => updateFormData({ customTerms: e.target.value })}
                rows={2}
              />
            </div>
            
            {/* Standard Rules */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium mb-2">Standard Rules Apply</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Players must check-in 15 mins before match</li>
                <li>• No-show results in automatic forfeit</li>
                <li>• Disputes resolved by venue admin</li>
                <li>• Fair play policy applies</li>
              </ul>
            </div>
          </div>
        );
        
      case 5:
        return (
          <div className="space-y-6">
            {/* Approval Notice */}
            <div className="p-4 bg-amber-500/10 rounded-lg">
              <div className="flex items-start gap-3">
                <Shield className="h-6 w-6 text-amber-500 shrink-0" />
                <div>
                  <div className="font-medium text-amber-600">Admin Approval Required</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your duel will be submitted for approval. Once approved by admin, it will be visible to players in {city}.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Contact Info for Approval */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Contact Information</Label>
              <p className="text-sm text-muted-foreground">
                Required for admin to reach you for approval
              </p>
              
              <div className="space-y-2">
                <Label>Phone Number *</Label>
                <Input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.contactPhone}
                  onChange={(e) => updateFormData({ contactPhone: e.target.value })}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Email (Optional)</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={formData.contactEmail}
                  onChange={(e) => updateFormData({ contactEmail: e.target.value })}
                />
              </div>
            </div>
            
            <Separator />
            
            {/* Summary */}
            <div className="text-lg font-semibold">Summary</div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Format</span>
                <Badge>{selectedFormat?.label}</Badge>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Participants</span>
                <span className="font-medium">{formData.maxParticipants} {formData.format === 'INDIVIDUAL' ? 'players' : 'teams'}</span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">City</span>
                <span className="font-medium">{city}</span>
              </div>
              
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <MapPin className="h-4 w-4" />
                  Venue
                </div>
                <div className="font-medium">{selectedVenue?.name || formData.customVenueName}</div>
                {selectedVenue?.address || formData.customVenueAddress ? (
                  <div className="text-sm text-muted-foreground">
                    {selectedVenue?.address || formData.customVenueAddress}
                  </div>
                ) : null}
              </div>
              
              <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{estimatedDuration} minutes</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Entry Fee</div>
                  <div className="text-xl font-bold">₹{formData.entryFee / 100}</div>
                </div>
                <div className="p-3 bg-green-500/10 rounded-lg">
                  <div className="text-sm text-muted-foreground">Prize Pool</div>
                  <div className="text-xl font-bold text-green-600">₹{calculatedPrizePool / 100}</div>
                </div>
              </div>
            </div>
            
            {/* Important Notice */}
            <div className="p-3 bg-muted rounded-lg text-sm">
              <div className="font-medium mb-2">Important</div>
              <ul className="text-muted-foreground space-y-1">
                <li>• Approval typically takes 1-2 hours</li>
                <li>• You will be notified once approved</li>
                <li>• If rejected, you can modify and resubmit</li>
                <li>• Venue and logistics will be verified</li>
              </ul>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Create Open Challenge
          </DialogTitle>
        </DialogHeader>
        
        {/* Step Progress */}
        <div className="flex items-center justify-between py-4">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep >= step.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {currentStep > step.id ? <Check className="h-4 w-4" /> : step.id}
                </div>
                <span className="text-xs mt-1 text-muted-foreground hidden sm:block">
                  {step.title}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ${
                    currentStep > step.id ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        
        {/* Step Title */}
        <div className="mb-4">
          <h3 className="text-lg font-semibold">{STEPS[currentStep - 1].title}</h3>
          <p className="text-sm text-muted-foreground">
            {STEPS[currentStep - 1].description}
          </p>
        </div>
        
        {/* Step Content */}
        <div className="py-2">
          {renderStepContent()}
        </div>
        
        {/* Footer */}
        <DialogFooter className="flex gap-2 sm:gap-0">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          
          {currentStep < STEPS.length ? (
            <Button onClick={handleNext}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                'Submitting...'
              ) : (
                <>
                  <Shield className="h-4 w-4 mr-1" />
                  Submit for Approval
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateDuelModal;
