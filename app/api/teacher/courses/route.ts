import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "../../../../lib/prisma";
import { authorizeTenant, isSameOrigin } from "../../../../lib/api-auth";
import { requestFingerprint } from "../../../../lib/auth";
import { isBunnyStorageUrl } from "../../../../lib/media/trusted-url";

const schema = z.object({ title: z.string().trim().min(3).max(120), slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().min(10).max(2000), grade: z.enum(["FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"]), subject: z.string().trim().min(2).max(80), price: z.coerce.number().min(0).max(100000), thumbnailUrl: z.union([z.string().trim().url().refine(isBunnyStorageUrl, "ارفع غلاف الكورس من خلال Bunny"), z.literal("")]).transform((value) => value || null), status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED") });
const statusSchema = z.object({ courseId: z.string().cuid(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });
const updateSchema = schema.extend({ courseId: z.string().cuid(), status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) });

export async function POST(request: Request) {
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issues = parsed.error.issues;
    let msg = "تحقق من بيانات الكورس";
    if (issues.some((i) => i.path.includes("slug"))) {
      msg = "الرابط المختصر يجب أن يتكون من حروف إنجليزية صغيرة وأرقام فقط بدون روابط (مثال: unit-1)";
    } else if (issues.some((i) => i.path.includes("title"))) {
      msg = "عنوان الكورس يجب أن يكون بين 3 و 120 حرفًا";
    } else if (issues.some((i) => i.path.includes("thumbnailUrl"))) {
      msg = "ارفع غلاف الكورس من جهازك عبر Bunny بدل إدخال رابط مباشر";
    } else if (issues.some((i) => i.path.includes("description"))) {
      msg = "وصف الكورس يجب أن يكون 10 أحرف على الأقل";
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 400 });
  }
  const tenantId = auth.context.membership.tenantId;
  const exists = await prisma.course.findUnique({ where: { tenantId_slug: { tenantId, slug: parsed.data.slug } }, select: { id: true } });
  if (exists) return NextResponse.json({ ok: false, message: "رابط الكورس مستخدم داخل منصتك" }, { status: 409 });
  const { ipHash } = await requestFingerprint();
  const course = await prisma.$transaction(async (tx) => {
    const created = await tx.course.create({ data: { tenantId, createdById: auth.context.user.id, ...parsed.data } });
    if (created.thumbnailUrl) await tx.mediaAsset.updateMany({ where: { tenantId, publicUrl: created.thumbnailUrl, courseId: null }, data: { courseId: created.id } });
    if (created.status === "PUBLISHED") await tx.tenantSettings.updateMany({ where: { tenantId }, data: { publicPageLive: true } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "COURSE_CREATED", entityType: "Course", entityId: created.id, after: { title: created.title, slug: created.slug }, ipHash } });
    await tx.activityLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "إنشاء كورس", entityType: "Course", entityId: created.id } });
    return created;
  });
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, course }, { status: 201 });
}

export async function PUT(request: Request) {
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = statusSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "حالة الكورس غير صالحة" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  const existing = await prisma.course.findFirst({ where: { id: parsed.data.courseId, tenantId }, select: { id: true, status: true } });
  if (!existing) return NextResponse.json({ ok: false, message: "الكورس غير موجود" }, { status: 404 });
  const { ipHash } = await requestFingerprint();
  const course = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id: existing.id }, data: { status: parsed.data.status } });
    if (updated.status === "PUBLISHED") await tx.tenantSettings.updateMany({ where: { tenantId }, data: { publicPageLive: true } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "COURSE_STATUS_UPDATED", entityType: "Course", entityId: updated.id, before: { status: existing.status }, after: { status: updated.status }, ipHash } });
    return updated;
  });
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  revalidatePath("/teacher/courses");
  revalidatePath("/dashboard");
  return NextResponse.json({ ok: true, course });
}

export async function PATCH(request: Request) {
  const auth = await authorizeTenant("courses.manage");
  if (!auth.ok) return auth.response;
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, message: "راجع بيانات الكورس؛ العنوان والوصف والرابط مطلوبة" }, { status: 400 });
  const tenantId = auth.context.membership.tenantId;
  const existing = await prisma.course.findFirst({ where: { id: parsed.data.courseId, tenantId } });
  if (!existing) return NextResponse.json({ ok: false, message: "الكورس غير موجود" }, { status: 404 });
  const slugOwner = await prisma.course.findFirst({ where: { tenantId, slug: parsed.data.slug, id: { not: existing.id } }, select: { id: true } });
  if (slugOwner) return NextResponse.json({ ok: false, message: "الرابط المختصر مستخدم في كورس آخر" }, { status: 409 });
  const { courseId, ...data } = parsed.data;
  const { ipHash } = await requestFingerprint();
  const course = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({ where: { id: courseId }, data });
    if (updated.status === "PUBLISHED") await tx.tenantSettings.updateMany({ where: { tenantId }, data: { publicPageLive: true } });
    await tx.auditLog.create({ data: { tenantId, actorId: auth.context.user.id, action: "COURSE_UPDATED", entityType: "Course", entityId: updated.id, before: { title: existing.title, slug: existing.slug, status: existing.status, price: existing.price }, after: { title: updated.title, slug: updated.slug, status: updated.status, price: updated.price }, ipHash } });
    return updated;
  });
  revalidatePath("/teacher/courses");
  revalidatePath("/dashboard");
  revalidatePath(`/t/${auth.context.membership.tenant.slug}`);
  return NextResponse.json({ ok: true, course });
}
