import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    { id: "plan_starter", code: "STARTER", name: "Starter", monthlyPrice: 350, activeStudentLimit: 60, storageLimitGb: 30, isCustom: false, sortOrder: 10 },
    { id: "plan_growth", code: "GROWTH", name: "Growth", monthlyPrice: 750, activeStudentLimit: 200, storageLimitGb: 80, isCustom: false, sortOrder: 20 },
    { id: "plan_pro", code: "PRO", name: "Pro", monthlyPrice: 1300, activeStudentLimit: 400, storageLimitGb: 150, isCustom: false, sortOrder: 30 },
    { id: "plan_enterprise", code: "ENTERPRISE", name: "Enterprise", monthlyPrice: null, activeStudentLimit: null, storageLimitGb: null, isCustom: true, sortOrder: 40 },
  ];
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({ where: { code: plan.code }, create: plan, update: { ...plan, id: undefined } });
  }
  console.log("Subscription plans seeded.");
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const phone = process.env.ADMIN_PHONE?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !email || !phone || !password) {
    console.log("Admin seed skipped because credentials are not configured.");
    return;
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
