'use client';

/**
 * Venue Escalation Panel Component (v3.52.0)
 * 
 * Emergency escalation interface for State Admins to:
 * - Trigger venue-day escalation when director is unresponsive
 * - Assign replacement directors
 * - View escalation history
 * 
 * Only accessible to: STATE_ADMIN, SPORT_ADMIN, SUPER_ADMIN
 */

import { useState } from 'react';
import { 
  AlertTriangle, 
  Phone, 
  UserPlus, 
  Clock, 
  CheckCircle, 
  XCircle,
  ChevronDown,
  ChevronUp,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';

interface Tournament {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  directorName?: string | null;
  directorPhone?: string | null;
  directorEmail?: string | null;
  venueEscalationActive: boolean;
  venueEscalationTriggeredAt?: Date | null;
  venueEscalationTriggeredById?: string | null;
  venueEscalationReason?: string | null;
}

interface EscalationHistoryItem {
  id: string;
  triggeredAt: Date;
  triggeredByName: string;
  reason: string;
  resolvedAt?: Date | null;
  resolutionType?: string;
}

interface VenueEscalationPanelProps {
  tournament: Tournament;
  userRole: string; // Current user's admin role
  onRefresh?: () => void;
}

export function VenueEscalationPanel({ 
  tournament, 
  userRole,
  onRefresh 
}: VenueEscalationPanelProps) {
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTriggerDialog, setShowTriggerDialog] = useState(false);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Form states
  const [escalationReason, setEscalationReason] = useState('');
  const [newDirectorName, setNewDirectorName] = useState('');
  const [newDirectorPhone, setNewDirectorPhone] = useState('');
  const [newDirectorEmail, setNewDirectorEmail] = useState('');
  
  // Check if user can trigger escalation
  const canTriggerEscalation = ['STATE_ADMIN', 'SPORT_ADMIN', 'SUPER_ADMIN'].includes(userRole);
  
  // Handle trigger escalation
  const handleTriggerEscalation = async () => {
    if (escalationReason.length < 10) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason with at least 10 characters.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournament.id}/venue-escalation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          reason: escalationReason,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to trigger escalation');
      }
      
      toast({
        title: 'Escalation Triggered',
        description: 'Emergency escalation has been initiated. Higher-level admins have been notified.',
      });
      
      setShowTriggerDialog(false);
      setEscalationReason('');
      onRefresh?.();
      
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to trigger escalation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle resolve escalation
  const handleResolveEscalation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournament.id}/venue-escalation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to resolve escalation');
      }
      
      toast({
        title: 'Escalation Resolved',
        description: 'The emergency escalation has been resolved.',
      });
      
      onRefresh?.();
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to resolve escalation',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle assign replacement director
  const handleAssignReplacement = async () => {
    if (!newDirectorName || !newDirectorPhone) {
      toast({
        title: 'Required Fields',
        description: 'Director name and phone are required.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournament.id}/venue-escalation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-replacement',
          directorName: newDirectorName,
          directorPhone: newDirectorPhone,
          directorEmail: newDirectorEmail || undefined,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to assign replacement');
      }
      
      toast({
        title: 'Director Assigned',
        description: 'New director has been assigned. Credentials have been generated.',
      });
      
      setShowAssignDialog(false);
      setNewDirectorName('');
      setNewDirectorPhone('');
      setNewDirectorEmail('');
      onRefresh?.();
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign replacement director',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card className={tournament.venueEscalationActive ? 'border-red-500 bg-red-50/50' : ''}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {tournament.venueEscalationActive ? (
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg">
                    {tournament.venueEscalationActive ? 'Emergency Escalation Active' : 'Venue Operations'}
                  </CardTitle>
                  <CardDescription>
                    {tournament.venueEscalationActive
                      ? `Triggered: ${new Date(tournament.venueEscalationTriggeredAt!).toLocaleString()}`
                      : 'Tournament director management and emergency controls'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {tournament.venueEscalationActive && (
                  <Badge variant="destructive" className="animate-pulse">
                    ESCALATION
                  </Badge>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="space-y-4">
            {/* Current Director Info */}
            <div className="p-4 rounded-lg bg-muted/50">
              <h4 className="font-medium mb-2">Current Director</h4>
              {tournament.directorName ? (
                <div className="space-y-1 text-sm">
                  <p><span className="font-medium">Name:</span> {tournament.directorName}</p>
                  {tournament.directorPhone && (
                    <p className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      <span>{tournament.directorPhone}</span>
                    </p>
                  )}
                  {tournament.directorEmail && (
                    <p><span className="font-medium">Email:</span> {tournament.directorEmail}</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No director assigned</p>
              )}
            </div>
            
            {/* Escalation Reason (if active) */}
            {tournament.venueEscalationActive && tournament.venueEscalationReason && (
              <div className="p-4 rounded-lg bg-red-100 border border-red-300">
                <h4 className="font-medium text-red-800 mb-1">Escalation Reason</h4>
                <p className="text-sm text-red-700">{tournament.venueEscalationReason}</p>
              </div>
            )}
            
            {/* Action Buttons */}
            {canTriggerEscalation && (
              <div className="flex flex-wrap gap-2">
                {!tournament.venueEscalationActive ? (
                  <>
                    {/* Trigger Escalation */}
                    <Dialog open={showTriggerDialog} onOpenChange={setShowTriggerDialog}>
                      <DialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Trigger Escalation
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Trigger Emergency Escalation</DialogTitle>
                          <DialogDescription>
                            This will notify higher-level admins and potentially assign a replacement director.
                            This action is logged and should only be used for genuine emergencies.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="reason">Reason for Escalation *</Label>
                            <Textarea
                              id="reason"
                              value={escalationReason}
                              onChange={(e) => setEscalationReason(e.target.value)}
                              placeholder="e.g., Director has been unreachable for 2 hours before tournament start..."
                              rows={3}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              Minimum 10 characters required
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowTriggerDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            variant="destructive" 
                            onClick={handleTriggerEscalation}
                            disabled={isLoading || escalationReason.length < 10}
                          >
                            {isLoading ? 'Processing...' : 'Trigger Escalation'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    {/* Assign Replacement */}
                    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign Replacement
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign Replacement Director</DialogTitle>
                          <DialogDescription>
                            Enter the new director's details. Credentials will be auto-generated.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name">Director Name *</Label>
                            <Input
                              id="name"
                              value={newDirectorName}
                              onChange={(e) => setNewDirectorName(e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone">Phone Number *</Label>
                            <Input
                              id="phone"
                              value={newDirectorPhone}
                              onChange={(e) => setNewDirectorPhone(e.target.value)}
                              placeholder="+91 9876543210"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email">Email (Optional)</Label>
                            <Input
                              id="email"
                              type="email"
                              value={newDirectorEmail}
                              onChange={(e) => setNewDirectorEmail(e.target.value)}
                              placeholder="director@email.com"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleAssignReplacement}
                            disabled={isLoading || !newDirectorName || !newDirectorPhone}
                          >
                            {isLoading ? 'Assigning...' : 'Assign Director'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                ) : (
                  <>
                    {/* Resolve Escalation */}
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={handleResolveEscalation}
                      disabled={isLoading}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolve Escalation
                    </Button>
                    
                    {/* Assign Replacement */}
                    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-1" />
                          Assign Replacement
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        {/* Same dialog content as above */}
                        <DialogHeader>
                          <DialogTitle>Assign Replacement Director</DialogTitle>
                          <DialogDescription>
                            Enter the new director's details. Credentials will be auto-generated.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="name2">Director Name *</Label>
                            <Input
                              id="name2"
                              value={newDirectorName}
                              onChange={(e) => setNewDirectorName(e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div>
                            <Label htmlFor="phone2">Phone Number *</Label>
                            <Input
                              id="phone2"
                              value={newDirectorPhone}
                              onChange={(e) => setNewDirectorPhone(e.target.value)}
                              placeholder="+91 9876543210"
                            />
                          </div>
                          <div>
                            <Label htmlFor="email2">Email (Optional)</Label>
                            <Input
                              id="email2"
                              type="email"
                              value={newDirectorEmail}
                              onChange={(e) => setNewDirectorEmail(e.target.value)}
                              placeholder="director@email.com"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
                            Cancel
                          </Button>
                          <Button 
                            onClick={handleAssignReplacement}
                            disabled={isLoading || !newDirectorName || !newDirectorPhone}
                          >
                            {isLoading ? 'Assigning...' : 'Assign Director'}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </>
                )}
              </div>
            )}
            
            {/* Call Director Button */}
            {tournament.directorPhone && (
              <Button 
                variant="outline" 
                size="sm"
                asChild
              >
                <a href={`tel:${tournament.directorPhone}`}>
                  <Phone className="h-4 w-4 mr-1" />
                  Call Director
                </a>
              </Button>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

export default VenueEscalationPanel;
