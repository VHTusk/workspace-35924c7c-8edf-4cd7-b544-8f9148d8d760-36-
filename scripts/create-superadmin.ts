import { PrismaClient, Role, AdminRole, SportType, AccountTier } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EMAIL = "superadmin@valorhive.local";
const DEFAULT_PASSWORD = "SuperAdmin@123";
const DEFAULT_FIRST_NAME = "Super";
const DEFAULT_LAST_NAME = "Admin";
const DEFAULT_SPORT = SportType.CORNHOLE;

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey("raw", data, "PBKDF2", false, [
    "deriveBits",
  ]);

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  const combined = new Uint8Array(salt.length + derivedBits.byteLength);
  combined.set(salt);
  combined.set(new Uint8Array(derivedBits), salt.length);

  return Buffer.from(combined).toString("base64");
}

function getArgValue(flag: string): string | undefined {
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  const email =
    getArgValue("--email")?.trim().toLowerCase() ||
    process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() ||
    DEFAULT_EMAIL;
  const password =
    getArgValue("--password") || process.env.SUPERADMIN_PASSWORD || DEFAULT_PASSWORD;
  const firstName = getArgValue("--first-name") || process.env.SUPERADMIN_FIRST_NAME || DEFAULT_FIRST_NAME;
  const lastName = getArgValue("--last-name") || process.env.SUPERADMIN_LAST_NAME || DEFAULT_LAST_NAME;

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email_sport: { email, sport: DEFAULT_SPORT } },
    update: {
      firstName,
      lastName,
      password: passwordHash,
      role: Role.ADMIN,
      isActive: true,
      emailVerified: true,
      verified: true,
    },
    create: {
      email,
      password: passwordHash,
      firstName,
      lastName,
      sport: DEFAULT_SPORT,
      role: Role.ADMIN,
      isActive: true,
      emailVerified: true,
      verified: true,
      accountTier: AccountTier.PLAYER,
    },
  });

  const existingAssignment = await prisma.adminAssignment.findFirst({
    where: {
      userId: user.id,
      adminRole: AdminRole.SUPER_ADMIN,
    },
  });

  if (existingAssignment) {
    await prisma.adminAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        sport: null,
        isActive: true,
        deactivatedAt: null,
        deactivatedBy: null,
        deactivationReason: null,
        assignedById: user.id,
        expiresAt: null,
      },
    });
  } else {
    await prisma.adminAssignment.create({
      data: {
        userId: user.id,
        sport: null,
        adminRole: AdminRole.SUPER_ADMIN,
        assignedById: user.id,
        isActive: true,
      },
    });
  }

  console.log("");
  console.log("Superadmin ready");
  console.log(`Login email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User ID: ${user.id}`);
  console.log(`Default sport context: ${DEFAULT_SPORT}`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Failed to create superadmin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
