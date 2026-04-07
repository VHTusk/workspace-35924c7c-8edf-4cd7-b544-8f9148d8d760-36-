"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ConsentCheckboxProps {
  id: string;
  label: string;
  linkText: string;
  linkHref: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  primaryTextClass?: string;
}

export function ConsentCheckbox({
  id,
  label,
  linkText,
  linkHref,
  checked,
  onChange,
  required = true,
  primaryTextClass = "text-primary",
}: ConsentCheckboxProps) {
  // Split label to insert the link
  const parts = label.split(linkText);
  
  return (
    <div className="flex items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(checked) => onChange(checked as boolean)}
        required={required}
        className="mt-0.5"
      />
      <Label
        htmlFor={id}
        className="text-xs text-muted-foreground leading-snug cursor-pointer"
      >
        {parts[0]}
        <Link
          href={linkHref}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primaryTextClass} hover:underline`}
          onClick={(e) => e.stopPropagation()}
        >
          {linkText}
        </Link>
        {parts[1]}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
    </div>
  );
}

// Consent configuration types for easy reuse
export interface ConsentConfig {
  id: string;
  label: string;
  linkText: string;
  linkHref: string;
  required?: boolean;
}

// Predefined consent configurations
export const REGISTRATION_CONSENTS: ConsentConfig[] = [
  {
    id: "terms-consent",
    label: "I have read and agree to the Terms and Conditions",
    linkText: "Terms and Conditions",
    linkHref: "/legal/terms",
    required: true,
  },
  {
    id: "privacy-consent",
    label: "I consent to the collection and processing of my personal data as described in the Privacy Policy",
    linkText: "Privacy Policy",
    linkHref: "/legal/privacy",
    required: true,
  },
];

export const TOURNAMENT_CONSENTS: ConsentConfig[] = [
  {
    id: "tournament-agreement-consent",
    label: "I agree to the Tournament Participation Agreement",
    linkText: "Tournament Participation Agreement",
    linkHref: "/legal/tournament-agreement",
    required: true,
  },
  {
    id: "liability-waiver-consent",
    label: "I acknowledge and accept the risks associated with sports participation",
    linkText: "risks associated with sports participation",
    linkHref: "/legal/liability-waiver",
    required: true,
  },
];

// Consent state type for tracking multiple consents
export type ConsentState = Record<string, boolean>;

// Helper to create initial consent state
export function createInitialConsentState(consents: ConsentConfig[]): ConsentState {
  return consents.reduce((acc, consent) => {
    acc[consent.id] = false;
    return acc;
  }, {} as ConsentState);
}

// Helper to check if all required consents are given
export function areAllRequiredConsentsGiven(
  consentState: ConsentState,
  consents: ConsentConfig[]
): boolean {
  return consents
    .filter((c) => c.required !== false)
    .every((c) => consentState[c.id] === true);
}

// Helper to get consent timestamps for storage
export function getConsentTimestamps(consentIds: string[]): Record<string, Date> {
  const now = new Date();
  return consentIds.reduce((acc, id) => {
    acc[id] = now;
    return acc;
  }, {} as Record<string, Date>);
}

export default ConsentCheckbox;
