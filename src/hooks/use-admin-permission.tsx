/**
 * Admin Permission Hook (v4.15.0)
 * 
 * Frontend hook for checking admin permissions in UI components.
 * Uses the /api/admin/auth/check endpoint to get admin context and permissions.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { AdminRole } from '@prisma/client';

// Permission keys matching the backend
export type PermissionKey =
  | 'canCreateTournament'
  | 'canApproveTournament'
  | 'canPublishTournament'
  | 'canStartTournament'
  | 'canPauseTournament'
  | 'canCancelTournament'
  | 'canEditTournament'
  | 'canGenerateBracket'
  | 'canScoreMatches'
  | 'canRollbackMatch'
  | 'canOverrideResult'
  | 'canViewPlayers'
  | 'canEditPlayer'
  | 'canBanPlayer'
  | 'canAdjustElo'
  | 'canViewRevenue'
  | 'canProcessRefund'
  | 'canProcessPayout'
  | 'canViewDisputes'
  | 'canResolveDisputes'
  | 'canApproveOrgs'
  | 'canSuspendOrgs'
  | 'canAssignAdmins'
  | 'canAssignDirectors'
  | 'canViewAuditLogs'
  | 'canManageFeatureFlags'
  | 'canViewAnalytics'
  | 'canManageSportRules'
  | 'canAccessHealthDashboard'
  | 'canManageSectors'
  | 'canEditCompletedMatch'
  | 'canDeleteTournament';

export interface AdminScope {
  stateCode: string | null;
  districtName: string | null;
}

export interface AdminAssignment {
  role: AdminRole;
  sport: string | null;
  scope: AdminScope;
}

export interface AdminContext {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  role: string;
  adminRole: AdminRole;
  sport: string;
  scope: AdminScope;
  permissions: Record<string, boolean | number> | null;
  assignments: AdminAssignment[];
  isLegacyAdmin?: boolean;
}

interface AdminAuthState {
  authenticated: boolean;
  admin: AdminContext | null;
  loading: boolean;
  error: string | null;
}

// Global state for admin context
let adminContextCache: AdminAuthState | null = null;
let fetchPromise: Promise<AdminAuthState> | null = null;

/**
 * Hook to get the current admin context including permissions
 */
export function useAdminAuth() {
  const [state, setState] = useState<AdminAuthState>(
    adminContextCache || {
      authenticated: false,
      admin: null,
      loading: !adminContextCache,
      error: null,
    }
  );

  const fetchAdminContext = useCallback(async () => {
    // Return cached promise if already fetching
    if (fetchPromise) {
      return fetchPromise;
    }

    fetchPromise = fetch('/api/admin/auth/check')
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return {
            authenticated: false,
            admin: null,
            loading: false,
            error: data.error || 'Not authenticated',
          };
        }
        const data = await res.json();
        const result: AdminAuthState = {
          authenticated: data.authenticated,
          admin: data.admin,
          loading: false,
          error: null,
        };
        adminContextCache = result;
        return result;
      })
      .catch((error) => ({
        authenticated: false,
        admin: null,
        loading: false,
        error: error.message || 'Failed to fetch admin context',
      }))
      .finally(() => {
        fetchPromise = null;
      });

    return fetchPromise;
  }, []);

  useEffect(() => {
    if (!adminContextCache) {
      fetchAdminContext().then(setState);
    }
  }, [fetchAdminContext]);

  const refresh = useCallback(async () => {
    adminContextCache = null;
    setState({ authenticated: false, admin: null, loading: true, error: null });
    const result = await fetchAdminContext();
    setState(result);
  }, [fetchAdminContext]);

  return {
    ...state,
    refresh,
  };
}

/**
 * Hook to check if admin has a specific permission
 */
export function useAdminPermission(permission: PermissionKey): {
  granted: boolean;
  loading: boolean;
  reason?: string;
} {
  const { admin, loading, authenticated } = useAdminAuth();

  if (loading) {
    return { granted: false, loading: true };
  }

  if (!authenticated || !admin) {
    return { granted: false, loading: false, reason: 'Not authenticated' };
  }

  // Legacy admins use role-based defaults
  if (admin.isLegacyAdmin) {
    const legacyPermissions = getLegacyPermissions(admin.adminRole);
    return {
      granted: legacyPermissions[permission] === true,
      loading: false,
      reason: legacyPermissions[permission] === true ? undefined : 'Permission not granted for role',
    };
  }

  // Check the permission from the admin's permissions object
  const hasPermission = admin.permissions?.[permission] === true;

  return {
    granted: hasPermission,
    loading: false,
    reason: hasPermission ? undefined : `Permission '${permission}' not granted`,
  };
}

/**
 * Hook to check multiple permissions at once
 */
export function useAdminPermissions(permissions: PermissionKey[]): {
  results: Record<PermissionKey, boolean>;
  loading: boolean;
  allGranted: boolean;
  anyGranted: boolean;
} {
  const { admin, loading, authenticated } = useAdminAuth();

  if (loading || !authenticated || !admin) {
    return {
      results: Object.fromEntries(permissions.map((p) => [p, false])) as Record<PermissionKey, boolean>,
      loading,
      allGranted: false,
      anyGranted: false,
    };
  }

  const checkPermission = (perm: PermissionKey): boolean => {
    if (admin.isLegacyAdmin) {
      const legacyPermissions = getLegacyPermissions(admin.adminRole);
      return legacyPermissions[perm] === true;
    }
    return admin.permissions?.[perm] === true;
  };

  const results = Object.fromEntries(
    permissions.map((p) => [p, checkPermission(p)])
  ) as Record<PermissionKey, boolean>;

  return {
    results,
    loading: false,
    allGranted: permissions.every((p) => results[p]),
    anyGranted: permissions.some((p) => results[p]),
  };
}

/**
 * Hook to check if admin is in a specific role level or higher
 */
export function useAdminRole(minRole: AdminRole): {
  hasRole: boolean;
  loading: boolean;
} {
  const { admin, loading, authenticated } = useAdminAuth();

  if (loading || !authenticated || !admin) {
    return { hasRole: false, loading };
  }

  const roleOrder: AdminRole[] = [
    'SUPER_ADMIN',
    'SPORT_ADMIN',
    'STATE_ADMIN',
    'DISTRICT_ADMIN',
    'TOURNAMENT_DIRECTOR',
  ];

  const currentRoleIndex = roleOrder.indexOf(admin.adminRole);
  const minRoleIndex = roleOrder.indexOf(minRole);

  return {
    hasRole: currentRoleIndex <= minRoleIndex,
    loading: false,
  };
}

/**
 * Get default permissions for legacy admin roles
 */
function getLegacyPermissions(role: AdminRole): Record<string, boolean> {
  switch (role) {
    case 'SUPER_ADMIN':
      return {
        canCreateTournament: true,
        canApproveTournament: true,
        canPublishTournament: true,
        canStartTournament: true,
        canPauseTournament: true,
        canCancelTournament: true,
        canEditTournament: true,
        canGenerateBracket: true,
        canScoreMatches: true,
        canRollbackMatch: true,
        canOverrideResult: true,
        canViewPlayers: true,
        canEditPlayer: true,
        canBanPlayer: true,
        canAdjustElo: true,
        canViewRevenue: true,
        canProcessRefund: true,
        canProcessPayout: true,
        canViewDisputes: true,
        canResolveDisputes: true,
        canApproveOrgs: true,
        canSuspendOrgs: true,
        canAssignAdmins: true,
        canAssignDirectors: true,
        canViewAuditLogs: true,
        canManageFeatureFlags: true,
        canViewAnalytics: true,
        canManageSportRules: true,
        canAccessHealthDashboard: true,
        canManageSectors: true,
        canEditCompletedMatch: true,
        canDeleteTournament: true,
      };
    case 'SPORT_ADMIN':
      return {
        canCreateTournament: true,
        canApproveTournament: true,
        canPublishTournament: true,
        canStartTournament: true,
        canPauseTournament: true,
        canCancelTournament: true,
        canEditTournament: true,
        canGenerateBracket: true,
        canScoreMatches: true,
        canRollbackMatch: true,
        canOverrideResult: true,
        canViewPlayers: true,
        canEditPlayer: true,
        canBanPlayer: true,
        canAdjustElo: true,
        canViewRevenue: true,
        canProcessRefund: true,
        canProcessPayout: true,
        canViewDisputes: true,
        canResolveDisputes: true,
        canApproveOrgs: true,
        canSuspendOrgs: true,
        canAssignAdmins: true,
        canAssignDirectors: true,
        canViewAuditLogs: true,
        canViewAnalytics: true,
        canManageSportRules: true,
        canAccessHealthDashboard: true,
        canEditCompletedMatch: false,
        canDeleteTournament: false,
        canManageFeatureFlags: false,
        canManageSectors: false,
      };
    case 'STATE_ADMIN':
      return {
        canCreateTournament: true,
        canApproveTournament: false,
        canPublishTournament: false,
        canStartTournament: true,
        canPauseTournament: true,
        canCancelTournament: true,
        canEditTournament: true,
        canGenerateBracket: true,
        canScoreMatches: true,
        canRollbackMatch: false,
        canOverrideResult: false,
        canViewPlayers: true,
        canEditPlayer: false,
        canBanPlayer: false,
        canAdjustElo: true,
        canViewRevenue: false,
        canProcessRefund: false,
        canProcessPayout: false,
        canViewDisputes: true,
        canResolveDisputes: false,
        canApproveOrgs: false,
        canSuspendOrgs: false,
        canAssignAdmins: false,
        canAssignDirectors: true,
        canViewAuditLogs: true,
        canViewAnalytics: true,
        canManageSportRules: false,
        canAccessHealthDashboard: false,
        canManageFeatureFlags: false,
        canManageSectors: false,
        canEditCompletedMatch: false,
        canDeleteTournament: false,
      };
    case 'DISTRICT_ADMIN':
      return {
        canCreateTournament: true,
        canApproveTournament: false,
        canPublishTournament: false,
        canStartTournament: true,
        canPauseTournament: false,
        canCancelTournament: false,
        canEditTournament: true,
        canGenerateBracket: true,
        canScoreMatches: true,
        canRollbackMatch: false,
        canOverrideResult: false,
        canViewPlayers: true,
        canEditPlayer: false,
        canBanPlayer: false,
        canAdjustElo: false,
        canViewRevenue: false,
        canProcessRefund: false,
        canProcessPayout: false,
        canViewDisputes: true,
        canResolveDisputes: false,
        canApproveOrgs: false,
        canSuspendOrgs: false,
        canAssignAdmins: false,
        canAssignDirectors: true,
        canViewAuditLogs: false,
        canViewAnalytics: true,
        canManageSportRules: false,
        canAccessHealthDashboard: false,
        canManageFeatureFlags: false,
        canManageSectors: false,
        canEditCompletedMatch: false,
        canDeleteTournament: false,
      };
    case 'TOURNAMENT_DIRECTOR':
      return {
        canCreateTournament: false,
        canApproveTournament: false,
        canPublishTournament: false,
        canStartTournament: false,
        canPauseTournament: false,
        canCancelTournament: false,
        canEditTournament: false,
        canGenerateBracket: false,
        canScoreMatches: true,
        canRollbackMatch: false,
        canOverrideResult: false,
        canViewPlayers: true,
        canEditPlayer: false,
        canBanPlayer: false,
        canAdjustElo: false,
        canViewRevenue: false,
        canProcessRefund: false,
        canProcessPayout: false,
        canViewDisputes: true,
        canResolveDisputes: false,
        canApproveOrgs: false,
        canSuspendOrgs: false,
        canAssignAdmins: false,
        canAssignDirectors: false,
        canViewAuditLogs: false,
        canViewAnalytics: false,
        canManageSportRules: false,
        canAccessHealthDashboard: false,
        canManageFeatureFlags: false,
        canManageSectors: false,
        canEditCompletedMatch: false,
        canDeleteTournament: false,
      };
    default:
      return {};
  }
}

/**
 * Component to conditionally render children based on permission
 */
export function PermissionGate({
  permission,
  permissions,
  requireAll = false,
  fallback = null,
  children,
}: {
  permission?: PermissionKey;
  permissions?: PermissionKey[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { admin, loading, authenticated } = useAdminAuth();

  if (loading) {
    return null;
  }

  if (!authenticated || !admin) {
    return <>{fallback}</>;
  }

  const checkPermission = (perm: PermissionKey): boolean => {
    if (admin.isLegacyAdmin) {
      const legacyPermissions = getLegacyPermissions(admin.adminRole);
      return legacyPermissions[perm] === true;
    }
    return admin.permissions?.[perm] === true;
  };

  if (permission) {
    if (!checkPermission(permission)) {
      return <>{fallback}</>;
    }
  }

  if (permissions && permissions.length > 0) {
    if (requireAll) {
      if (!permissions.every((p) => checkPermission(p))) {
        return <>{fallback}</>;
      }
    } else {
      if (!permissions.some((p) => checkPermission(p))) {
        return <>{fallback}</>;
      }
    }
  }

  return <>{children}</>;
}

/**
 * Component to conditionally render children based on admin role
 */
export function RoleGate({
  minRole,
  allowedRoles,
  fallback = null,
  children,
}: {
  minRole?: AdminRole;
  allowedRoles?: AdminRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { admin, loading, authenticated } = useAdminAuth();

  if (loading) {
    return null;
  }

  if (!authenticated || !admin) {
    return <>{fallback}</>;
  }

  const roleOrder: AdminRole[] = [
    'SUPER_ADMIN',
    'SPORT_ADMIN',
    'STATE_ADMIN',
    'DISTRICT_ADMIN',
    'TOURNAMENT_DIRECTOR',
  ];

  const currentRoleIndex = roleOrder.indexOf(admin.adminRole);

  if (minRole) {
    const minRoleIndex = roleOrder.indexOf(minRole);
    if (currentRoleIndex > minRoleIndex) {
      return <>{fallback}</>;
    }
  }

  if (allowedRoles && allowedRoles.length > 0) {
    if (!allowedRoles.includes(admin.adminRole)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}
