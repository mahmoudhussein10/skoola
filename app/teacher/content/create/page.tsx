import { redirect } from "next/navigation";
import { requirePermission } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { DashboardShell } from "../../../dashboard-shell";
import { SmartContentFlow } from "./smart-content-flow";

export const dynamic = "force-dynamic";

export default async function SmartContentCreatePage({ searchParams }: { searchParams: Promise<{ mode?: string; courseId?: string }> }) {
  const query = await searchParams;
  const mode = query.mode === "exam" ? "exam" : "lesson";
  const context = await requirePermission("courses.manage");
  const tenantId = context.membership.tenantId;
  const courses = await prisma.course.findMany({
    where: { tenantId, status: { not: "ARCHIVED" } },
    select: { id: true, title: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const requestedCourse = query.courseId ? courses.find((course) => course.id === query.courseId) : undefined;
  const activeCourse = requestedCourse ?? (courses.length === 1 ? courses[0] : undefined);

  if (mode === "exam" && activeCourse) {
    redirect(`/teacher/courses/${activeCourse.id}?intent=exam`);
  }

  const units = activeCourse && mode === "lesson" ? await prisma.section.findMany({
    where: { tenantId, courseId: activeCourse.id },
    select: { id: true, title: true },
    orderBy: { order: "asc" },
  }) : [];

  if (mode === "lesson" && activeCourse && units.length === 1) {
    redirect(`/teacher/courses/${activeCourse.id}?intent=lesson&sectionId=${units[0].id}`);
  }

  return (
    <DashboardShell kind="teacher" title={mode === "lesson" ? "إضافة درس" : "إنشاء امتحان"} subtitle="خطوات بسيطة تجهز لك مكان المحتوى الصحيح" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
      <SmartContentFlow mode={mode} courses={courses} activeCourse={activeCourse} units={units} />
    </DashboardShell>
  );
}
