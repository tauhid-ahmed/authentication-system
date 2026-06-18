/**
 * @file Database Seed Script
 *
 * Creates initial data for development:
 *   - A SUPER_ADMIN user
 *   - An ADMIN user
 *   - A regular USER
 *
 * Run with: pnpm db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function seed() {
  console.log("🌱 Seeding database...");

  // Seed users
  const users = [
    { email: "superadmin@auth.dev", name: "Super Admin", role: "SUPER_ADMIN" as const, password: "SuperAdmin1!" },
    { email: "admin@auth.dev", name: "Admin User", role: "ADMIN" as const, password: "AdminUser1!" },
    { email: "user@auth.dev", name: "Regular User", role: "USER" as const, password: "RegUser1234!" },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 12);
    await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        emailVerified: true,
      },
    });
    console.log(`  ✅ Created ${u.role}: ${u.email} / ${u.password}`);
  }

  console.log("\n✅ Database seeded successfully!");
  console.log("\n📋 Test credentials:");
  for (const u of users) {
    console.log(`  ${u.role.padEnd(12)} ${u.email.padEnd(30)} ${u.password}`);
  }
}

seed()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
