import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";

export default async function AssignmentsPage() {
  const context = await requirePermission("analytics.view");
  const tenantId = context.membership.tenantId;

  const assignments = await prisma.assignment.findMany({
    where: { tenantId },
    include: {
      course: { select: { title: true } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <DashboardShell
      kind="teacher"
      title="إدارة الواجبات والأنشطة"
      subtitle={`${assignments.length.toLocaleString("en-US")} واجب منشأ`}
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <section className="saasPanel pagePanel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h3>قائمة الواجبات المطلوبة</h3>
        </div>

        <div className="responsiveTable">
          <table>
            <thead>
              <tr>
                <th>عنوان الواجب</th>
                <th>الكورس</th>
                <th>موعد التسليم</th>
                <th>عدد التسليمات</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td><b>{assignment.title}</b></td>
                  <td>{assignment.course.title}</td>
                  <td>{assignment.dueAt ? new Date(assignment.dueAt).toLocaleDateString("ar-EG") : "مفتوح"}</td>
                  <td>{assignment._count.submissions} تسليم</td>
                  <td><span className={`tenantStatus ${assignment.status.toLowerCase()}`}>{assignment.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!assignments.length ? <div className="compactEmpty">لا توجد واجبات مضافة بعد.</div> : null}
      </section>
    </DashboardShell>
  );
}
