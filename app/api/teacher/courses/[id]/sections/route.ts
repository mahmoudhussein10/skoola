import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../../../lib/api-auth";
import { requestFingerprint } from "../../../../../../lib/auth";

const createSectionSchema = z.object({
  title: z.string().trim().min(2, "عنوان القسم يجب أن يكون حرفين على الأقل").max(120),
  description: z.string().trim().max(1000).optional().transform((val) => val || null),
});

const updateSectionSchema = createSectionSchema.extend({
  sectionId: z.string().cuid(),
  status: z.enum(["DRAFT", "PUBLISHED", "HIDDEN"]).default("PUBLISHED"),
});

const reorderSchema = z.object({
  sectionId: z.string().cuid(),
  direction: z.enum(["up", "down"]),
});

const deleteSchema = z.object({
  sectionId: z.string().cuid(),
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
    select: { id: true },
  });
  if (!course) return NextResponse.json({ ok: false, message: "الكورس غير موجود" }, { status: 404 });

  const parsed = createSectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات القسم غير صالحة" }, { status: 400 });
  }

  const lastSection = await prisma.section.findFirst({
    where: { courseId, tenantId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const nextOrder = (lastSection?.order ?? 0) + 1;

  const { ipHash } = await requestFingerprint();
  const section = await prisma.$transaction(async (tx) => {
    const created = await tx.section.create({
      data: {
        tenantId,
        courseId,
        title: parsed.data.title,
        description: parsed.data.description,
        order: nextOrder,
        status: "PUBLISHED",
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        actorId: auth.context.user.id,
        action: "SECTION_CREATED",
        entityType: "Section",
        entityId: created.id,
        after: { title: created.title, order: created.order },
        ipHash,
      },
    });
    return created;
  });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, section }, { status: 201 });
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
  const parsed = updateSectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message ?? "بيانات التعديل غير صالحة" }, { status: 400 });
  }

  const existing = await prisma.section.findFirst({
    where: { id: parsed.data.sectionId, courseId, tenantId },
  });
  if (!existing) return NextResponse.json({ ok: false, message: "القسم غير موجود" }, { status: 404 });

  const section = await prisma.section.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, section });
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
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "طلب الترتيب غير صالح" }, { status: 400 });
  }

  const sections = await prisma.section.findMany({
    where: { courseId, tenantId },
    orderBy: { order: "asc" },
  });

  const currentIndex = sections.findIndex((s) => s.id === parsed.data.sectionId);
  if (currentIndex === -1) return NextResponse.json({ ok: false, message: "القسم غير موجود" }, { status: 404 });

  const targetIndex = parsed.data.direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= sections.length) {
    return NextResponse.json({ ok: true, message: "القسم في أول أو آخر الترتيب بالفعل" });
  }

  const currentSection = sections[currentIndex];
  const targetSection = sections[targetIndex];

  await prisma.$transaction([
    prisma.section.update({
      where: { id: currentSection.id },
      data: { order: targetSection.order },
    }),
    prisma.section.update({
      where: { id: targetSection.id },
      data: { order: currentSection.order },
    }),
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
  if (!parsed.success) return NextResponse.json({ ok: false, message: "معرف القسم غير صحيح" }, { status: 400 });

  const existing = await prisma.section.findFirst({
    where: { id: parsed.data.sectionId, courseId, tenantId },
  });
  if (!existing) return NextResponse.json({ ok: false, message: "القسم غير موجود" }, { status: 404 });

  await prisma.section.delete({ where: { id: existing.id } });

  revalidatePath(`/teacher/courses/${courseId}`);
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true });
}
