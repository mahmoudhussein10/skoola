import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !phone || !password) {
    throw new Error("Set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PHONE and ADMIN_PASSWORD before seeding.");
  }
  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must contain at least 10 characters.");
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }, { phone }] },
    select: { id: true, role: true },
  });
  if (existing) {
    if (existing.role !== UserRole.SUPER_ADMIN && existing.role !== UserRole.ADMIN) {
      throw new Error("An existing non-admin account uses one of the supplied admin identifiers.");
    }
    console.log("Admin already exists; no credentials were changed.");
    return;
  }

  await prisma.user.create({
    data: {
      fullName: process.env.ADMIN_NAME?.trim() || "مدير المنصة",
      username,
      email,
      phone,
      passwordHash: await bcrypt.hash(password, 12),
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log("Admin account created.");
}

main().finally(() => prisma.$disconnect());
