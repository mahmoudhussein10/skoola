import { redirect } from "next/navigation";
import { getAuthContext } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { OpeningFeeClient } from "./opening-fee-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "تفعيل حساب المدرس" };

export default async function OpeningFeePage() {
  const context = await getAuthContext();
  if (!context?.membership || !context.user.role.startsWith("TEACHER")) redirect("/login?role=teacher");
  const tenantId = context.membership.tenantId;
  const billing = await prisma.teacherBillingSettings.findUnique({ where: { tenantId } });
  if (!billing || ["PAID", "WAIVED", "NOT_REQUIRED"].includes(billing.openingFeeStatus)) redirect("/teacher");
  const pending = await prisma.teacherBillingPaymentSubmission.findFirst({
    where: { tenantId, purpose: "OPENING_FEE", status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  return <OpeningFeeClient
    teacherName={context.user.fullName}
    academyName={context.membership.tenant.name}
    amount={Number(billing.openingFeeAmount)}
    dueAt={billing.openingFeeDueAt?.toISOString() ?? new Date().toISOString()}
    status={billing.openingFeeStatus}
    pendingAt={pending?.createdAt.toISOString() ?? null}
  />;
}
