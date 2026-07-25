import { prisma } from "../prisma";

export async function verifyMediaRelations(tenantId: string, courseId?: string, lessonId?: string) {
  if (courseId) {
    const course = await prisma.course.findFirst({ where: { id: courseId, tenantId }, select: { id: true } });
    if (!course) throw new Error("COURSE_NOT_FOUND");
  }
  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({ where: { id: lessonId, tenantId }, select: { id: true, section: { select: { courseId: true } } } });
    if (!lesson || (courseId && lesson.section.courseId !== courseId)) throw new Error("LESSON_NOT_FOUND");
  }
}

export async function getMediaUsage(tenantId: string, asset: { publicUrl: string | null; playbackUrl: string | null; embedUrl: string | null }) {
  const urls = [asset.publicUrl, asset.playbackUrl, asset.embedUrl].filter((value): value is string => Boolean(value));
  if (!urls.length) return [];
  const [courses, lessons, tenants, themes] = await Promise.all([
    prisma.course.findMany({ where: { tenantId, thumbnailUrl: { in: urls } }, select: { id: true, title: true } }),
    prisma.lesson.findMany({ where: { tenantId, OR: [{ videoUrl: { in: urls } }, { attachmentUrl: { in: urls } }, { thumbnailUrl: { in: urls } }] }, select: { id: true, title: true } }),
    prisma.tenant.findMany({ where: { id: tenantId, OR: [{ logoUrl: { in: urls } }, { faviconUrl: { in: urls } }] }, select: { id: true, name: true } }),
    prisma.themeSettings.findMany({ where: { tenantId, OR: [{ heroImageUrl: { in: urls } }, { teacherPortraitUrl: { in: urls } }, { loginCoverUrl: { in: urls } }] }, select: { id: true } }),
  ]);
  return [
    ...courses.map((item) => ({ type: "course", id: item.id, label: item.title })),
    ...lessons.map((item) => ({ type: "lesson", id: item.id, label: item.title })),
    ...tenants.map((item) => ({ type: "academy", id: item.id, label: item.name })),
    ...themes.map((item) => ({ type: "branding", id: item.id, label: "الهوية البصرية" })),
  ];
}

export function mediaJson<T extends { fileSizeBytes: bigint }>(asset: T) {
  return { ...asset, fileSizeBytes: asset.fileSizeBytes.toString() };
}