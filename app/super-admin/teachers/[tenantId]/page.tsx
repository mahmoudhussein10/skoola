import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { requireSuperAdmin } from "../../../../lib/auth";
import { DashboardShell } from "../../../dashboard-shell";
import { TeacherAccountManager } from "./teacher-account-manager";

export default async function TenantDetails({ params }: { params: Promise<{ tenantId: string }> }) {
  const user = await requireSuperAdmin();
  const { tenantId } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      owner: { select: { fullName: true, email: true, username: true, phone: true } },
      _count: { select: { members: true, courses: true, lessons: true, exams: true, enrollments: true } },
    },
  });
  if (!tenant) notFound();
  const serializedTenant = JSON.parse(JSON.stringify(tenant));
  return (
    <DashboardShell kind="super" title={`منصة ${tenant.name}`} subtitle={`إدارة حساب المدرس والمنصة · /t/${tenant.slug}`} userName={user.fullName}>
      <TeacherAccountManager tenant={serializedTenant} />
      <section className="saasKpis">
        <article><span>الأعضاء</span><b>{tenant._count.members}</b></article>
        <article><span>الكورسات</span><b>{tenant._count.courses}</b></article>
        <article><span>الدروس</span><b>{tenant._count.lessons}</b></article>
        <article><span>الامتحانات</span><b>{tenant._count.exams}</b></article>
      </section>
    </DashboardShell>
  );
}