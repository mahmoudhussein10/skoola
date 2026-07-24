import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { authorizeTenant } from "../../../../lib/api-auth";
import type { PaymentStatus } from "@prisma/client";

export async function GET(request: Request) {
  const auth = await authorizeTenant("students.view");
  if (!auth.ok) return auth.response;

  const tenantId = auth.context.membership.tenantId;
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const query = searchParams.get("query")?.trim() || "";

  const whereCondition: {
    tenantId: string;
    status?: PaymentStatus;
    OR?: Array<Record<string, unknown>>;
  } = { tenantId };

  if (statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
    whereCondition.status = statusParam as PaymentStatus;
  }

  if (query) {
    whereCondition.OR = [
      { student: { fullName: { contains: query, mode: "insensitive" } } },
      { student: { phone: { contains: query } } },
      { referenceNumber: { contains: query } },
      { course: { title: { contains: query, mode: "insensitive" } } },
    ];
  }

  const [payments, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    prisma.payment.findMany({
      where: whereCondition,
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentProfiles: {
              where: { tenantId },
              select: { grade: true, parentPhone: true },
            },
          },
        },
        course: { select: { id: true, title: true, price: true, slug: true } },
        reviewedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.payment.count({ where: { tenantId, status: "PENDING" } }),
    prisma.payment.count({ where: { tenantId, status: "APPROVED" } }),
    prisma.payment.count({ where: { tenantId, status: "REJECTED" } }),
  ]);

  return NextResponse.json({
    ok: true,
    payments,
    stats: {
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  });
}
