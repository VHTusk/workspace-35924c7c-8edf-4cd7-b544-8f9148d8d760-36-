import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import { shouldEnforceIdentityLock } from "@/lib/identity-lock";
import { toNameCase } from "@/lib/name-format";

function getAgeFromDobInput(dobValue: string | Date | null | undefined): number | null {
  if (!dobValue) {
    return null;
  }

  const dob = dobValue instanceof Date ? dobValue : new Date(dobValue);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDifference = today.getMonth() - dob.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 && today.getDate() < dob.getDate())
  ) {
    age -= 1;
  }

  return age >= 0 ? age : null;
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser(request);

    if (!auth) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { user } = auth;
    const userId = user.id;

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      age,
      dob,
      gender,
      photoUrl,
      bio,
      address,
      city,
      state,
      district,
      pinCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      idDocumentUrl,
      idDocumentType,
      playerOrgType,
      lockPersonalDetails,
    } = body;

    // Validation errors
    const errors: Record<string, string> = {};

    // Validate PIN code format only if provided
    if (pinCode && !/^\d{6}$/.test(pinCode)) {
      errors.pinCode = "PIN code must be 6 digits";
    }

    // Validate phone format if provided
    if (phone) {
      const cleanPhone = phone.replace(/[\s-]/g, '');
      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanPhone)) {
        errors.phone = "Invalid phone number format";
      }
    }

    // Validate emergency contact phone if provided
    if (emergencyContactPhone) {
      const cleanEmergencyPhone = emergencyContactPhone.replace(/[\s-]/g, '');
      if (!/^(\+91)?[6-9]\d{9}$/.test(cleanEmergencyPhone)) {
        errors.emergencyContactPhone = "Invalid emergency contact phone format";
      }
    }

    // Validate bio length
    if (bio && bio.length > 500) {
      errors.bio = "Bio must be 500 characters or less";
    }

    if (dob !== undefined && dob !== null && dob !== "") {
      const parsedAge = getAgeFromDobInput(dob);
      if (parsedAge === null || parsedAge < 5 || parsedAge > 120) {
        errors.dob = "Date of birth must result in an age between 5 and 120";
      }
    } else if (age !== undefined && age !== null && age !== "") {
      const parsedAge = Number(age);
      if (!Number.isInteger(parsedAge) || parsedAge < 5 || parsedAge > 120) {
        errors.age = "Age must be a whole number between 5 and 120";
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    // Check if email is being changed and if it's already used
    const currentUser = await db.user.findUnique({
      where: { id: userId },
    });

    const lockedPersonalFields = [
      firstName,
      lastName,
      email,
      phone,
      age,
      dob,
      gender,
      bio,
      idDocumentUrl,
      idDocumentType,
    ];

    const enforceIdentityLock = currentUser?.identityLocked
      ? await shouldEnforceIdentityLock(db, userId)
      : false;

    if (enforceIdentityLock && lockedPersonalFields.some((value) => value !== undefined)) {
      return NextResponse.json(
        {
          error: "Personal details are locked. Please contact ValorHive management for any changes.",
          code: "PERSONAL_DETAILS_LOCKED",
        },
        { status: 403 },
      );
    }

    if (email && currentUser?.email !== email) {
      const existingUser = await db.user.findFirst({
        where: {
          email,
          sport: currentUser?.sport,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return NextResponse.json({ error: "Email already in use" }, { status: 400 });
      }
    }

    // Update user profile - only update fields that are provided
    const updateData: Record<string, unknown> = {
      profileUpdatedAt: new Date(), // Always update this timestamp
    };

    if (currentUser?.identityLocked && !enforceIdentityLock) {
      updateData.identityLocked = false;
    }

    if (firstName !== undefined) updateData.firstName = toNameCase(firstName);
    if (lastName !== undefined) updateData.lastName = toNameCase(lastName);
    if (email !== undefined) {
      updateData.email = email;
      if (currentUser?.email !== email) {
        updateData.emailVerified = false;
        updateData.emailVerifiedAt = null;
        updateData.emailVerificationToken = null;
        updateData.emailVerificationSentAt = null;
      }
    }
    if (phone !== undefined) {
      updateData.phone = phone;
      if (currentUser?.phone !== phone) {
        updateData.verified = false;
        updateData.verifiedAt = null;
      }
    }
    if (dob !== undefined) {
      if (dob === null || dob === "") {
        updateData.dob = null;
        updateData.age = null;
      } else {
        updateData.dob = new Date(dob);
        updateData.age = getAgeFromDobInput(dob);
      }
    } else if (age !== undefined) {
      updateData.age =
        age === null || age === "" ? null : Number(age);
    }
    if (gender !== undefined) updateData.gender = gender;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (bio !== undefined) updateData.bio = bio;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (district !== undefined) updateData.district = district;
    if (pinCode !== undefined) updateData.pinCode = pinCode;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = toNameCase(emergencyContactName);
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone;
    if (emergencyContactRelation !== undefined) updateData.emergencyContactRelation = emergencyContactRelation;
    if (idDocumentUrl !== undefined) updateData.idDocumentUrl = idDocumentUrl || null;
    if (idDocumentType !== undefined) updateData.idDocumentType = idDocumentType || null;
    if (playerOrgType !== undefined) updateData.playerOrgType = playerOrgType;
    if (lockPersonalDetails === true) updateData.identityLocked = true;

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: updatedUser.id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        age: updatedUser.age,
        dob: updatedUser.dob,
        identityLocked: updatedUser.identityLocked,
        emailVerified: !!updatedUser.email && !!updatedUser.emailVerified,
        phoneVerified: !!updatedUser.phone && !!(updatedUser.verifiedAt ?? updatedUser.verified),
        photoUrl: updatedUser.photoUrl,
        bio: updatedUser.bio,
        idDocumentUrl: updatedUser.idDocumentUrl,
        idDocumentType: updatedUser.idDocumentType,
        address: updatedUser.address,
        city: updatedUser.city,
        state: updatedUser.state,
        district: updatedUser.district,
        pinCode: updatedUser.pinCode,
        emergencyContactName: updatedUser.emergencyContactName,
        emergencyContactPhone: updatedUser.emergencyContactPhone,
        emergencyContactRelation: updatedUser.emergencyContactRelation,
        playerOrgType: updatedUser.playerOrgType,
        profileUpdatedAt: updatedUser.profileUpdatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
