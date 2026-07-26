import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { requireTenantMember } from "../../lib/auth";
import { hasPermission, tenantStaffRoles } from "../../lib/permissions";
import { DashboardShell } from "../dashboard-shell";
import { AnimatedNumber } from "../skoola-motion";
import { ActiveAnnouncements } from "../active-announcements";
import { StudentInviteLink } from "./student-invite-link";
import {
  Activity,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  CreditCard,
  ExternalLink,
  KeyRound,
  Palette,
  PlayCircle,
  PlusCircle,
  Users,
} from "lucide-react";

export default async function TeacherDashboard() {
  const context = await requireTenantMember(tenantStaffRoles);
  const canViewAnalytics = hasPermission(context.membership.role, "analytics.view", context.membership.permissions);
  const { tenant, tenantId } = context.membership;

  if (!canViewAnalytics) {
    return (
      <DashboardShell
        kind="teacher"
        title={"أهلًا، " + context.user.fullName}
        subtitle={tenant.name + " — مساحة العمل الخاصة بك"}
        userName={context.user.fullName}
        tenantSlug={tenant.slug}
        supportMode={context.supportMode}
      >
        <section className="saasHero">
          <div>
            <span>مرحبًا بك في الأكاديمية</span>
            <h2>ابدأ من المهام المتاحة لك.</h2>
            <p>تم فتح مساحة العمل بحسب صلاحيات حسابك، مع بقاء تقارير المنصة محمية للمديرين فقط.</p>
          </div>
          <div className="quickActions">
            <Link href="/teacher/courses">عرض الكورسات</Link>
            {hasPermission(context.membership.role, "students.view", context.membership.permissions) ? (
              <Link href="/teacher/students">عرض الطلاب</Link>
            ) : null}
          </div>
        </section>
      </DashboardShell>
    );
  }

  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    students,
    activeStudents,
    courses,
    publishedCourses,
    totalLessons,
    totalExams,
    enrollments,
    newStudents,
    pendingPayments,
    grade1Count,
    grade2Count,
    grade3Count,
    recentMembers,
    recentActivity,
  ] = await Promise.all([
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: "ACTIVE" } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", status: "ACTIVE", user: { lastLoginAt: { gte: startOfMonth } } } }),
    prisma.course.count({ where: { tenantId } }),
    prisma.course.count({ where: { tenantId, status: "PUBLISHED" } }),
    prisma.lesson.count({ where: { tenantId, status: "PUBLISHED" } }),
    prisma.exam.count({ where: { tenantId, status: "PUBLISHED" } }),
    prisma.enrollment.count({ where: { tenantId } }),
    prisma.tenantMember.count({ where: { tenantId, role: "STUDENT", createdAt: { gte: startOfMonth } } }),
    prisma.payment.count({ where: { tenantId, status: "PENDING" } }),
    prisma.studentProfile.count({ where: { tenantId, grade: "FIRST_SECONDARY" } }),
    prisma.studentProfile.count({ where: { tenantId, grade: "SECOND_SECONDARY" } }),
    prisma.studentProfile.count({ where: { tenantId, grade: "THIRD_SECONDARY" } }),
    prisma.tenantMember.findMany({
      where: { tenantId, role: "STUDENT" },
      include: { user: { include: { studentProfiles: { where: { tenantId } } } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.activityLog.findMany({
      where: { tenantId },
      include: { actor: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const cards = [
    { label: "إجمالي الطلاب", value: students, note: "طلاب مسجلون بالأكاديمية", color: "blue", icon: Users },
    { label: "نشطون هذا الشهر", value: activeStudents, note: "تفاعلوا خلال آخر 30 يومًا", color: "green", icon: Activity },
    { label: "الكورسات المنشورة", value: publishedCourses, note: `من أصل ${courses} كورس`, color: "purple", icon: BookOpen },
    { label: "الدروس المتاحة", value: totalLessons, note: "فيديوهات وشروحات", color: "sky", icon: PlayCircle },
    { label: "الامتحانات والأنشطة", value: totalExams, note: "اختبارات تفاعلية", color: "indigo", icon: ClipboardCheck },
    { label: "إجمالي الاشتراكات", value: enrollments, note: `+${newStudents} هذا الشهر`, color: "orange", icon: CreditCard },
  ];

  const totalGraded = grade1Count + grade2Count + grade3Count || 1;
  const grade1Pct = Math.round((grade1Count / totalGraded) * 100);
  const grade2Pct = Math.round((grade2Count / totalGraded) * 100);
  const grade3Pct = Math.round((grade3Count / totalGraded) * 100);

  const gradeLabelsMap: Record<string, string> = {
    FIRST_SECONDARY: "الأول الثانوي",
    SECOND_SECONDARY: "الثاني الثانوي",
    THIRD_SECONDARY: "الثالث الثانوي",
  };

  return (
    <DashboardShell
      kind="teacher"
      title={"أهلًا وسهلاً، " + context.user.fullName}
      subtitle={tenant.name + " — مركز إدارة وإحصائيات الأكاديمية"}
      userName={context.user.fullName}
      tenantSlug={tenant.slug}
      supportMode={context.supportMode}
    >
      <ActiveAnnouncements tenantId={tenantId} audience="teacher" />

      {/* Hero & Quick Actions */}
      <section className="saasHero dashboardHeroCustom">
        <div>
          <span>لوحة تحكم الأكاديمية الحصرية</span>
          <h2>إدارة الكورسات، الطلاب، والمبيعات من مكان واحد.</h2>
          <p>جميع بيانات الطلاب والكورسات والمدفوعات محمية ومنفصلة تمامًا لأكاديميتك.</p>
        </div>
        {context.supportMode ? null : (
          <div className="quickActions">
            <Link href="/teacher/courses" className="quickBtn highlight">
              <PlusCircle size={17} /> إضافة كورس
            </Link>
            <Link href="/teacher/payments" className="quickBtn warning">
              <CreditCard size={17} /> طلبات الدفع {pendingPayments > 0 ? `(${pendingPayments} معلقة)` : ""}
            </Link>
            <Link href="/teacher/students" className="quickBtn">
              <Users size={17} /> إداره الطلاب
            </Link>
            <Link href={`/t/${tenant.slug}`} target="_blank" className="quickBtn ghost">
              <ExternalLink size={17} /> عرض المنصة
            </Link>
          </div>
        )}
      </section>

      {/* Pending Payment Notification Banner */}
      {pendingPayments > 0 && (
        <div className="pendingPaymentsBanner">
          <div className="bannerCopy">
            <CreditCard className="pulsingIcon" size={22} />
            <div>
              <b>يوجد {pendingPayments} طلب دفع واشتراك جديد بانتظار مراجعتك!</b>
              <small>قم بفتح صفحة المدفوعات للموافقة على التحويلات وتفعيل الكورسات للطلاب.</small>
            </div>
          </div>
          <Link href="/teacher/payments" className="btn primary sm">
            مراجعة طلبات الدفع الآن ←
          </Link>
        </div>
      )}

      <StudentInviteLink tenantSlug={tenant.slug} />

      {/* Primary KPI Row */}
      <section className="saasKpis teacherKpisGrid">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className={"kpiBox " + item.color}>
              <div className="teacherKpiHead">
                <i><Icon size={20} /></i>
                <span>{item.label}</span>
              </div>
              <b><AnimatedNumber value={item.value} /></b>
              <small>{item.note}</small>
            </article>
          );
        })}
      </section>

      {/* Main Grid: Student Distribution Chart + Recent Members & Activity */}
      <section className="saasGrid teacherMainGrid">
        <div className="saasGridCol">
          {/* Grade Distribution Visual Breakdown */}
          <div className="saasPanel gradeDistributionPanel">
            <div className="panelTitle">
              <h3>توزيع الطلاب حسب المراحل الدراسية</h3>
              <span>إجمالي {students} طالب</span>
            </div>

            <div className="gradeBarsStack">
              <div className="gradeBarRow">
                <div className="gradeInfo">
                  <span>الصف الأول الثانوي</span>
                  <b>{grade1Count} طالب ({grade1Pct}%)</b>
                </div>
                <div className="progressBarBg">
                  <div className="progressBarFill blue" style={{ width: `${grade1Pct}%` }} />
                </div>
              </div>

              <div className="gradeBarRow">
                <div className="gradeInfo">
                  <span>الصف الثاني الثانوي</span>
                  <b>{grade2Count} طالب ({grade2Pct}%)</b>
                </div>
                <div className="progressBarBg">
                  <div className="progressBarFill purple" style={{ width: `${grade2Pct}%` }} />
                </div>
              </div>

              <div className="gradeBarRow">
                <div className="gradeInfo">
                  <span>الصف الثالث الثانوي</span>
                  <b>{grade3Count} طالب ({grade3Pct}%)</b>
                </div>
                <div className="progressBarBg">
                  <div className="progressBarFill green" style={{ width: `${grade3Pct}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Joined Students */}
          <div className="saasPanel">
            <div className="panelTitle">
              <h3>أحدث الطلاب المنضمين</h3>
              <Link href="/teacher/students">عرض جميع الطلاب ←</Link>
            </div>
            {recentMembers.length ? (
              <div className="responsiveTable">
                <table>
                  <thead>
                    <tr>
                      <th>اسم الطالب</th>
                      <th>رقم الهاتف</th>
                      <th>الصف الدراسي</th>
                      <th>تاريخ الانضمام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMembers.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <b>{member.user.fullName}</b>
                        </td>
                        <td dir="ltr">{member.user.phone}</td>
                        <td>
                          <span className="gradeBadge">
                            {gradeLabelsMap[member.user.studentProfiles[0]?.grade ?? ""] ?? "—"}
                          </span>
                        </td>
                        <td>
                          <small>{new Date(member.createdAt).toLocaleDateString("ar-EG")}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="compactEmpty">
                لا يوجد طلاب بعد. شارك رابط تسجيل الأكاديمية لبدء استقبال الطلاب.
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Recent Activity & Quick Tools */}
        <div className="saasGridCol">
          <div className="saasPanel">
            <div className="panelTitle">
              <h3>آخر النشاطات والأحداث</h3>
            </div>
            {recentActivity.length ? (
              <div className="activityList">
                {recentActivity.map((item) => (
                  <div className="activityItem" key={item.id}>
                    <i className="activityDot" />
                    <div>
                      <b>{item.action}</b>
                      <span>
                        {item.actor?.fullName ?? "النظام"} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="compactEmpty">ستظهر الأنشطة والإجراءات اليومية لفريقك هنا.</div>
            )}
          </div>

          {/* Teacher Quick Tools Links */}
          <div className="saasPanel quickToolsPanel">
            <h3>أدوات الأكاديمية السريعة</h3>
            <div className="toolsList">
              <Link href="/teacher/branding" className="toolLink">
                <Palette size={18} />
                <div>
                  <b>تخصيص الهوية البصرية</b>
                  <small>تغيير الألوان والشعار</small>
                </div>
              </Link>
              <Link href="/teacher/activation-codes" className="toolLink">
                <KeyRound size={18} />
                <div>
                  <b>توليد أكواد التفعيل</b>
                  <small>إنشاء كروت وأكواد بالكورسات</small>
                </div>
              </Link>
              <Link href="/teacher/settings" className="toolLink">
                <BarChart3 size={18} />
                <div>
                  <b>إعدادات الدفع العامة</b>
                  <small>ضبط بيانات فودافون كاش وإنستاباي</small>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
