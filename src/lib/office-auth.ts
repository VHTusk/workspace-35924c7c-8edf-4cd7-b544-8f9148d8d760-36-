import type { NextRequest } from "next/server";
import { AdminRole, Role, type SportType } from "@prisma/client";
import { db } from "@/lib/db";
import { getAuthenticatedAdmin } from "@/lib/auth";

type CookieStoreLike = {
  get(name: string): { value: string } | undefined;
};

export const OFFICE_ADMIN_ROLES = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SPORT_ADMIN,
  AdminRole.STATE_ADMIN,
  AdminRole.DISTRICT_ADMIN,
] as const;

export type OfficeAdminRole = (typeof OFFICE_ADMIN_ROLES)[number];

export type OfficeAssignment = {
  id: string;
  adminRole: OfficeAdminRole;
  sport: SportType | null;
  stateCode: string | null;
  districtName: string | null;
  assignedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
};

export type OfficeAccess = {
  user: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAdmin>>>["user"];
  session: NonNullable<Awaited<ReturnType<typeof getAuthenticatedAdmin>>>["session"];
  assignments: OfficeAssignment[];
  primaryAssignment: OfficeAssignment;
  redirectPath: string;
  legacyFallback: boolean;
};

const OFFICE_ROLE_PRIORITY: OfficeAdminRole[] = [
  AdminRole.SUPER_ADMIN,
  AdminRole.SPORT_ADMIN,
  AdminRole.STATE_ADMIN,
  AdminRole.DISTRICT_ADMIN,
];

export function isOfficeAdminRole(role: AdminRole): role is OfficeAdminRole {
  return OFFICE_ADMIN_ROLES.includes(role as OfficeAdminRole);
}

export function getOfficeRolePriority(role: OfficeAdminRole): number {
  return OFFICE_ROLE_PRIORITY.indexOf(role);
}

export function getOfficeDashboardPath(role: OfficeAdminRole): string {
  switch (role) {
    case AdminRole.SUPER_ADMIN:
      return "/office/superadmin";
    case AdminRole.SPORT_ADMIN:
      return "/office/sport";
    case AdminRole.STATE_ADMIN:
      return "/office/state";
    case AdminRole.DISTRICT_ADMIN:
      return "/office/district";
    default:
      return "/office";
  }
}

export function canAccessOfficeRoute(currentRole: OfficeAdminRole, routeRole: OfficeAdminRole): boolean {
  return getOfficeRolePriority(currentRole) <= getOfficeRolePriority(routeRole);
}

export function getOfficeRoleLabel(role: OfficeAdminRole): string {
  switch (role) {
    case AdminRole.SUPER_ADMIN:
      return "Super Admin";
    case AdminRole.SPORT_ADMIN:
      return "Sport Admin";
    case AdminRole.STATE_ADMIN:
      return "State Admin";
    case AdminRole.DISTRICT_ADMIN:
      return "District Admin";
    default:
      return role;
  }
}

export function getOfficeScopeSummary(assignment: Pick<OfficeAssignment, "sport" | "stateCode" | "districtName" | "adminRole">): string {
  if (assignment.adminRole === AdminRole.SUPER_ADMIN) {
    return "All sports, all geography";
  }

  const parts: string[] = [];
  if (assignment.sport) {
    parts.push(assignment.sport);
  }
  if (assignment.stateCode) {
    parts.push(assignment.stateCode);
  }
  if (assignment.districtName) {
    parts.push(assignment.districtName);
  }

  return parts.length > 0 ? parts.join(" / ") : "Scoped access";
}

export function resolveHighestPriorityOfficeAssignment(assignments: OfficeAssignment[]): OfficeAssignment | null {
  if (assignments.length === 0) {
    return null;
  }

  return [...assignments].sort((left, right) => {
    const priorityDiff = getOfficeRolePriority(left.adminRole) - getOfficeRolePriority(right.adminRole);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return right.assignedAt.getTime() - left.assignedAt.getTime();
  })[0];
}

function buildLegacyFallbackAssignment(
  userId: string,
  role: Role,
  sport: SportType | null | undefined,
): OfficeAssignment | null {
  if (role === Role.ADMIN) {
    return {
      id: `legacy-super-${userId}`,
      adminRole: AdminRole.SUPER_ADMIN,
      sport: null,
      stateCode: null,
      districtName: null,
      assignedAt: new Date(0),
      expiresAt: null,
      isActive: true,
    };
  }

  if (role === Role.SUB_ADMIN) {
    return {
      id: `legacy-sport-${userId}`,
      adminRole: AdminRole.SPORT_ADMIN,
      sport: sport ?? null,
      stateCode: null,
      districtName: null,
      assignedAt: new Date(0),
      expiresAt: null,
      isActive: true,
    };
  }

  return null;
}

export async function getOfficeAssignmentsForUser(userId: string): Promise<OfficeAssignment[]> {
  const now = new Date();
  const assignments = await db.adminAssignment.findMany({
    where: {
      userId,
      isActive: true,
      adminRole: { in: [...OFFICE_ADMIN_ROLES] },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      id: true,
      adminRole: true,
      sport: true,
      stateCode: true,
      districtName: true,
      assignedAt: true,
      expiresAt: true,
      isActive: true,
    },
    orderBy: [{ assignedAt: "desc" }],
  });

  return assignments.filter((assignment): assignment is OfficeAssignment =>
    isOfficeAdminRole(assignment.adminRole),
  );
}

export async function getOfficeAccess(
  requestOrCookies: NextRequest | CookieStoreLike,
): Promise<OfficeAccess | null> {
  const auth = await getAuthenticatedAdmin(requestOrCookies as any);
  if (!auth?.user) {
    return null;
  }

  const assignments = await getOfficeAssignmentsForUser(auth.user.id);
  const primaryAssignment =
    resolveHighestPriorityOfficeAssignment(assignments) ??
    buildLegacyFallbackAssignment(auth.user.id, auth.user.role as Role, auth.user.sport);

  if (!primaryAssignment) {
    return null;
  }

  return {
    user: auth.user,
    session: auth.session,
    assignments,
    primaryAssignment,
    redirectPath: getOfficeDashboardPath(primaryAssignment.adminRole),
    legacyFallback: assignments.length === 0,
  };
}
