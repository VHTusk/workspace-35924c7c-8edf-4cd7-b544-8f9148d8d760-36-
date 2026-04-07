'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, XCircle, HelpCircle, Shield } from 'lucide-react';

/**
 * Verification Status Types (from schema)
 * - NONE: No verification requested
 * - PENDING: ID uploaded, pending verification
 * - VERIFIED: Verified by org admin
 * - REJECTED: Rejected by org admin
 */
export type VerificationStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

interface VerificationBadgeProps {
  status: VerificationStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  VERIFIED: {
    label: 'Verified',
    icon: CheckCircle2,
    className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100',
    iconClassName: 'text-green-600',
    description: 'Identity verified by organization',
  },
  PENDING: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100',
    iconClassName: 'text-amber-600',
    description: 'Verification in progress',
  },
  REJECTED: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100',
    iconClassName: 'text-red-600',
    description: 'Verification was rejected',
  },
  NONE: {
    label: 'Unverified',
    icon: HelpCircle,
    className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100',
    iconClassName: 'text-gray-500',
    description: 'Not verified yet',
  },
};

const sizeConfig = {
  sm: {
    badge: 'text-xs px-2 py-0.5',
    icon: 'h-3 w-3',
  },
  md: {
    badge: 'text-sm px-2.5 py-1',
    icon: 'h-4 w-4',
  },
  lg: {
    badge: 'text-base px-3 py-1.5',
    icon: 'h-5 w-5',
  },
};

/**
 * Verification Badge Component
 * 
 * Displays the player's verification status with appropriate icon and color.
 * Used on player profiles, roster lists, and tournament registration pages.
 * 
 * @example
 * // Basic usage
 * <VerificationBadge status="VERIFIED" />
 * 
 * // With label hidden
 * <VerificationBadge status="PENDING" showLabel={false} />
 * 
 * // Large size for profile pages
 * <VerificationBadge status="VERIFIED" size="lg" />
 */
export function VerificationBadge({
  status,
  size = 'md',
  showLabel = true,
  className = '',
}: VerificationBadgeProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.className} ${sizes.badge} font-medium ${className}`}
      title={config.description}
    >
      <Icon className={`${sizes.icon} ${config.iconClassName} ${showLabel ? 'mr-1.5' : ''}`} />
      {showLabel && config.label}
    </Badge>
  );
}

/**
 * Compact Verification Indicator
 * Just shows the icon without label - good for tables and lists
 */
export function VerificationIndicator({
  status,
  size = 'sm',
  className = '',
}: Omit<VerificationBadgeProps, 'showLabel'>) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      title={`${config.label}: ${config.description}`}
    >
      <Icon className={`${sizes.icon} ${config.iconClassName}`} />
    </span>
  );
}

/**
 * Verification Status Card
 * Shows detailed verification info with description
 */
export function VerificationStatusCard({
  status,
  verifiedAt,
  verifiedByName,
  rejectionReason,
  className = '',
}: {
  status: VerificationStatus;
  verifiedAt?: Date | string | null;
  verifiedByName?: string | null;
  rejectionReason?: string | null;
  className?: string;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className={`rounded-lg border p-4 ${config.className.replace('hover:bg-green-100', '').replace('hover:bg-amber-100', '').replace('hover:bg-red-100', '').replace('hover:bg-gray-100', '')} ${className}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-full p-2 ${config.className.split(' ')[0]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{config.label}</span>
            {status === 'VERIFIED' && (
              <Shield className="h-4 w-4 text-green-600" />
            )}
          </div>
          <p className="text-sm opacity-80 mt-1">{config.description}</p>
          
          {status === 'VERIFIED' && verifiedAt && (
            <p className="text-xs mt-2 opacity-70">
              Verified on {new Date(verifiedAt).toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {verifiedByName && ` by ${verifiedByName}`}
            </p>
          )}
          
          {status === 'REJECTED' && rejectionReason && (
            <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
              <span className="font-medium">Reason:</span> {rejectionReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Organization Verification Badge
 * For org-level verification (shows org is verified)
 */
export function OrgVerifiedBadge({
  verified,
  size = 'md',
  className = '',
}: {
  verified: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sizes = sizeConfig[size];

  if (!verified) {
    return null;
  }

  return (
    <Badge
      variant="outline"
      className={`bg-blue-50 text-blue-700 border-blue-200 ${sizes.badge} ${className}`}
      title="This organization is verified"
    >
      <Shield className={`${sizes.icon} mr-1.5 text-blue-600`} />
      Verified Org
    </Badge>
  );
}

export default VerificationBadge;
