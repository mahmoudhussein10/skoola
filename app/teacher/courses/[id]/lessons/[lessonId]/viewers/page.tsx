import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, Eye, Phone, UserRound } from "lucide-react";
import { prisma } from "../../../../../../../lib/prisma";
import { requirePermission } from "../../../../../../../lib/auth";
import { DashboardShell } from "../../../../../../dashboard-shell";

export default async function LessonViewersPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const context = await requirePermission("students.view");
  const tenantId = context.membership.tenantId;
  const { id: courseId, lessonId } = await params;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId, section: { courseId } },
    select: { id: true, title: true, section: { select: { title: true, course: { select: { title: true } } } } },
  });
  if (!lesson) notFound();

  const [views, enrolledStudents] = await Promise.all([
    prisma.videoProgress.findMany({
      where: { tenantId, lessonId },
      include: {
        student: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            studentProfiles: { where: { tenantId }, select: { parentPhone: true, grade: true }, take: 1 },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.enrollment.count({ where: { tenantId, courseId, status: { in: ["ACTIVE", "COMPLETED"] } } }),
  ]);

  const completed = views.filter((view) => view.completed).length;
  const viewRate = enrolledStudents ? Math.round((views.length / enrolledStudents) * 100) : 0;

  return (
    <DashboardShell kind="teacher" title={`مشاهدات: ${lesson.title}`} subtitle={`${lesson.section.course.title} · ${lesson.section.title}`} userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
      <div className="lessonViewersPage">
        <div className="lessonViewersTop">
          <div><span><Eye size={16} /> تقرير المحاضرة</span><h2>{lesson.title}</h2><p>كل طالب فتح المحاضرة يظهر هنا، مع آخر وقت مشاهدة وحالة الإكمال.</p></div>
          <Link className="btn secondary" href={`/teacher/courses/${courseId}`}>العودة إلى محتوى الكورس ←</Link>
        </div>

        <section className="lessonViewerKpis">
          <article><Eye /><span><small>شاهدوا المحاضرة</small><b>{views.length.toLocaleString("en-US")}</b></span></article>
          <article><CheckCircle2 /><span><small>أكملوا المحاضرة</small><b>{completed.toLocaleString("en-US")}</b></span></article>
          <article><UserRound /><span><small>طلاب الكورس</small><b>{enrolledStudents.toLocaleString("en-US")}</b></span></article>
          <article><span className="viewerRate">{viewRate}%</span><span><small>نسبة الوصول</small><b>{views.length ? "فعّالة" : "لا توجد مشاهدات"}</b></span></article>
        </section>

        <section className="lessonViewersPanel">
          <header><div><span>سجل المشاهدات</span><h3>الطلاب الذين فتحوا المحاضرة</h3></div><small>{views.length.toLocaleString("en-US")} طالب</small></header>
          {views.length ? <div className="lessonViewerList">{views.map((view) => {
            const profile = view.student.studentProfiles[0];
            return <article key={view.id} className="lessonViewerRow">
              <div className="lessonViewerIdentity"><i>{view.student.fullName.slice(0, 1)}</i><span><Link href={`/teacher/students/${view.student.id}`}>{view.student.fullName}</Link><small>{profile?.grade ?? "الصف غير محدد"}</small></span></div>
              <div className="lessonViewerContact"><span><Phone size={15} /> الطالب: <a dir="ltr" href={`tel:${view.student.phone}`}>{view.student.phone}</a></span><span><Phone size={15} /> ولي الأمر: {profile?.parentPhone ? <a dir="ltr" href={`tel:${profile.parentPhone}`}>{profile.parentPhone}</a> : <b>غير مسجل</b>}</span></div>
              <div className="lessonViewerState"><span className={view.completed ? "completed" : "viewed"}>{view.completed ? <CheckCircle2 size={15} /> : <Eye size={15} />}{view.completed ? "أكمل المحاضرة" : "فتح المحاضرة"}</span><small><Clock3 size={14} /> آخر مشاهدة: {view.updatedAt.toLocaleString("ar-EG")}</small></div>
            </article>;
          })}</div> : <div className="lessonViewerEmpty"><Eye size={34} /><h3>لم يشاهد أحد هذه المحاضرة بعد</h3><p>سيظهر الطالب هنا تلقائيًا بمجرد فتح المحاضرة.</p></div>}
        </section>
      </div>
    </DashboardShell>
  );
}
