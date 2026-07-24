import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { requireTenantMember } from "../../../../lib/auth";
import { CourseContentManager } from "./course-content-manager";

export const dynamic = "force-dynamic";

export default async function TeacherCourseContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: courseId } = await params;
  const context = await requireTenantMember(["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR"]);
  const tenantId = context.membership.tenantId;

  const [course, allExams] = await Promise.all([
    prisma.course.findFirst({
      where: { id: courseId, tenantId },
      include: {
        sections: {
          where: { tenantId },
          orderBy: { order: "asc" },
          include: {
            lessons: {
              where: { tenantId },
              orderBy: { order: "asc" },
            },
          },
        },
      },
    }),
    prisma.exam.findMany({
      where: { courseId, tenantId },
      orderBy: { id: "asc" },
      include: {
        questions: {
          where: { tenantId },
          orderBy: { order: "asc" },
        },
      },
    }),
  ]);

  if (!course) notFound();

  const formattedCourse = {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description,
    fullDescription: course.fullDescription,
    thumbnailUrl: course.thumbnailUrl,
    price: Number(course.price),
    status: course.status,
    grade: course.grade,
    subject: course.subject,
    tenantSlug: context.membership.tenant.slug,
    sections: course.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      description: sec.description,
      order: sec.order,
      status: sec.status,
      lessons: sec.lessons.map((l) => ({
        id: l.id,
        sectionId: l.sectionId,
        title: l.title,
        description: l.description,
        content: l.content,
        type: l.type,
        videoId: l.videoId,
        videoUrl: l.videoUrl,
        attachmentUrl: l.attachmentUrl,
        thumbnailUrl: l.thumbnailUrl,
        duration: l.duration,
        order: l.order,
        isPreview: l.isPreview,
        status: l.status,
      })),
      exams: allExams.filter((e) => e.sectionId === sec.id).map((e) => ({
        id: e.id,
        sectionId: e.sectionId,
        title: e.title,
        description: e.description,
        durationMinutes: e.durationMinutes,
        passingScore: Number(e.passingScore),
        maxAttempts: e.maxAttempts,
        shuffleQuestions: e.shuffleQuestions,
        shuffleOptions: e.shuffleOptions,
        showResultImmediately: e.showResultImmediately,
        showAnswersAfterSubmit: e.showAnswersAfterSubmit,
        startDate: e.startDate?.toISOString() ?? null,
        endDate: e.endDate?.toISOString() ?? null,
        status: e.status,
        order: e.order,
        questions: e.questions.map((q) => ({
          id: q.id,
          text: q.text,
          type: q.type,
          options: (Array.isArray(q.options) ? q.options : []) as string[],
          correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : JSON.stringify(q.correctAnswer),
          explanation: q.explanation,
          points: Number(q.points),
        })),
      })),
    })),
    unassignedExams: allExams.filter((e) => !e.sectionId).map((e) => ({
      id: e.id,
      sectionId: e.sectionId,
      title: e.title,
      description: e.description,
      durationMinutes: e.durationMinutes,
      passingScore: Number(e.passingScore),
      maxAttempts: e.maxAttempts,
      shuffleQuestions: e.shuffleQuestions,
      shuffleOptions: e.shuffleOptions,
      showResultImmediately: e.showResultImmediately,
      showAnswersAfterSubmit: e.showAnswersAfterSubmit,
      startDate: e.startDate?.toISOString() ?? null,
      endDate: e.endDate?.toISOString() ?? null,
      status: e.status,
      order: e.order,
      questions: e.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        options: (Array.isArray(q.options) ? q.options : []) as string[],
        correctAnswer: typeof q.correctAnswer === "string" ? q.correctAnswer : JSON.stringify(q.correctAnswer),
        explanation: q.explanation,
        points: Number(q.points),
      })),
    })),
  };

  return <CourseContentManager course={formattedCourse} />;
}
