import { NextResponse } from "next/server";
import { z } from "zod";
import type { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorizeSuperAdmin, isSameOrigin } from "@/lib/api-auth";
import { requestFingerprint } from "@/lib/auth";

const generateStatementSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  dueDate: z.string(),
  adjustments: z.number().default(0),
  discount: z.number().default(0),
  internalNote: z.string().optional().nullable(),
});

const recordPaymentSchema = z.object({
  statementId: z.string().optional().nullable(),
  amount: z.number().gt(0, "المبلغ يجب أن يكون أكبر من 0"),
  paymentDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "VODAFONE_CASH", "INSTAPAY", "FAWRY", "PAYMOB", "STRIPE", "OTHER"]).default("CASH"),
  referenceNumber: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;

  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { fullName: true, email: true, phone: true } },
      billingSettings: true,
      billingStatements: {
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      },
      teacherPayments: {
        orderBy: { paymentDate: "desc" },
      },
    },
  });

  if (!tenant) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });

  // Count active billable students
  const activeStudentsCount = await prisma.tenantMember.count({
    where: {
      tenantId,
      role: "STUDENT",
      status: "ACTIVE",
    },
  });

  const pricePerStudent = Number(tenant.billingSettings?.pricePerStudent ?? 0);
  const currentSubtotal = activeStudentsCount * pricePerStudent;

  return NextResponse.json({
    ok: true,
    tenantName: tenant.name,
    teacherName: tenant.owner?.fullName,
    pricePerStudent,
    activeStudentsCount,
    currentSubtotal,
    billingSettings: tenant.billingSettings,
    statements: tenant.billingStatements,
    payments: tenant.teacherPayments,
  });
}

// POST endpoint: generate a new BillingStatement or record a payment
export async function POST(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const auth = await authorizeSuperAdmin();
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const { tenantId } = await params;
  const url = new URL(request.url);
  const action = url.searchParams.get("action") ?? "generate_statement";

  const json = await request.json().catch(() => null);
  const { ipHash } = await requestFingerprint();

  if (action === "record_payment") {
    const parsed = recordPaymentSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, message: "بيانات الدفع غير صحيحة" }, { status: 400 });
    }

    const { statementId, amount, paymentDate, paymentMethod, referenceNumber, notes } = parsed.data;

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.teacherPaymentRecord.create({
        data: {
          tenantId,
          statementId: statementId || null,
          amount,
          paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
          paymentMethod: paymentMethod as PaymentMethod,
          referenceNumber: referenceNumber || null,
          notes: notes || null,
        },
      });

      if (statementId) {
        const stmt = await tx.billingStatement.findUnique({
          where: { id: statementId },
          include: { payments: true },
        });

        if (stmt) {
          const totalPaid = stmt.payments.reduce((sum: number, item: { amount: unknown }) => sum + Number(item.amount), 0) + amount;
          const finalAmt = Number(stmt.finalAmount);

          let newStatus = stmt.status;
          if (totalPaid >= finalAmt) {
            newStatus = "PAID";
          } else if (totalPaid > 0) {
            newStatus = "PARTIALLY_PAID";
          }

          await tx.billingStatement.update({
            where: { id: statementId },
            data: {
              paidAmount: totalPaid,
              status: newStatus,
            },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorId: auth.context.user.id,
          action: "TEACHER_PAYMENT_RECORDED",
          entityType: "TeacherPaymentRecord",
          entityId: p.id,
          metadata: { amount, statementId, paymentMethod, referenceNumber },
          ipHash,
        },
      });

      return p;
    });

    return NextResponse.json({ ok: true, payment, message: "تم تسجيل الدفعة بنجاح" });
  }

  // Action: generate_statement
  const parsed = generateStatementSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "بيانات المطالبة المالية غير صحيحة" }, { status: 400 });
  }

  const { periodStart, periodEnd, dueDate, adjustments, discount, internalNote } = parsed.data;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { billingSettings: true },
  });

  if (!tenant) return NextResponse.json({ ok: false, message: "المنصة غير موجودة" }, { status: 404 });

  // Count active students during or registered within the billing period
  const pStart = new Date(periodStart);
  const pEnd = new Date(periodEnd);

  const billableStudents = await prisma.tenantMember.count({
    where: {
      tenantId,
      role: "STUDENT",
      status: "ACTIVE",
      createdAt: { lte: pEnd },
    },
  });

  const pricePerStudent = Number(tenant.billingSettings?.pricePerStudent ?? 0);
  const subtotal = billableStudents * pricePerStudent;
  const finalAmount = Math.max(0, subtotal + adjustments - discount);

  const statementNumber = `INV-${tenant.slug.toUpperCase()}-${Date.now().toString().slice(-6)}`;

  const statement = await prisma.$transaction(async (tx) => {
    const stmt = await tx.billingStatement.create({
      data: {
        tenantId,
        statementNumber,
        periodStart: pStart,
        periodEnd: pEnd,
        billableStudents,
        pricePerStudent,
        subtotal,
        adjustments,
        discount,
        finalAmount,
        paidAmount: 0,
        status: "UNPAID",
        dueDate: new Date(dueDate),
        internalNote: internalNote || null,
      },
    });

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "BILLING_STATEMENT_GENERATED",
        entityType: "BillingStatement",
        entityId: stmt.id,
        metadata: { statementNumber, finalAmount, billableStudents, pricePerStudent },
        ipHash,
      },
    });

    return stmt;
  });

  return NextResponse.json({ ok: true, statement, message: "تم إصدار الفاتورة/المطالبة بنجاح" });
}
