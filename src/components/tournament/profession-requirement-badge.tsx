'use client';

/**
 * Profession Requirement Badge (v3.53.0)
 * 
 * Badge component to display profession requirements for tournaments.
 */

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Briefcase, Lock } from 'lucide-react';
import { Profession } from '@prisma/client';
import { PROFESSION_LABELS } from '@/lib/profession-manager';

interface ProfessionRequirementBadgeProps {
  isProfessionExclusive: boolean;
  allowedProfessions: Profession[];
  compact?: boolean;
}

export function ProfessionRequirementBadge({
  isProfessionExclusive,
  allowedProfessions,
  compact = false,
}: ProfessionRequirementBadgeProps) {
  if (!isProfessionExclusive) {
    return null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="secondary" className="bg-amber-100 text-amber-800">
              <Lock className="w-3 h-3 mr-1" />
              Exclusive
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium">Profession-exclusive tournament</p>
            <p className="text-sm text-muted-foreground mt-1">
              {allowedProfessions.length > 0 
                ? allowedProfessions.map(p => PROFESSION_LABELS[p]).join(', ')
                : 'No professions specified'
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="secondary" className="bg-amber-100 text-amber-800">
        <Briefcase className="w-3 h-3 mr-1" />
        Profession Exclusive
      </Badge>
      {allowedProfessions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allowedProfessions.slice(0, 3).map((profession) => (
            <Badge 
              key={profession} 
              variant="outline"
              className="text-xs"
            >
              {getProfessionEmoji(profession)} {PROFESSION_LABELS[profession]}
            </Badge>
          ))}
          {allowedProfessions.length > 3 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-xs cursor-help">
                    +{allowedProfessions.length - 3} more
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-sm">
                    {allowedProfessions.slice(3).map(p => PROFESSION_LABELS[p]).join(', ')}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
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
