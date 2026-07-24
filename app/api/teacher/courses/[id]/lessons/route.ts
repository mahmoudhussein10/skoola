import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";

const lessonSchema = z.object({
  sectionId: z.string().cuid(),
  title: z.string().trim().min(2, "عنوان الدرس يجب أن يكون حرفين على الأقل").max(150),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  content: z.string().trim().max(10000).optional().transform((v) => v || null),
  type: z.enum(["VIDEO", "TEXT", "FILE", "VIDEO_WITH_ATTACHMENT"]).default("VIDEO"),
  videoUrl: z
    .union([z.string().trim().url().refine((url) => /^https?:\/\//i.test(url), "رابط الفيديو يجب أن يبدأ بـ http:// أو https://"), z.literal("")])
    .transform((v) => v || null),
  attachmentUrl: z
    .union([z.string().trim().url().refine((url) => /^https?:\/\//i.test(url), "رابط المرفق يجب أن يبدأ بـ http:// أو https://"), z.literal("")])
    .transform((v) => v || null),
  thumbnailUrl: z
    .union([z.string().trim().url().refine((url) => /^https?:\/\//i.test(url), "رابط الصورة المصغرة يجب أن يبدأ بـ http:// أو https://"), z.literal("")])
    .transform((v) => v || null),
  duration: z.coerce.number().int().min(0).default(0),
  isPreview: z.boolean().default(false),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).default("PUBLISHED"),
});

const updateLessonSchema = lessonSchema.extend({
  lessonId: z.string().cuid(),
});

const reorderSchema = z.object({
  lessonId: z.string().cuid(),
  direction: z.enum(["up", "down"]),
});

const deleteSchema = z.object({
  lessonId: z.string().cuid(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.context.membership.tenantId;
  const parsed = lessonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الدرس غير صالحة" }, { status: 400 });
  }

  const section = await prisma.section.findFirst({
    where: { id: parsed.data.sectionId, courseId, tenantId },
    select: { id: true },
  });
  if (!section) return NextResponse.json({ ok: false, message: "القسم المحدد غير موجود" }, { status: 404 });

  const lastLesson = await prisma.lesson.findFirst({
    where: { sectionId: parsed.data.sectionId, tenantId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (lastLesson?.order ?? 0) + 1;

  const { ipHash } = await requestFingerprint();
  const lesson = await prisma.$transaction(async (tx) => {
    const created = await tx.lesson.create({
      data: {
        tenantId,
        sectionId: parsed.data.sectionId,
        title: parsed.data.title,
        description: parsed.data.description,
        content: parsed.data.content,
        type: parsed.data.type,
        videoUrl: parsed.data.videoUrl,
        attachmentUrl: parsed.data.attachmentUrl,
        thumbnailUrl: parsed.data.thumbnailUrl,
        duration: parsed.data.duration,
        isPreview: parsed.data.isPreview,
        status: parsed.data.status,
        order: nextOrder,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "LESSON_CREATED",
        entityType: "Lesson",
        entityId: created.id,
        after: { title: created.title, sectionId: created.sectionId, order: created.order },
        ipHash,
      },
    });
    return created;
  });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, lesson }, { status: 201 });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.context.membership.tenantId;
  const parsed = updateLessonSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الدرس غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.lesson.findFirst({
    where: { id: parsed.data.lessonId, tenantId },
    include: { section: { select: { courseId: true } } },
  });
  if (!existing || existing.section.courseId !== courseId) {
    return NextResponse.json({ ok: false, message: "الدرس غير موجود" }, { status: 404 });
  }

  const lesson = await prisma.lesson.update({
    where: { id: existing.id },
    data: {
      sectionId: parsed.data.sectionId,
      title: parsed.data.title,
      description: parsed.data.description,
      content: parsed.data.content,
      type: parsed.data.type,
      videoUrl: parsed.data.videoUrl,
      attachmentUrl: parsed.data.attachmentUrl,
      thumbnailUrl: parsed.data.thumbnailUrl,
      duration: parsed.data.duration,
      isPreview: parsed.data.isPreview,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, lesson });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.context.membership.tenantId;
  const parsed = reorderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "طلب الترتيب غير صالح" }, { status: 400 });

  const currentLesson = await prisma.lesson.findFirst({
    where: { id: parsed.data.lessonId, tenantId },
    include: { section: { select: { courseId: true } } },
  });
  if (!currentLesson || currentLesson.section.courseId !== courseId) {
    return NextResponse.json({ ok: false, message: "الدرس غير موجود" }, { status: 404 });
  }

  const siblings = await prisma.lesson.findMany({
    where: { sectionId: currentLesson.sectionId, tenantId },
    orderBy: { order: "asc" },
  });

  const currentIndex = siblings.findIndex((l) => l.id === currentLesson.id);
  const targetIndex = parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return NextResponse.json({ ok: true, message: "الدرس في بداية أو نهاية القائمة بالفعل" });
  }

  const targetLesson = siblings[targetIndex];

  await prisma.$transaction([
    prisma.lesson.update({ where: { id: currentLesson.id }, data: { order: targetLesson.order } }),
    prisma.lesson.update({ where: { id: targetLesson.id }, data: { order: currentLesson.order } }),
  ]);

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: courseId } = await params;
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });

  const tenantId = auth.context.membership.tenantId;
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "معرف الدرس غير صحيح" }, { status: 400 });

  const existing = await prisma.lesson.findFirst({
    where: { id: parsed.data.lessonId, tenantId },
    include: { section: { select: { courseId: true } } },
  });
  if (!existing || existing.section.courseId !== courseId) {
    return NextResponse.json({ ok: false, message: "الدرس غير موجود" }, { status: 404 });
  }

  await prisma.lesson.delete({ where: { id: existing.id } });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true });
}
