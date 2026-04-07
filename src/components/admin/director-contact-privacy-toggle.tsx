'use client';

/**
 * Director Contact Privacy Toggle Component (v3.52.0)
 * 
 * Allows admins to control visibility of director contact information.
 * Privacy-first: Contact is hidden by default, only shown to registered players if enabled.
 * 
 * Visibility Matrix:
 * - Public (unregistered): Never sees contact
 * - Registered Players: Only if showDirectorContact = true
 * - Tournament Director: Always sees their own info
 * - Admins: Always see contact info
 */

import { useState } from 'react';
import { Eye, EyeOff, Shield, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface DirectorContactPrivacyToggleProps {
  tournamentId: string;
  showDirectorContact: boolean;
  directorName?: string | null;
  directorPhone?: string | null;
  canEdit: boolean; // Whether current user can edit
  onUpdate?: (value: boolean) => void;
}

export function DirectorContactPrivacyToggle({
  tournamentId,
  showDirectorContact,
  directorName,
  directorPhone,
  canEdit,
  onUpdate,
}: DirectorContactPrivacyToggleProps) {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(showDirectorContact);
  const [isLoading, setIsLoading] = useState(false);
  
  const hasDirector = directorName && directorPhone;
  
  const handleToggle = async (checked: boolean) => {
    if (!canEdit) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/tournaments/${tournamentId}/director`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showDirectorContact: checked }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update privacy setting');
      }
      
      setIsEnabled(checked);
      onUpdate?.(checked);
      
      toast({
        title: 'Privacy Setting Updated',
        description: checked 
          ? 'Director contact is now visible to registered players'
          : 'Director contact is now hidden from players',
      });
      
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update privacy setting',
        variant: 'destructive',
      });
      // Revert on error
      setIsEnabled(!checked);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Director Contact Privacy</CardTitle>
          </div>
          {isEnabled ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              <Eye className="h-3 w-3 mr-1" />
              Visible to Players
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-gray-100 text-gray-600">
              <EyeOff className="h-3 w-3 mr-1" />
              Hidden from Players
            </Badge>
          )}
        </div>
        <CardDescription>
          Control whether registered players can see director contact information
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {!hasDirector ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Info className="h-4 w-4" />
            <span>No director assigned yet. Assign a director to configure contact visibility.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Toggle Switch */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="privacy-toggle" className="cursor-pointer">
                  Show contact to registered players
                </Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        When enabled, players who have registered for this tournament can see 
                        the director's name and phone number. This is useful for venue-day coordination.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Switch
                id="privacy-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={!canEdit || isLoading}
              />
            </div>
            
            {/* Visibility Matrix */}
            <div className="text-sm space-y-2 mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="font-medium text-muted-foreground mb-2">Visibility Rules:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Public (unregistered):</span>
                  <XMark />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Registered Players:</span>
                  {isEnabled ? <CheckMark /> : <XMark />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Director:</span>
                  <CheckMark />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Admins:</span>
                  <CheckMark />
                </div>
              </div>
            </div>
            
            {/* Director Info Preview (always visible to admins) */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">Director Info (visible to you as admin):</p>
              <div className="text-sm">
                <p><span className="font-medium">Name:</span> {directorName}</p>
                {directorPhone && (
                  <p><span className="font-medium">Phone:</span> {directorPhone}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper components
function CheckMark() {
  return (
    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
      ✓ Visible
    </Badge>
  );
}

function XMark() {
  return (
    <Badge variant="outline" className="bg-gray-50 text-gray-500 border-gray-200 text-xs">
      ✗ Hidden
    </Badge>
  );
}

export default DirectorContactPrivacyToggle;
