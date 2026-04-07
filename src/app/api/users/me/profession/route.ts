/**
 * User Profession API (v3.53.0)
 * 
 * GET - Get current user's profession
 * POST - Set or update user's profession, upload documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { Profession } from '@prisma/client';
import { db } from '@/lib/db';
import { 
  getUserProfession, 
  setUserProfession, 
  clearUserProfession,
  setProfessionVisibility,
  uploadProfessionDocument,
  getAllProfessions,
  PROFESSION_LABELS,
  PROFESSION_GOVERNING_BODIES,
} from '@/lib/profession-manager';
import { getSession } from '@/lib/auth';

// GET /api/users/me/profession
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const professionInfo = await getUserProfession(session.userId);

    return NextResponse.json({
      profession: professionInfo?.profession || null,
      professionLabel: professionInfo?.profession 
        ? PROFESSION_LABELS[professionInfo.profession] 
        : null,
      membershipNumber: professionInfo?.membershipNumber || null,
      governingBody: professionInfo?.governingBody || null,
      verificationStatus: professionInfo?.verificationStatus || 'NONE',
      verifiedAt: professionInfo?.verifiedAt || null,
      showPublicly: professionInfo?.showPublicly || false,
      canClaimRewards: professionInfo?.canClaimRewards || false,
      documentUrl: professionInfo?.documentUrl || null,
      availableProfessions: getAllProfessions().map(p => ({
        value: p,
        label: PROFESSION_LABELS[p],
        governingBody: PROFESSION_GOVERNING_BODIES[p],
      })),
    });
  } catch (error) {
    console.error('Error fetching profession:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profession' },
      { status: 500 }
    );
  }
}

// POST /api/users/me/profession
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profession, membershipNumber, showPublicly, action, documentUrl } = body;

    // Handle clear action
    if (action === 'clear') {
      const result = await clearUserProfession(session.userId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Profession cleared successfully',
      });
    }

    // Handle visibility update
    if (action === 'setVisibility' && typeof showPublicly === 'boolean') {
      const result = await setProfessionVisibility(session.userId, showPublicly);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Visibility updated successfully',
      });
    }

    // Handle document upload
    if (action === 'uploadDocument' && documentUrl) {
      // SECURITY: Validate that the documentUrl is an owned file
      // The documentUrl should be a file ID from our UploadedFile table
      // Not an arbitrary external URL
      
      let fileId = documentUrl;
      
      // If it looks like a URL (starts with / or http), extract file ID
      if (documentUrl.startsWith('/api/upload/')) {
        fileId = documentUrl.replace('/api/upload/', '');
      } else if (documentUrl.startsWith('http')) {
        // Reject external URLs - only allow our own uploaded files
        return NextResponse.json(
          { error: 'External URLs are not allowed. Please upload the document through the file upload endpoint.' },
          { status: 400 }
        );
      }
      
      // Verify the file exists and belongs to this user
      const uploadedFile = await db.uploadedFile.findUnique({
        where: { id: fileId },
        select: { userId: true, purpose: true },
      });
      
      if (!uploadedFile) {
        return NextResponse.json(
          { error: 'File not found. Please upload the document again.' },
          { status: 400 }
        );
      }
      
      if (uploadedFile.userId !== session.userId) {
        return NextResponse.json(
          { error: 'You can only upload documents that you own.' },
          { status: 403 }
        );
      }
      
      // Verify the file is for ID document purpose
      if (uploadedFile.purpose !== 'idDocument' && uploadedFile.purpose !== 'general') {
        return NextResponse.json(
          { error: 'This file was not uploaded for document verification purposes.' },
          { status: 400 }
        );
      }
      
      // Use the canonical URL from our system
      const canonicalUrl = `/api/upload/${fileId}`;
      
      const result = await uploadProfessionDocument(session.userId, canonicalUrl);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Document uploaded successfully. Verification pending.',
      });
    }

    // Validate profession
    if (!profession || !Object.values(Profession).includes(profession)) {
      return NextResponse.json(
        { error: 'Invalid profession' },
        { status: 400 }
      );
    }

    // Set profession
    const result = await setUserProfession({
      userId: session.userId,
      profession: profession as Profession,
      membershipNumber: membershipNumber || undefined,
      showPublicly: showPublicly || false,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      profession: result.user?.profession,
      professionLabel: result.user?.profession 
        ? PROFESSION_LABELS[result.user.profession] 
        : null,
      membershipNumber: result.user?.professionMembershipNumber,
      governingBody: result.user?.professionGoverningBody,
      verificationStatus: result.user?.professionVerified,
      showPublicly: result.user?.showProfessionPublicly,
      message: 'Profession updated successfully. Note: Verification may be required to claim rewards in profession-exclusive tournaments.',
    });
  } catch (error) {
    console.error('Error setting profession:', error);
    return NextResponse.json(
      { error: 'Failed to set profession' },
      { status: 500 }
    );
  }
}
