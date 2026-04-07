import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cookies } from 'next/headers';
import { Role, SportType, AuditAction } from '@prisma/client';
import { getAuthenticatedAdmin } from '@/lib/auth';
import { z } from 'zod';
import {
  assignDirectorToTournament,
  updateDirector,
  removeDirectorFromTournament,
  formatCredentialsMessage,
  formatCredentialsSMS,
} from '@/lib/director-credentials';
import { validateBody, validationErrorResponse, idParamSchema } from '@/lib/validation';

// Director assignment validation schemas
const directorAssignSchema = z.object({
  action: z.literal('assign'),
  name: z.string().min(1, 'Director name is required').max(200, 'Name too long'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
  email: z.string().email('Invalid email address').optional().nullable(),
});

const directorUpdateSchema = z.object({
  action: z.literal('update'),
  name: z.string().min(1, 'Director name is required').max(200, 'Name too long').optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number').optional(),
  email: z.string().email('Invalid email address').optional().nullable(),
  regenerateCredentials: z.boolean().optional(),
});

const directorRemoveSchema = z.object({
  action: z.literal('remove'),
});

const directorShareCredentialsSchema = z.object({
  action: z.literal('share-credentials'),
});

const directorActionSchema = z.discriminatedUnion('action', [
  directorAssignSchema,
  directorUpdateSchema,
  directorRemoveSchema,
  directorShareCredentialsSchema,
]);

// Get director info for a tournament
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = await getAuthenticatedAdmin(cookieStore);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    const adminRoles = [Role.ADMIN, Role.SUB_ADMIN, Role.TOURNAMENT_DIRECTOR];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;

    const tournament = await db.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        directorName: true,
        directorPhone: true,
        directorEmail: true,
        directorUsername: true,
        directorCredentialsSent: true,
        directorAssignedAt: true,
        directorAssignedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      director: tournament.directorName
        ? {
            name: tournament.directorName,
            phone: tournament.directorPhone,
            email: tournament.directorEmail,
            username: tournament.directorUsername,
            credentialsSent: tournament.directorCredentialsSent,
            assignedAt: tournament.directorAssignedAt,
            assignedBy: tournament.directorAssignedBy,
          }
        : null,
    });
  } catch (error) {
    console.error('Get director error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Assign or update director
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const auth = await getAuthenticatedAdmin(cookieStore);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { user, session } = auth;

    const adminRoles: Role[] = [Role.ADMIN, Role.SUB_ADMIN];
    if (!adminRoles.includes(user.role)) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { id } = await params;
    
    // Validate tournament ID
    const paramsValidation = validateBody(idParamSchema, { id });
    if (!paramsValidation.success) {
      return validationErrorResponse(paramsValidation);
    }
    
    const body = await request.json();
    
    // Validate request body with Zod
    const validation = validateBody(directorActionSchema, body);
    if (!validation.success) {
      return validationErrorResponse(validation);
    }
    
    const { action } = validation.data;

    // Get tournament for audit
    const tournament = await db.tournament.findUnique({
      where: { id },
      select: { id: true, name: true, sport: true, directorName: true },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    let result;

    switch (action) {
      case 'assign': {
        const { name, phone, email } = validation.data;
        result = await assignDirectorToTournament({
          tournamentId: id,
          name,
          phone,
          email,
          assignedById: user.id,
        });
        break;
      }

      case 'update': {
        const { name, phone, email, regenerateCredentials } = validation.data;
        result = await updateDirector({
          tournamentId: id,
          name,
          phone,
          email,
          regenerateCredentials,
        });
        break;
      }

      case 'remove':
        result = await removeDirectorFromTournament(id);
        break;

      case 'share-credentials':
        // Just return formatted credentials for sharing manually
        if (!tournament.directorUsername) {
          return NextResponse.json(
            { error: 'No director assigned' },
            { status: 400 }
          );
        }
        // Return the message templates (actual sending happens via separate notification API)
        return NextResponse.json({
          success: true,
          message: formatCredentialsMessage(
            tournament.name,
            tournament.directorUsername,
            '••••••••••' // Don't reveal password
          ),
          sms: formatCredentialsSMS(
            tournament.name,
            tournament.directorUsername,
            '••••••••••'
          ),
          note: 'Use the credentials shown on screen to share with the director',
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Log audit
    await db.auditLog.create({
      data: {
        sport: tournament.sport as SportType,
        action: AuditAction.ADMIN_OVERRIDE,
        actorId: user.id,
        actorRole: user.role as Role,
        targetType: 'Tournament',
        targetId: id,
        tournamentId: id,
        metadata: JSON.stringify({
          action: `DIRECTOR_${action.toUpperCase()}`,
          directorName: name || tournament.directorName,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      tournament: result.tournament,
      credentials: result.credentials,
    });
  } catch (error) {
    console.error('Director assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
