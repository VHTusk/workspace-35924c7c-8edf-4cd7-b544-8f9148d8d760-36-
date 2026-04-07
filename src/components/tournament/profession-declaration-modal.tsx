'use client';

/**
 * Profession Declaration Modal (v3.53.0)
 * 
 * Modal for inline profession declaration during tournament registration.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Briefcase, AlertCircle, Loader2, Check, Building2 } from 'lucide-react';
import { Profession } from '@prisma/client';
import { PROFESSION_LABELS, PROFESSION_GOVERNING_BODIES } from '@/lib/profession-manager';

interface ProfessionDeclarationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  allowedProfessions: { value: Profession; label: string; governingBody: string }[];
  currentProfession: { value: Profession; label: string } | null;
  onProfessionDeclared: (profession: Profession, membershipNumber?: string) => void;
}

export function ProfessionDeclarationModal({
  open,
  onOpenChange,
  tournamentName,
  allowedProfessions,
  currentProfession,
  onProfessionDeclared,
}: ProfessionDeclarationModalProps) {
  const [selectedProfession, setSelectedProfession] = useState<Profession | ''>(
    currentProfession?.value || ''
  );
  const [membershipNumber, setMembershipNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDeclare = async () => {
    if (!selectedProfession) {
      setError('Please select a profession');
      return;
    }

    // Verify profession is in allowed list
    if (!allowedProfessions.some(p => p.value === selectedProfession)) {
      setError('Selected profession is not eligible for this tournament');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // This will be handled by the parent component
      onProfessionDeclared(selectedProfession as Profession, membershipNumber || undefined);
      onOpenChange(false);
    } catch (err) {
      setError('Failed to declare profession. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Get selected profession info
  const getSelectedProfessionInfo = () => {
    if (!selectedProfession) return null;
    return allowedProfessions.find(p => p.value === selectedProfession);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-amber-500" />
            Profession Required for Registration
          </DialogTitle>
          <DialogDescription>
            This tournament is exclusive to specific professions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tournament Info */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="font-medium">{tournamentName}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Please declare your profession to continue with registration.
            </p>
          </div>

          {/* Allowed Professions */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Eligible Professions:</Label>
            <div className="flex flex-wrap gap-1">
              {allowedProfessions.map((p) => (
                <Badge 
                  key={p.value} 
                  variant={selectedProfession === p.value ? 'default' : 'secondary'}
                  className={selectedProfession === p.value ? '' : 'bg-muted'}
                >
                  {getProfessionEmoji(p.value)} {p.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Current Profession (if exists) */}
          {currentProfession && (
            <Alert>
              <Check className="w-4 h-4" />
              <AlertDescription>
                Your current declared profession: <strong>{currentProfession.label}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Profession Selector */}
          <div className="space-y-2">
            <Label htmlFor="profession-declare">
              {currentProfession ? 'Change Your Profession' : 'Declare Your Profession'}
            </Label>
            <Select
              value={selectedProfession}
              onValueChange={(value) => setSelectedProfession(value as Profession)}
            >
              <SelectTrigger id="profession-declare">
                <SelectValue placeholder="Select your profession" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {allowedProfessions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    <span className="flex items-center gap-2">
                      <span>{getProfessionEmoji(p.value)}</span>
                      {p.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Governing Body Display */}
          {selectedProfession && getSelectedProfessionInfo() && (
            <Alert>
              <Building2 className="w-4 h-4" />
              <AlertDescription>
                <strong>Governing Body:</strong> {getSelectedProfessionInfo()?.governingBody}
              </AlertDescription>
            </Alert>
          )}

          {/* Membership Number (Optional) */}
          {selectedProfession && selectedProfession !== 'OTHER' && (
            <div className="space-y-2">
              <Label htmlFor="membership-number-declare">
                Membership Number (Optional)
              </Label>
              <Input
                id="membership-number-declare"
                placeholder="e.g., MCI-12345, BCI-2024-001"
                value={membershipNumber}
                onChange={(e) => setMembershipNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter your registration number from the governing body
              </p>
            </div>
          )}

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Notice */}
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-sm">
              <strong>Note:</strong> You may self-declare now. To claim prizes, rankings, 
              or official titles, profession verification will be required later through 
              document submission.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDeclare}
            disabled={!selectedProfession || saving}
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Continue with Registration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to get profession emoji
function getProfessionEmoji(profession: Profession): string {
  const emojis: Record<Profession, string> = {
    DOCTOR: '🏥',
    DENTIST: '🦷',
    NURSE: '👩‍⚕️',
    PHARMACIST: '💊',
    PHYSIOTHERAPIST: '🏃',
    RADIOLOGIST: '🔬',
    AYURVEDIC_DOCTOR: '🌿',
    HOMEOPATHIC_DOCTOR: '🍃',
    LAWYER: '⚖️',
    COMPANY_SECRETARY: '📋',
    NOTARY: '📜',
    CHARTERED_ACCOUNTANT: '📊',
    COST_ACCOUNTANT: '📈',
    ACTUARY: '🧮',
    ARCHITECT: '🏗️',
    ENGINEER: '🔧',
    TOWN_PLANNER: '🏘️',
    TEACHER: '📚',
    PROFESSOR: '🎓',
    JOURNALIST: '📰',
    REAL_ESTATE_AGENT: '🏠',
    INSURANCE_AGENT: '🛡️',
    STOCK_BROKER: '📈',
    MUTUAL_FUND_DISTRIBUTOR: '💹',
    PILOT: '✈️',
    AIRCRAFT_ENGINEER: '🔩',
    AIR_TRAFFIC_CONTROLLER: '🗼',
    STRUCTURAL_ENGINEER: '🏗️',
    CONTRACTOR: '🔨',
    AGRICULTURAL_SCIENTIST: '🌾',
    VETERINARIAN: '🐾',
    COACH: '🏅',
    REFEREE: '哨',
    OTHER: '📋',
  };
  return emojis[profession] || '📋';
}
