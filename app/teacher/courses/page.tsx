import { BookOpen, Plus, Sparkles } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { hasPermission } from "../../../lib/permissions";
import { CourseForm } from "./course-form";
import { CourseHub } from "./course-hub";

export default async function CoursesPage() {
  const context = await requirePermission("courses.view");
  const tenantId = context.membership.tenantId;
  const canManage = hasPermission(context.membership.role, "courses.manage", context.membership.permissions);
  const courses = await prisma.course.findMany({ where: { tenantId }, include: { _count: { select: { sections: true, enrollments: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const items = courses.map((course) => ({ id: course.id, title: course.title, slug: course.slug, description: course.description, grade: course.grade, subject: course.subject, price: Number(course.price), thumbnailUrl: course.thumbnailUrl, status: course.status, sections: course._count.sections, enrollments: course._count.enrollments }));
  return <DashboardShell kind="teacher" title="الكورسات" subtitle="مركز التحكم في المحتوى والظهور والاشتراكات" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
    <section className="courseCommandHero"><div className="courseCommandGlow"/><div><span><Sparkles size={15}/> استوديو المحتوى</span><h2>ابنِ تجربة تعليمية<br/>يحب الطالب أن يكملها.</h2><p>أنشئ الكورس، عدّل بياناته وانشره للطلاب في ثوانٍ.</p></div><div className="commandIllustration"><i><BookOpen/></i><span/><b/></div></section>
    {canManage ? <details className="createCourseDrawer"><summary><span><i><Plus size={18}/></i><b>إنشاء كورس جديد</b><small>أضف كورسًا وانشره فورًا</small></span><em>فتح النموذج ←</em></summary><CourseForm /></details> : null}
    <CourseHub key={items.map((item) => item.id).join(":")} initialCourses={items} canManage={canManage} />
  </DashboardShell>;
}
