import { prisma } from "./prisma";

const DEFAULT_PRICE_PER_STUDENT = 15;
const DEFAULT_DUE_DAY = 10;

export function billingMonthBounds(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    year,
    month,
    periodStart: new Date(Date.UTC(year, month, 1)),
    periodEnd: new Date(Date.UTC(year, month + 1, 1) - 1),
  };
}

function safeDueDate(year: number, month: number, requestedDay: number) {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Math.max(Math.trunc(requestedDay || DEFAULT_DUE_DAY), 1), lastDay);
  return new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
}

export async function ensureTenantMonthlyStatement(tenantId: string, now = new Date()) {
  const { year, month, periodStart, periodEnd } = billingMonthBounds(now);

  await prisma.billingStatement.updateMany({
    where: {
      tenantId,
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      dueDate: { lt: now },
    },
    data: { status: "OVERDUE" },
  });

  const existing = await prisma.billingStatement.findFirst({
    where: { tenantId, periodStart, periodEnd },
    include: { payments: true, paymentSubmissions: { orderBy: { createdAt: "desc" } } },
  });
  if (existing) return existing;

  const [tenant, platform, billableStudents] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, slug: true, billingSettings: { select: { pricePerStudent: true } } },
    }),
    prisma.platformSettings.upsert({ where: { id: "default" }, update: {}, create: {} }),
    prisma.tenantMember.count({
      where: { tenantId, role: "STUDENT", status: "ACTIVE", createdAt: { lte: periodEnd } },
    }),
  ]);
  if (!tenant) throw new Error("TENANT_NOT_FOUND");

  const platformPrice = Number(platform.defaultTeacherPricePerStudent || DEFAULT_PRICE_PER_STUDENT);
  const tenantPrice = Number(tenant.billingSettings?.pricePerStudent ?? platformPrice);
  const pricePerStudent = tenantPrice > 0 ? tenantPrice : platformPrice;
  const subtotal = billableStudents * pricePerStudent;
  // A month's usage is due on the configured day of the following month.
  // That keeps a newly generated current-month invoice from being overdue immediately.
  const dueDate = safeDueDate(year, month + 1, platform.teacherBillingDueDay);
  const statementNumber = `INV-${tenant.slug.toUpperCase()}-${year}${String(month + 1).padStart(2, "0")}`;

  if (!tenant.billingSettings) {
    await prisma.teacherBillingSettings.create({ data: { tenantId, pricePerStudent } });
  }

  try {
    return await prisma.billingStatement.create({
      data: {
        tenantId,
        statementNumber,
        periodStart,
        periodEnd,
        billableStudents,
        pricePerStudent,
        subtotal,
        finalAmount: subtotal,
        paidAmount: 0,
        dueDate,
        status: dueDate < now ? "OVERDUE" : "UNPAID",
      },
      include: { payments: true, paymentSubmissions: true },
    });
  } catch (error) {
    const concurrent = await prisma.billingStatement.findUnique({
      where: { statementNumber },
      include: { payments: true, paymentSubmissions: true },
    });
    if (concurrent) return concurrent;
    throw error;
  }
}

export async function ensureCurrentStatementsForAllTeachers(now = new Date()) {
  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  for (const tenant of tenants) await ensureTenantMonthlyStatement(tenant.id, now);
}

export function billingStatusLabel(status: string) {
  return ({
    UNPAID: "غير مدفوعة",
    PARTIALLY_PAID: "مدفوعة جزئيًا",
    PAID: "مدفوعة",
    OVERDUE: "متأخرة",
    CANCELLED: "ملغاة",
  } as Record<string, string>)[status] ?? status;
}