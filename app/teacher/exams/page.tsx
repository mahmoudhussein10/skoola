import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { TeacherExamsClient } from "./teacher-exams-client";

export const dynamic = "force-dynamic";

export default async function ExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ examId?: string }>;
}) {
  const { examId } = await searchParams;
  const context = await requirePermission("analytics.view");
  const tenantId = context.membership.tenantId;

  const exams = await prisma.exam.findMany({
    where: { tenantId },
    include: {
      course: { select: { title: true } },
      _count: { select: { questions: true, attempts: true } },
    },
    orderBy: { id: "desc" },
  });

  const formattedExams = exams.map((e) => ({
    id: e.id,
    title: e.title,
    courseTitle: e.course.title,
    durationMinutes: e.durationMinutes,
    passingScore: Number(e.passingScore),
    questionsCount: e._count.questions,
    attemptsCount: e._count.attempts,
    status: e.status,
  }));

  return (
    <DashboardShell
      kind="teacher"
      title="نتائج الامتحانات والطلاب"
      subtitle={`${exams.length.toLocaleString("en-US")} امتحان داخل منصتك`}
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <TeacherExamsClient examsList={formattedExams} selectedExamId={examId} />
    </DashboardShell>
  );
}
