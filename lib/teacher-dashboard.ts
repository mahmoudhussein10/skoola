import { prisma } from "./prisma";

export type TeacherDashboardAttention = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel: string;
  tone: "urgent" | "warning" | "info";
};

export type TeacherDashboardData = {
  welcomeMessage: string;
  today: {
    newStudents: number;
    lessonViews: number;
    examAttempts: number;
    publishedCourses: number;
  };
  totals: {
    students: number;
    courses: number;
    lessons: number;
    exams: number;
  };
  attention: TeacherDashboardAttention[];
  activities: Array<{
    id: string;
    action: string;
    actorName: string;
    relativeTime: string;
  }>;
};

function startOfToday(now: Date) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function formatDashboardRelativeTime(date: Date, now = new Date()) {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (elapsedSeconds < 60) return "الآن";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `منذ ${minutes.toLocaleString("ar-EG")} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours.toLocaleString("ar-EG")} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days.toLocaleString("ar-EG")} يوم`;
  return date.toLocaleDateString("ar-EG", { day: "numeric", month: "short" });
}

export async function getTeacherDashboardData(tenantId: string, now = new Date()): Promise<TeacherDashboardData> {
  const today = startOfToday(now);
  const [tenantState, courseStats, totalStudents, activityLogs] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        logoUrl: true,
        _count: {
          select: {
            members: { where: { role: "STUDENT", status: "ACTIVE", createdAt: { gte: today }, user: { deletedAt: null } } },
            courses: { where: { status: "PUBLISHED" } },
            lessons: true,
            exams: true,
            payments: { where: { status: "PENDING" } },
            videoProgress: { where: { updatedAt: { gte: today }, student: { deletedAt: null } } },
            examAttempts: { where: { startedAt: { gte: today }, student: { deletedAt: null } } },
          },
        },
      },
    }),
    prisma.course.aggregate({
      where: { tenantId },
      _count: { _all: true, thumbnailUrl: true },
    }),
    prisma.tenantMember.count({
      where: { tenantId, role: "STUDENT", status: "ACTIVE", user: { deletedAt: null } },
    }),
    prisma.activityLog.findMany({
      where: { tenantId },
      select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  if (!tenantState) throw new Error("TENANT_NOT_FOUND");

  const totalCourses = courseStats._count._all;
  const coursesWithoutImage = totalCourses - courseStats._count.thumbnailUrl;
  const todayEngagement = tenantState._count.videoProgress + tenantState._count.examAttempts;
  const welcomeMessage = totalCourses === 0 || totalStudents === 0
    ? "ابدأ في تجهيز أكاديميتك لاستقبال أول طالب."
    : todayEngagement > 0
      ? "استمر، طلابك يتفاعلون مع المحتوى اليوم."
      : "منصتك تنمو بشكل رائع؛ راجع ما يحتاج اهتمامك اليوم.";

  const attention: TeacherDashboardAttention[] = [];
  if (tenantState._count.payments > 0) attention.push({ id: "payments", title: `${tenantState._count.payments.toLocaleString("ar-EG")} طلب دفع بانتظارك`, description: "راجع التحويلات وفعّل اشتراكات الطلاب دون تأخير.", href: "/teacher/payments", actionLabel: "مراجعة الطلبات", tone: "urgent" });
  if (tenantState._count.courses === 0) attention.push({ id: "published-course", title: "لا يوجد كورس منشور", description: "انشر كورسًا ليتمكن الطلاب من رؤيته والاشتراك فيه.", href: "/teacher/courses", actionLabel: "إدارة الكورسات", tone: "urgent" });
  if (!tenantState.logoUrl) attention.push({ id: "logo", title: "أضف شعار الأكاديمية", description: "الشعار الواضح يجعل صفحتك أكثر احترافية وثقة.", href: "/teacher/branding", actionLabel: "رفع الشعار", tone: "warning" });
  if (coursesWithoutImage > 0) attention.push({ id: "course-images", title: `${coursesWithoutImage.toLocaleString("ar-EG")} كورس بدون صورة`, description: "أضف صورًا واضحة للكورسات لتحسين ظهورها للطلاب.", href: "/teacher/courses", actionLabel: "إضافة الصور", tone: "warning" });
  if (tenantState._count.lessons === 0) attention.push({ id: "lessons", title: "لم تضف أي درس بعد", description: "أضف أول درس داخل أحد كورساتك حتى يبدأ الطلاب التعلّم.", href: "/teacher/content/create?mode=lesson", actionLabel: "إضافة درس", tone: "info" });
  if (tenantState._count.exams === 0) attention.push({ id: "exams", title: "لا توجد امتحانات بعد", description: "أنشئ امتحانًا بسيطًا لقياس فهم الطلاب للمحتوى.", href: "/teacher/content/create?mode=exam", actionLabel: "إنشاء امتحان", tone: "info" });
  if (totalStudents === 0) attention.push({ id: "students", title: "لم ينضم أي طالب بعد", description: "شارك رابط أكاديميتك وابدأ باستقبال أول طالب.", href: "/teacher/students", actionLabel: "دعوة الطلاب", tone: "info" });

  return {
    welcomeMessage,
    today: {
      newStudents: tenantState._count.members,
      lessonViews: tenantState._count.videoProgress,
      examAttempts: tenantState._count.examAttempts,
      publishedCourses: tenantState._count.courses,
    },
    totals: { students: totalStudents, courses: totalCourses, lessons: tenantState._count.lessons, exams: tenantState._count.exams },
    attention: attention.slice(0, 5),
    activities: activityLogs.map((item) => ({
      id: item.id,
      action: item.action,
      actorName: item.actor?.fullName ?? "النظام",
      relativeTime: formatDashboardRelativeTime(item.createdAt, now),
    })),
  };
}
