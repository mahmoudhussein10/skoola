import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { requireSuperAdmin } from "../../lib/auth";
import { DashboardShell } from "../dashboard-shell";
import { AnimatedNumber } from "../skoola-motion";

type MonthlyCount = { month: Date; count: bigint };

function chartSeries(rows: MonthlyCount[]) {
  const formatter = new Intl.DateTimeFormat("ar-EG", { month: "short" });
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
    date.setMonth(date.getMonth() - (5 - index));
    return date;
  });
  return months.map((month) => {
    const row = rows.find((item) => new Date(item.month).getFullYear() === month.getFullYear() && new Date(item.month).getMonth() === month.getMonth());
    return { label: formatter.format(month), value: Number(row?.count ?? 0) };
  });
}

function GrowthChart({ title, rows }: { title: string; rows: ReturnType<typeof chartSeries> }) {
  const max = Math.max(1, ...rows.map((item) => item.value));
  return <article className="growthChart"><div className="panelTitle"><h3>{title}</h3><span>آخر 6 أشهر</span></div><div className="growthBars">{rows.map((item) => <div key={item.label}><b style={{ height: Math.max(5, item.value / max * 100) + "%" }} title={item.value.toLocaleString("en-US")} /><span>{item.label}</span><small>{item.value.toLocaleString("en-US")}</small></div>)}</div></article>;
}

export default async function SuperAdminDashboard() {
  const user = await requireSuperAdmin();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const seriesStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const [tenants, activeTenants, suspendedTenants, students, activeStudents, courses, enrollments, staff, newTenants, todayActivity, recent, tenantRows, studentRows, courseRows] = await Promise.all([
    prisma.tenant.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.tenant.count({ where: { status: "ACTIVE" } }),
    prisma.tenant.count({ where: { status: "SUSPENDED" } }),
    prisma.tenantMember.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { role: "STUDENT", status: "ACTIVE", user: { lastLoginAt: { gte: monthStart } } } }),
    prisma.course.count(),
    prisma.enrollment.count(),
    prisma.tenantMember.count({ where: { role: { in: ["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"] }, status: "ACTIVE" } }),
    prisma.tenant.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.activityLog.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.tenant.findMany({ include: { owner: { select: { fullName: true, email: true } }, _count: { select: { members: true, courses: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
    prisma.$queryRaw<MonthlyCount[]>`SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::bigint AS count FROM "Tenant" WHERE "createdAt" >= ${seriesStart} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<MonthlyCount[]>`SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::bigint AS count FROM "TenantMember" WHERE "role" = 'STUDENT' AND "createdAt" >= ${seriesStart} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw<MonthlyCount[]>`SELECT date_trunc('month', "createdAt") AS month, COUNT(*)::bigint AS count FROM "Course" WHERE "createdAt" >= ${seriesStart} GROUP BY 1 ORDER BY 1`,
  ]);
  const cards = [["إجمالي المدرسين", tenants], ["المنصات النشطة", activeTenants], ["المنصات الموقوفة", suspendedTenants], ["إجمالي الطلاب", students], ["طلاب نشطون", activeStudents], ["الكورسات", courses], ["الاشتراكات", enrollments], ["أعضاء الفرق", staff], ["مدرسون جدد", newTenants], ["نشاط اليوم", todayActivity]];
  return <DashboardShell kind="super" title="مركز إدارة SaaS" subtitle="نظرة شاملة على كل المنصات بدون كشف بيانات حساسة" userName={user.fullName}>
    <section className="superIntro"><span>Super Admin</span><h2>إدارة المنصات والنمو والأمان.</h2><p>كل عملية إدارية حساسة تُسجل في سجل التدقيق.</p></section>
    <section className="saasKpis superKpis">{cards.map(([label, value]) => <article key={String(label)}><span>{label}</span><b><AnimatedNumber value={Number(value)} /></b><small>بيانات مباشرة</small></article>)}</section>
    <section className="analyticsGrid"><GrowthChart title="نمو المدرسين" rows={chartSeries(tenantRows)} /><GrowthChart title="نمو الطلاب" rows={chartSeries(studentRows)} /><GrowthChart title="إنشاء الكورسات" rows={chartSeries(courseRows)} /></section>
    <section className="saasPanel"><div className="panelTitle"><h3>أحدث منصات المدرسين</h3><Link href="/super-admin/teachers">إدارة المدرسين</Link></div>{recent.length ? <div className="responsiveTable"><table><thead><tr><th>المنصة</th><th>المالك</th><th>الأعضاء</th><th>الكورسات</th><th>الحالة</th></tr></thead><tbody>{recent.map((tenant) => <tr key={tenant.id}><td><Link href={"/super-admin/teachers/" + tenant.id}>{tenant.name}</Link><small>/{tenant.slug}</small></td><td>{tenant.owner?.fullName ?? "غير محدد"}</td><td>{tenant._count.members.toLocaleString("en-US")}</td><td>{tenant._count.courses.toLocaleString("en-US")}</td><td><span className={"tenantStatus " + tenant.status.toLowerCase()}>{tenant.status}</span></td></tr>)}</tbody></table></div> : <div className="compactEmpty">لا توجد منصات مسجلة بعد.</div>}</section>
  </DashboardShell>;
}