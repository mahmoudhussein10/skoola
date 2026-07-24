import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { getAuthContext } from "../../../../../../lib/auth";
import { isSameOrigin } from "../../../../../../lib/api-auth";

const schema = z.object({
  completed: z.boolean().default(true),
  watchedSeconds: z.number().int().min(0).optional().default(0),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await params;
  const auth = await getAuthContext();
  if (!auth || auth.user.role !== "STUDENT" || !auth.membership) {
    return NextResponse.json({ ok: false, message: "غير مصرح لك" }, { status: 401 });
  }
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.membership.tenantId;
  const studentId = auth.user.id;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  const completed = parsed.success ? parsed.data.completed : true;

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

  // Update or insert VideoProgress
  await prisma.videoProgress.upsert({
    where: { tenantId_studentId_lessonId: { tenantId, studentId, lessonId } },
    update: { completed, updatedAt: new Date() },
    create: { tenantId, studentId, lessonId, completed },
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

  return NextResponse.json({ ok: true, completed, progressPercentage });
}
