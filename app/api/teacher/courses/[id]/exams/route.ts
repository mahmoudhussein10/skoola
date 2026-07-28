import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";
import { notifyExamPublished } from "../../../../../../lib/notifications/events";
import { isBunnyStorageUrl } from "../../../../../../lib/media/trusted-url";

const stringOrNull = z.union([z.string(), z.null(), z.undefined()]);

const questionSchema = z.object({
  text: stringOrNull.transform((v) => (v ? String(v).trim() : "")),
  imageUrl: stringOrNull.transform((v) => (v ? String(v).trim() : null)).refine(isBunnyStorageUrl, "ارفع صورة السؤال من جهازك بدل إدخال رابط مباشر"),
  type: z.enum(["MCQ", "TRUE_FALSE", "ESSAY"]).default("MCQ"),
  options: z.array(stringOrNull).transform((opts) => opts.map((o) => (o ? String(o).trim() : "")).filter(Boolean)),
  correctAnswer: stringOrNull.transform((v) => (v ? String(v).trim() : "")),
  explanation: stringOrNull.transform((v) => (v ? String(v).trim() : null)),
  points: z.coerce.number().min(0.5).default(1),
}).refine(
  (q) => (q.text.length >= 1 || Boolean(q.imageUrl && q.imageUrl.length > 3)),
  { message: "يرجى كتابة نص السؤال أو رفع صورة للسؤال من جهازك" }
).refine(
  (q) => q.type === "ESSAY" || q.options.length >= 2,
  { message: "السؤال يتطلب خيارين غير فارغين على الأقل" }
).transform((q) => {
  const text = q.text || "سؤال مصور (انظر الصورة)";
  const options = q.type === "ESSAY" ? [] : q.options;
  const correctAnswer = q.type === "ESSAY" ? "" : (options.includes(q.correctAnswer) ? q.correctAnswer : (options[0] || ""));
  return { ...q, text, options, correctAnswer };
});

const examSchema = z.object({
  sectionId: stringOrNull.transform((v) => (v && String(v).trim().length > 0 ? String(v).trim() : null)),
  title: stringOrNull.transform((v) => (v ? String(v).trim() : "")).refine((t) => t.length >= 3, "عنوان الامتحان يجب أن يكون 3 أحرف على الأقل"),
  description: stringOrNull.transform((v) => (v ? String(v).trim() : null)),
  durationMinutes: z.coerce.number().int().min(1, "المدة يجب أن تكون دقيقة واحدة على الأقل").max(300).default(30),
  passingScore: z.coerce.number().min(0).max(100).default(50),
  maxAttempts: z.coerce.number().optional().transform(() => 1),
  shuffleQuestions: z.boolean().default(false),
  shuffleOptions: z.boolean().default(false),
  showResultImmediately: z.boolean().default(true),
  showAnswersAfterSubmit: z.boolean().default(false),
  startDate: stringOrNull.transform((v) => (v ? new Date(v) : null)),
  endDate: stringOrNull.transform((v) => (v ? new Date(v) : null)),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).default("PUBLISHED"),
  questions: z.array(questionSchema).min(1, "يجب إضافة سؤال واحد على الأقل داخل الامتحان"),
});

const updateExamSchema = examSchema.extend({
  examId: z.string().cuid(),
});

const reorderSchema = z.object({
  examId: z.string().cuid(),
  direction: z.enum(["up", "down"]),
});

const deleteSchema = z.object({
  examId: z.string().cuid(),
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
  const course = await prisma.course.findFirst({
    where: { id: courseId, tenantId },
    select: { id: true, title: true },
  });
  if (!course) return NextResponse.json({ ok: false, message: "الكورس غير موجود" }, { status: 404 });

  const parsed = examSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات الامتحان غير صالحة" }, { status: 400 });
  }

  if (parsed.data.sectionId) {
    const sec = await prisma.section.findFirst({
      where: { id: parsed.data.sectionId, courseId, tenantId },
      select: { id: true, title: true },
    });
    if (!sec) return NextResponse.json({ ok: false, message: "القسم المحدد غير موجود" }, { status: 404 });
  }

  const lastExam = await prisma.exam.findFirst({
    where: { courseId, tenantId, sectionId: parsed.data.sectionId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (lastExam?.order ?? 0) + 1;

  const { ipHash } = await requestFingerprint();
  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        tenantId,
        courseId,
        sectionId: parsed.data.sectionId,
        title: parsed.data.title,
        description: parsed.data.description,
        durationMinutes: parsed.data.durationMinutes,
        passingScore: parsed.data.passingScore,
        maxAttempts: parsed.data.maxAttempts,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions,
        showResultImmediately: parsed.data.showResultImmediately,
        showAnswersAfterSubmit: parsed.data.showAnswersAfterSubmit,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
        order: nextOrder,
      },
    });

    for (let i = 0; i < parsed.data.questions.length; i++) {
      const q = parsed.data.questions[i];
      await tx.question.create({
        data: {
          tenantId,
          examId: created.id,
          text: q.text,
          imageUrl: q.imageUrl,
          type: q.type,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points,
          order: i + 1,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "EXAM_CREATED",
        entityType: "Exam",
        entityId: created.id,
        after: { title: created.title, questionsCount: parsed.data.questions.length },
        ipHash,
      },
    });

    return created;
  });

  const hydratedExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id }, include: { questions: { orderBy: { order: "asc" } } } });

  if (hydratedExam.status === "PUBLISHED") await notifyExamPublished({ tenantId, courseId, courseTitle: course.title, examId: hydratedExam.id, examTitle: hydratedExam.title, version: hydratedExam.publishVersion }).catch(() => undefined);

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher/exams");
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, exam: hydratedExam }, { status: 201 });
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
  const parsed = updateExamSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات التعديل غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.exam.findFirst({
    where: { id: parsed.data.examId, courseId, tenantId },
  });
  if (!existing) return NextResponse.json({ ok: false, message: "الامتحان غير موجود" }, { status: 404 });

  const exam = await prisma.$transaction(async (tx) => {
    const updated = await tx.exam.update({
      where: { id: existing.id },
      data: {
        sectionId: parsed.data.sectionId,
        title: parsed.data.title,
        description: parsed.data.description,
        durationMinutes: parsed.data.durationMinutes,
        passingScore: parsed.data.passingScore,
        maxAttempts: parsed.data.maxAttempts,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions,
        showResultImmediately: parsed.data.showResultImmediately,
        showAnswersAfterSubmit: parsed.data.showAnswersAfterSubmit,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        status: parsed.data.status,
        ...(existing.status !== "PUBLISHED" && parsed.data.status === "PUBLISHED" ? { publishVersion: { increment: 1 } } : {}),
      },
    });

    // Delete existing questions and replace with updated set
    await tx.question.deleteMany({ where: { examId: existing.id, tenantId } });

    for (let i = 0; i < parsed.data.questions.length; i++) {
      const q = parsed.data.questions[i];
      await tx.question.create({
        data: {
          tenantId,
          examId: existing.id,
          text: q.text,
          imageUrl: q.imageUrl,
          type: q.type,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          points: q.points,
          order: i + 1,
        },
      });
    }

    return updated;
  });

  const hydratedExam = await prisma.exam.findUniqueOrThrow({ where: { id: exam.id }, include: { questions: { orderBy: { order: "asc" } } } });

  if (existing.status !== "PUBLISHED" && hydratedExam.status === "PUBLISHED") await notifyExamPublished({ tenantId, courseId, courseTitle: (await prisma.course.findUniqueOrThrow({ where: { id: courseId }, select: { title: true } })).title, examId: hydratedExam.id, examTitle: hydratedExam.title, version: hydratedExam.publishVersion }).catch(() => undefined);

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher/exams");
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, exam: hydratedExam });
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

  const currentExam = await prisma.exam.findFirst({
    where: { id: parsed.data.examId, courseId, tenantId },
  });
  if (!currentExam) return NextResponse.json({ ok: false, message: "الامتحان غير موجود" }, { status: 404 });

  const siblings = await prisma.exam.findMany({
    where: { courseId, tenantId, sectionId: currentExam.sectionId },
    orderBy: { order: "asc" },
  });

  const currentIndex = siblings.findIndex((e) => e.id === currentExam.id);
  const targetIndex = parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;

  if (targetIndex < 0 || targetIndex >= siblings.length) {
    return NextResponse.json({ ok: true, message: "الامتحان في الترتيب المحدد بالفعل" });
  }

  const targetExam = siblings[targetIndex];

  await prisma.$transaction([
    prisma.exam.update({ where: { id: currentExam.id }, data: { order: targetExam.order } }),
    prisma.exam.update({ where: { id: targetExam.id }, data: { order: currentExam.order } }),
  ]);

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher/exams");
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
  if (!parsed.success) return NextResponse.json({ ok: false, message: "معرف الامتحان غير صحيح" }, { status: 400 });

  const existing = await prisma.exam.findFirst({
    where: { id: parsed.data.examId, courseId, tenantId },
  });
  if (!existing) return NextResponse.json({ ok: false, message: "الامتحان غير موجود" }, { status: 404 });

  await prisma.exam.delete({ where: { id: existing.id } });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath("/teacher/exams");
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true });
}
