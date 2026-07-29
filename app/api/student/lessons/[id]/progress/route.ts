import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeStudentSubscription } from "../../../../../../lib/api-auth";
import { isSameOrigin } from "../../../../../../lib/api-auth";

const schema = z.object({
  completed: z.boolean().optional(),
  watchedSeconds: z.number().int().min(0).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await params;
  const authorization = await authorizeStudentSubscription();
  if (!authorization.ok) return authorization.response;
  const auth = authorization.context;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.membership.tenantId;
  const studentId = auth.user.id;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "بيانات التقدم غير صالحة" }, { status: 400 });
  const completed = parsed.data.completed;

  const lesson = await prisma.lesson.findFirst({
    where: { id: lessonId, tenantId, status: "PUBLISHED" },
    include: {
      section: {
        select: {
          courseId: true,
          course: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  if (!lesson) {
    return NextResponse.json({ ok: false, message: "الدرس غير موجود أو غير منشور" }, { status: 404 });
  }

  const courseId = lesson.section.courseId;

  // Check student active enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      tenantId,
      studentId,
      courseId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
  });

  if (!enrollment && !lesson.isPreview) {
    return NextResponse.json({ ok: false, message: "يلزم اشتراك نشط لتسجيل التقدم" }, { status: 403 });
  }

  // Opening a lesson records a view without marking the lesson completed.
  const progress = await prisma.videoProgress.upsert({
    where: { tenantId_studentId_lessonId: { tenantId, studentId, lessonId } },
    update: {
      ...(completed === undefined ? {} : { completed }),
      ...(parsed.data.watchedSeconds === undefined ? {} : { watchedSeconds: parsed.data.watchedSeconds }),
      updatedAt: new Date(),
    },
    create: {
      tenantId,
      studentId,
      lessonId,
      completed: completed ?? false,
      watchedSeconds: parsed.data.watchedSeconds ?? 0,
    },
  });

  let progressPercentage = 0;

  if (enrollment) {
    // Calculate actual course progress percentage
    const totalLessons = await prisma.lesson.count({
      where: {
        tenantId,
        status: "PUBLISHED",
        section: { courseId },
      },
    });

    const completedLessons = await prisma.videoProgress.count({
      where: {
        tenantId,
        studentId,
        completed: true,
        lesson: { section: { courseId } },
      },
    });

    progressPercentage = totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 100;

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progressPercentage,
        lastAccessAt: new Date(),
        status: progressPercentage === 100 ? "COMPLETED" : "ACTIVE",
      },
    });
  }

  return NextResponse.json({ ok: true, completed: progress.completed, progressPercentage });
}
