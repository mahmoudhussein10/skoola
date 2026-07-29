import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isSameOrigin } from "../../../../lib/api-auth";
import { createSession, requestFingerprint } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { uploadStorageFile, deleteStorageFile } from "../../../../lib/bunny/storage";
import { createBunnyStoragePath } from "../../../../lib/media/paths";
import { processImage } from "../../../../lib/media/image";
import { extensionForMime, resolveVerifiedMimeType, validateDescriptor } from "../../../../lib/media/validation";
import { calculateSubscriptionPrice, getSubscriptionPolicy, trialWindow } from "../../../../lib/subscriptions";

export const runtime = "nodejs";

const gradeValues = ["FIRST_PREPARATORY", "SECOND_PREPARATORY", "THIRD_PREPARATORY", "FIRST_SECONDARY", "SECOND_SECONDARY", "THIRD_SECONDARY"] as const;
const signupSchema = z.object({
  fullName: z.string().trim().min(2, "اكتب اسم المدرس بالكامل").max(100),
  username: z.string().trim().toLowerCase().min(3, "اسم المستخدم لا يقل عن 3 أحرف").max(40).regex(/^[a-z0-9._-]+$/, "اسم المستخدم يقبل حروفًا إنجليزية وأرقامًا فقط"),
  email: z.string().trim().toLowerCase().email("اكتب بريدًا إلكترونيًا صحيحًا").max(160),
  phone: z.string().trim().regex(/^01[0125]\d{8}$/, "اكتب رقم هاتف مصريًا صحيحًا"),
  platformName: z.string().trim().min(2, "اكتب اسم المنصة").max(120),
  slug: z.string().trim().toLowerCase().min(3, "رابط المنصة لا يقل عن 3 أحرف").max(50).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "الرابط يقبل حروفًا إنجليزية صغيرة وأرقامًا وشرطات فقط"),
  subject: z.string().trim().min(2, "اكتب المادة أو التخصص").max(80),
  password: z.string().min(10, "كلمة المرور لا تقل عن 10 أحرف").max(128),
  confirmPassword: z.string().min(1),
  acceptedTerms: z.literal("true", { error: "يجب الموافقة على شروط الاستخدام" }),
  website: z.string().max(0).optional().default(""),
  grades: z.array(z.enum(gradeValues)).min(1, "اختر صفًا دراسيًا واحدًا على الأقل"),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "كلمتا المرور غير متطابقتين" });

const reservedSlugs = new Set(["admin", "api", "course", "dashboard", "login", "notifications", "register", "student", "super-admin", "teacher", "teacher-register"]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ ok: false, message: "طلب غير صالح" }, { status: 403 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ ok: false, message: "تعذر قراءة بيانات التسجيل" }, { status: 400 }); }

  const parsed = signupSchema.safeParse({
    fullName: form.get("fullName"), username: form.get("username"), email: form.get("email"), phone: form.get("phone"),
    platformName: form.get("platformName"), slug: form.get("slug"), subject: form.get("subject"),
    password: form.get("password"), confirmPassword: form.get("confirmPassword"), acceptedTerms: form.get("acceptedTerms"),
    website: form.get("website") || "", grades: form.getAll("grades"),
  });
  if (!parsed.success) return NextResponse.json({ ok: false, message: parsed.error.issues[0]?.message || "راجع بيانات التسجيل" }, { status: 400 });
  const data = parsed.data;
  if (reservedSlugs.has(data.slug)) return NextResponse.json({ ok: false, message: "رابط المنصة محجوز، اختر رابطًا آخر" }, { status: 409 });

  const { ipHash } = await requestFingerprint();
  const recentAttempts = await prisma.loginAttempt.count({ where: { ipHash, identifier: { startsWith: "teacher-signup:" }, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } } });
  if (recentAttempts >= 5) return NextResponse.json({ ok: false, message: "تم تجاوز عدد المحاولات المسموح. حاول بعد ساعة." }, { status: 429 });
  const attempt = await prisma.loginAttempt.create({ data: { identifier: `teacher-signup:${data.email}`, ipHash, successful: false } });

  const duplicate = await prisma.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.email }, { phone: data.phone }] }, select: { username: true, email: true, phone: true } });
  if (duplicate) {
    const message = duplicate.phone === data.phone ? "رقم الهاتف مسجل بالفعل" : duplicate.email === data.email ? "البريد الإلكتروني مسجل بالفعل" : "اسم المستخدم مستخدم بالفعل";
    return NextResponse.json({ ok: false, message }, { status: 409 });
  }
  if (await prisma.tenant.findUnique({ where: { slug: data.slug }, select: { id: true } })) return NextResponse.json({ ok: false, message: "رابط المنصة مستخدم بالفعل" }, { status: 409 });

  const photo = form.get("photo");
  let processedPhoto: Awaited<ReturnType<typeof processImage>> | null = null;
  let originalPhoto: File | null = null;
  try {
    if (photo instanceof File && photo.size > 0) {
      originalPhoto = photo;
      let descriptor = validateDescriptor({ fileName: photo.name, mimeType: photo.type.toLowerCase(), fileSize: photo.size, resourceType: "profile_image" });
      const bytes = new Uint8Array(await photo.arrayBuffer());
      const verifiedMime = resolveVerifiedMimeType(bytes, descriptor.mimeType);
      if (verifiedMime !== descriptor.mimeType) {
        const extension = extensionForMime[verifiedMime];
        if (!extension) throw new Error("UNSUPPORTED_FILE");
        descriptor = { ...descriptor, mimeType: verifiedMime, extension };
      }
      processedPhoto = await processImage(bytes, descriptor.mimeType, "profile_image");
    }
  } catch {
    return NextResponse.json({ ok: false, message: "الصورة غير صالحة. ارفع صورة JPG أو PNG أو WebP بحجم لا يتجاوز 8MB." }, { status: 400 });
  }

  const passwordHash = await hash(data.password, 12);
  const subscriptionPolicy = await getSubscriptionPolicy();
  let result: { tenant: { id: string; slug: string }; teacher: { id: string } };
  try {
    result = await prisma.$transaction(async (tx) => {
      const teacher = await tx.user.create({ data: { fullName: data.fullName, username: data.username, email: data.email, phone: data.phone, passwordHash, role: "TEACHER_OWNER", status: "ACTIVE" }, select: { id: true } });
      const tenant = await tx.tenant.create({ data: { name: data.platformName, slug: data.slug, status: "TRIAL", ownerId: teacher.id, subject: data.subject, onboardingStep: 1, onboardingDone: false }, select: { id: true, slug: true } });
      await tx.tenantMember.create({ data: { tenantId: tenant.id, userId: teacher.id, role: "TEACHER_OWNER", status: "ACTIVE" } });
      await tx.themeSettings.create({ data: { tenantId: tenant.id } });
      await tx.tenantSettings.create({ data: { tenantId: tenant.id, platformName: data.platformName, publicPageLive: false, supportedGrades: data.grades } });
      await tx.teacherBillingSettings.create({ data: { tenantId: tenant.id } });
      const starterPlan = await tx.subscriptionPlan.findUniqueOrThrow({ where: { code: "STARTER" } });
      const trial = trialWindow(new Date(), subscriptionPolicy.trialHours);
      const pricing = calculateSubscriptionPrice(Number(starterPlan.monthlyPrice), "MONTHLY", subscriptionPolicy.pricing);
      const subscription = await tx.tenantSubscription.create({ data: { tenantId: tenant.id, planId: starterPlan.id, status: "TRIALING", billingCycle: "MONTHLY", baseMonthlyPrice: starterPlan.monthlyPrice!, billedAmount: pricing.amountEgp, discountPercent: 0, activeStudentLimit: starterPlan.activeStudentLimit, storageLimitGb: starterPlan.storageLimitGb, ...trial } });
      await tx.subscriptionEvent.create({ data: { tenantId: tenant.id, subscriptionId: subscription.id, actorUserId: teacher.id, type: "TRIAL_STARTED", payload: { trialHours: subscriptionPolicy.trialHours, planCode: starterPlan.code } } });
      await tx.auditLog.create({ data: { tenantId: tenant.id, actorId: teacher.id, action: "PUBLIC_TEACHER_SIGNUP", entityType: "Tenant", entityId: tenant.id, metadata: { platformName: data.platformName, slug: data.slug, subject: data.subject, grades: data.grades }, ipHash } });
      return { tenant, teacher };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ ok: false, message: "البريد أو الهاتف أو اسم المستخدم أو رابط المنصة مستخدم بالفعل" }, { status: 409 });
    console.error("Public teacher signup failed:", error);
    return NextResponse.json({ ok: false, message: "تعذر إنشاء المنصة الآن. حاول مرة أخرى." }, { status: 500 });
  }

  let warning = "";
  let storagePath: string | undefined;
  if (processedPhoto && originalPhoto) {
    try {
      storagePath = createBunnyStoragePath(result.tenant.id, "profile_image", processedPhoto.extension);
      const publicUrl = await uploadStorageFile(storagePath, processedPhoto.bytes);
      await prisma.$transaction([
        prisma.user.update({ where: { id: result.teacher.id }, data: { avatarUrl: publicUrl } }),
        prisma.themeSettings.update({ where: { tenantId: result.tenant.id }, data: { teacherPortraitUrl: publicUrl } }),
        prisma.mediaAsset.create({ data: {
          tenantId: result.tenant.id, uploadedById: result.teacher.id, resourceType: "profile_image", provider: "BUNNY_STORAGE",
          originalFileName: originalPhoto.name, storedFileName: storagePath.split("/").pop(), mimeType: processedPhoto.mimeType,
          fileExtension: processedPhoto.extension, fileSizeBytes: BigInt(processedPhoto.bytes.byteLength), title: `صورة ${data.fullName}`,
          altText: `صورة المدرس ${data.fullName}`, bunnyStoragePath: storagePath, publicUrl, uploadStatus: "COMPLETED",
          processingStatus: "READY", uploadProgress: 100, width: processedPhoto.width, height: processedPhoto.height,
          metadata: { originalSizeBytes: originalPhoto.size, optimized: true, source: "public_teacher_signup" },
        } }),
      ]);
    } catch (error) {
      if (storagePath) await deleteStorageFile(storagePath).catch(() => undefined);
      console.error("Teacher signup photo upload failed:", error);
      warning = "تم إنشاء المنصة، لكن تعذر رفع الصورة. يمكنك رفعها لاحقًا من صور الأكاديمية.";
    }
  }

  await prisma.loginAttempt.update({ where: { id: attempt.id }, data: { successful: true, userId: result.teacher.id } }).catch(() => undefined);
  let redirectTo = "/teacher/onboarding";
  try { await createSession(result.teacher.id, true, result.tenant.id); }
  catch (error) {
    console.error("Teacher signup session failed:", error);
    redirectTo = "/login?role=teacher";
    warning = warning || "تم إنشاء المنصة. سجّل الدخول للمتابعة.";
  }
  return NextResponse.json({ ok: true, redirectTo, warning }, { status: 201 });
}
