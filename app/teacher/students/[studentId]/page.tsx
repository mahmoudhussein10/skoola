import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { requirePermission } from "../../../../lib/auth";
import { DashboardShell } from "../../../dashboard-shell";

export default async function StudentDetailPage({ params }: { params: Promise<{ studentId: string }> }) {
  const context = await requirePermission("students.view");
  const tenantId = context.membership.tenantId;
  const { studentId } = await params;

  // Strict tenant-isolated query
  const member = await prisma.tenantMember.findFirst({
    where: {
      tenantId,
      userId: studentId,
      role: "STUDENT",
    },
    include: {
      user: {
        include: {
          studentProfiles: { where: { tenantId } },
          enrollments: {
            where: { tenantId },
            include: { course: true },
            orderBy: { enrolledAt: "desc" },
          },
          examAttempts: {
            where: { tenantId },
            include: { exam: true },
            orderBy: { startedAt: "desc" },
          },
          videoProgress: {
            where: { tenantId },
            include: { lesson: true },
          },
          submissions: {
            where: { tenantId },
            include: { assignment: true },
            orderBy: { submittedAt: "desc" },
          },
        },
      },
    },
  });

  if (!member) notFound();

  const user = member.user;
  const profile = user.studentProfiles[0];

  const totalExams = user.examAttempts.length;
  const avgScore = totalExams
    ? user.examAttempts.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / totalExams
    : 0;

  const completedLessonsCount = user.videoProgress.filter((p) => p.completed).length;

  return (
    <DashboardShell
      kind="teacher"
      title={`ملف الطالب: ${user.fullName}`}
      subtitle={`بيانات ونتائج وتقارير تقدم الطالب · منصة معزولة`}
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <div style={{ display: "grid", gap: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Link href="/teacher/students" className="btn secondary">
            ← العودة لقائمة الطلاب
          </Link>
          <span className={`tenantStatus ${member.status.toLowerCase()}`}>{member.status}</span>
        </div>

        {/* Profile Details & KPIs */}
        <section className="saasKpis">
          <article><span>معدل الامتحانات</span><b>{avgScore.toLocaleString("en-US", { maximumFractionDigits: 1 })}%</b><small>من {totalExams} امتحان</small></article>
          <article><span>الكورسات المشترك بها</span><b>{user.enrollments.length} كورس</b><small>اشتراكات نشطة</small></article>
          <article><span>الدروس المكتملة</span><b>{completedLessonsCount} درس</b><small>مشاهدة كاملة</small></article>
          <article><span>الواجبات المسلمة</span><b>{user.submissions.length} واجب</b><small>تسليمات فعليّة</small></article>
        </section>

        <section className="saasGrid">
          <div className="saasPanel">
            <h3>الملف الشخصي والاتصال</h3>
            <dl className="detailList">
              <div><dt>الاسم الكامل</dt><dd>{user.fullName}</dd></div>
              <div><dt>رقم الهاتف</dt><dd dir="ltr">{user.phone}</dd></div>
              <div><dt>البريد الإلكتروني / المستخدم</dt><dd dir="ltr">{user.email ?? user.username}</dd></div>
              <div><dt>اسم ولي الأمر</dt><dd>{profile?.parentName || "غير محدد"}</dd></div>
              <div><dt>هاتف ولي الأمر</dt><dd dir="ltr">{profile?.parentPhone || "—"}</dd></div>
              <div><dt>الصف الدراسي</dt><dd>{profile?.grade || "—"}</dd></div>
              <div><dt>المحافظة / المدرسة</dt><dd>{profile?.governorate || "—"} ({profile?.schoolName || "—"})</dd></div>
              <div><dt>تاريخ التسجيل</dt><dd>{member.createdAt.toLocaleDateString("ar-EG")}</dd></div>
              <div><dt>آخر تسجيل دخول</dt><dd>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ar-EG") : "لم يدخل بعد"}</dd></div>
            </dl>
          </div>

          <div className="saasPanel">
            <h3>الكورسات المشترك بها ونسبة التقدم</h3>
            {user.enrollments.length ? (
              <div style={{ display: "grid", gap: "1rem" }}>
                {user.enrollments.map((item) => (
                  <div key={item.id} style={{ border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "8px", background: "#f8fafc" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <b>{item.course.title}</b>
                      <strong style={{ color: "#1565f5" }}>{Number(item.progressPercentage)}%</strong>
                    </div>
                    <div style={{ height: "8px", width: "100%", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Number(item.progressPercentage)}%`, background: "#1565f5" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="compactEmpty">لا يوجد كورسات مفعلة للطالب حتى الآن.</div>
            )}
          </div>
        </section>

        {/* Exams Results & Assignments */}
        <section className="saasGrid">
          <div className="saasPanel">
            <h3>نتائج الامتحانات</h3>
            {user.examAttempts.length ? (
              <div className="responsiveTable">
                <table>
                  <thead>
                    <tr><th>الامتحان</th><th>الدرجة</th><th>تاريخ التسليم</th><th>الحالة</th></tr>
                  </thead>
                  <tbody>
                    {user.examAttempts.map((attempt) => (
                      <tr key={attempt.id}>
                        <td>{attempt.exam.title}</td>
                        <td><b>{Number(attempt.score ?? 0)}%</b></td>
                        <td>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleDateString("ar-EG") : "قيد الحل"}</td>
                        <td>{attempt.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="compactEmpty">لا توجد محاولات امتحانات بعد.</div>
            )}
          </div>

          <div className="saasPanel">
            <h3>تسليمات الواجبات</h3>
            {user.submissions.length ? (
              <div className="responsiveTable">
                <table>
                  <thead>
                    <tr><th>الواجب</th><th>الدرجة</th><th>تاريخ التسليم</th></tr>
                  </thead>
                  <tbody>
                    {user.submissions.map((sub) => (
                      <tr key={sub.id}>
                        <td>{sub.assignment.title}</td>
                        <td><b>{sub.score !== null ? `${Number(sub.score)}%` : "قيد التصحيح"}</b></td>
                        <td>{new Date(sub.submittedAt).toLocaleDateString("ar-EG")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="compactEmpty">لا توجد تسليمات واجبات بعد.</div>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
