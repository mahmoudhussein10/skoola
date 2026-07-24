import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";

export default async function ReportsPage() {
  const context = await requirePermission("analytics.view");
  const tenantId = context.membership.tenantId;

  const [totalStudents, activeStudents, courses, exams, attempts] = await Promise.all([
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: "ACTIVE" } }),
    prisma.course.count({ where: { tenantId } }),
    prisma.exam.count({ where: { tenantId } }),
    prisma.examAttempt.findMany({
      where: { tenantId, status: { in: ["SUBMITTED", "GRADED"] } },
      select: { score: true },
    }),
  ]);

  const avgExamScore = attempts.length
    ? attempts.reduce((acc, a) => acc + Number(a.score ?? 0), 0) / attempts.length
    : 0;

  return (
    <DashboardShell
      kind="teacher"
      title="التقارير والإحصائيات الشاملة"
      subtitle="تحليلات الأداء وتقدم الطلاب في المنصة"
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <section className="saasKpis">
          <article><span>إجمالي الطلاب</span><b>{totalStudents.toLocaleString("en-US")}</b><small>{activeStudents} طلاب نشطون</small></article>
          <article><span>الكورسات المنشورة</span><b>{courses.toLocaleString("en-US")}</b><small>متاحة بالكامل</small></article>
          <article><span>الامتحانات المكتملة</span><b>{exams.toLocaleString("en-US")}</b><small>اختبارات تفاعلية</small></article>
          <article><span>متوسط درجات الطلاب</span><b>{avgExamScore.toLocaleString("en-US", { maximumFractionDigits: 1 })}%</b><small>من {attempts.length} محاولة حل</small></article>
        </section>

        <section className="saasPanel">
          <h3>ملخص الأداء والمتابعة</h3>
          <p style={{ color: "#64748b" }}>
            جميع البيانات المعروضة حقيقية ومستخرجة مباشرة من نشاط الطلاب داخل منصتك فقط.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
