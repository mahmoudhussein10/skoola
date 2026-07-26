import { DashboardShell } from "../../dashboard-shell";
import { requireSuperAdmin } from "@/lib/auth";
import { ensureCurrentStatementsForAllTeachers } from "@/lib/platform-billing";
import { prisma } from "@/lib/prisma";
import { SuperAdminBillingClient } from "./super-admin-billing-client";

export const dynamic="force-dynamic";
export const metadata={title:"فواتير الأكاديميات"};
export default async function SuperAdminBillingPage(){
  const user=await requireSuperAdmin();
  await ensureCurrentStatementsForAllTeachers();
  const [statements,submissions]=await Promise.all([
    prisma.billingStatement.findMany({include:{tenant:{select:{name:true,slug:true}}},orderBy:[{periodStart:"desc"},{createdAt:"desc"}],take:200}),
    prisma.teacherBillingPaymentSubmission.findMany({include:{tenant:{select:{name:true,slug:true}},statement:{select:{statementNumber:true}}},orderBy:{createdAt:"desc"},take:100}),
  ]);
  return <DashboardShell kind="super" title="فواتير الأكاديميات" subtitle="متابعة الاستحقاقات والتحويلات لكل مدرس" userName={user.fullName}>
    <SuperAdminBillingClient statements={statements.map(s=>({id:s.id,tenantName:s.tenant.name,tenantSlug:s.tenant.slug,number:s.statementNumber,month:s.periodStart.toISOString(),students:s.billableStudents,price:Number(s.pricePerStudent),amount:Number(s.finalAmount),paid:Number(s.paidAmount),status:s.status,dueDate:s.dueDate.toISOString()}))} submissions={submissions.map(s=>({id:s.id,tenantName:s.tenant.name,statementNumber:s.statement.statementNumber,amount:Number(s.amount),method:s.paymentMethod,reference:s.referenceNumber,status:s.status,reason:s.rejectionReason,proofUrl:s.proofUrl,purpose:s.purpose,createdAt:s.createdAt.toISOString()}))}/>
  </DashboardShell>;
}
