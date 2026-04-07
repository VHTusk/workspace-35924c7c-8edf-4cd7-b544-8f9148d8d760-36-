/**
 * Migration script to generate unique IDs for existing users and organizations
 * Run with: bun run scripts/generate-unique-ids.ts
 */

import { db } from '../src/lib/db';

// Characters used for generating unique IDs (excludes confusing chars: 0, O, I, 1, l)
const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generatePlayerId(): string {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return `VH-P-${id}`;
}

function generateOrgId(): string {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += ID_CHARS.charAt(Math.floor(Math.random() * ID_CHARS.length));
  }
  return `VH-O-${id}`;
}

async function generateUniquePlayerId(existingIds: Set<string>): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const uniqueId = generatePlayerId();
    if (!existingIds.has(uniqueId)) {
      existingIds.add(uniqueId);
      return uniqueId;
    }
    attempts++;
  }
  
  // Fallback: add timestamp suffix if too many collisions
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `VH-P-${timestamp}`;
}

async function generateUniqueOrgId(existingIds: Set<string>): Promise<string> {
  let attempts = 0;
  const maxAttempts = 100;
  
  while (attempts < maxAttempts) {
    const uniqueId = generateOrgId();
    if (!existingIds.has(uniqueId)) {
      existingIds.add(uniqueId);
      return uniqueId;
    }
    attempts++;
  }
  
  // Fallback: add timestamp suffix if too many collisions
  const timestamp = Date.now().toString(36).toUpperCase().slice(-6);
  return `VH-O-${timestamp}`;
}

async function main() {
  console.log('🚀 Starting unique ID generation...\n');
  
  // Get all existing unique IDs
  const existingUsers = await db.user.findMany({
    where: { uniqueId: { not: null } },
    select: { uniqueId: true },
  });
  const existingOrgs = await db.organization.findMany({
    where: { uniqueId: { not: null } },
    select: { uniqueId: true },
  });
  
  const existingIds = new Set<string>();
  existingUsers.forEach(u => { if (u.uniqueId) existingIds.add(u.uniqueId); });
  existingOrgs.forEach(o => { if (o.uniqueId) existingIds.add(o.uniqueId); });
  
  console.log(`Found ${existingIds.size} existing unique IDs\n`);
  
  // Find users without uniqueId
  const usersWithoutId = await db.user.findMany({
    where: { uniqueId: null },
    select: { id: true, firstName: true, lastName: true },
  });
  
  console.log(`Found ${usersWithoutId.length} users without unique ID`);
  
  // Find organizations without uniqueId
  const orgsWithoutId = await db.organization.findMany({
    where: { uniqueId: null },
    select: { id: true, name: true },
  });
  
  console.log(`Found ${orgsWithoutId.length} organizations without unique ID\n`);
  
  // Generate and update users
  let userCount = 0;
  for (const user of usersWithoutId) {
    const uniqueId = await generateUniquePlayerId(existingIds);
    await db.user.update({
      where: { id: user.id },
      data: { uniqueId },
    });
    userCount++;
    if (userCount % 10 === 0) {
      console.log(`Updated ${userCount}/${usersWithoutId.length} users...`);
    }
  }
  console.log(`✅ Updated ${userCount} users with unique IDs\n`);
  
  // Generate and update organizations
  let orgCount = 0;
  for (const org of orgsWithoutId) {
    const uniqueId = await generateUniqueOrgId(existingIds);
    await db.organization.update({
      where: { id: org.id },
      data: { uniqueId },
    });
    orgCount++;
    if (orgCount % 10 === 0) {
      console.log(`Updated ${orgCount}/${orgsWithoutId.length} organizations...`);
    }
  }
  console.log(`✅ Updated ${orgCount} organizations with unique IDs\n`);
  
  console.log('🎉 Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
