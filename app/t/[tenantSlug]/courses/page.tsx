
import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenCheck, GraduationCap, Sparkles } from "lucide-react";
import { prisma } from "../../../../lib/prisma";
import { requirePublicTenant } from "../../../../lib/tenant";
import { getAuthContext } from "../../../../lib/auth";
import { TenantPublicHeader } from "../../../components/tenant-public-header";
import { CourseCatalogClient } from "./course-catalog-client";

export const dynamic = "force-dynamic";

export default async function TenantCourseCatalogPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const [tenant, auth] = await Promise.all([requirePublicTenant(tenantSlug), getAuthContext()]);
  const isLoggedInStudent = auth?.user.role === "STUDENT" && auth.membership?.tenantId === tenant.id;
  const [courses, enrollments] = await Promise.all([
    prisma.course.findMany({
      where: { tenantId: tenant.id, status: "PUBLISHED" },
      include: { _count: { select: { sections: true, enrollments: true } } },
      orderBy: { createdAt: "desc" },
      take: 48,
    }),
    isLoggedInStudent && auth?.user.id
      ? prisma.enrollment.findMany({
          where: {
            tenantId: tenant.id,
            studentId: auth.user.id,
            status: { in: ["ACTIVE", "COMPLETED"] },
          },
          select: { courseId: true },
        })
      : Promise.resolve([] as { courseId: string }[]),
  ]);
  const enrolledCourseIds = enrollments.map((enrollment) => enrollment.courseId);

  const theme = tenant.theme;
  const useSkoolaDefault = !theme || theme.preset === "SKOOLA";
  const style = {
    "--tenant-primary": useSkoolaDefault || !theme?.primaryColor ? "#1565f5" : theme.primaryColor,
    "--tenant-accent": useSkoolaDefault || !theme?.accentColor ? "#7b2ff7" : theme.accentColor,
    "--tenant-primary-foreground": theme?.primaryForeground ?? "#ffffff",
    "--tenant-secondary": useSkoolaDefault || !theme?.secondaryColor ? "#081b3a" : theme.secondaryColor,
    "--tenant-bg": useSkoolaDefault || !theme?.backgroundColor ? "#f8fafc" : theme.backgroundColor,
    "--tenant-surface": useSkoolaDefault || !theme?.surfaceColor ? "#ffffff" : theme.surfaceColor,
    "--tenant-text": useSkoolaDefault || !theme?.textColor ? "#0f172a" : theme.textColor,
    "--tenant-muted": useSkoolaDefault || !theme?.mutedColor ? "#64748b" : theme.mutedColor,
    "--tenant-button": theme?.buttonColor ?? theme?.primaryColor ?? "#1565f5",
    "--tenant-navbar": theme?.navbarColor ?? "#ffffff",
    "--tenant-link": theme?.linkColor ?? theme?.primaryColor ?? "#1565f5",
    "--tenant-hover": theme?.hoverColor ?? "#0f4ed8",
    "--tenant-heading-font": theme?.headingFont ?? theme?.fontFamily ?? "Tajawal",
    "--tenant-button-font": theme?.buttonFont ?? theme?.fontFamily ?? "Tajawal",
    "--tenant-card-style": theme?.cardStyle ?? "ELEVATED",
    "--tenant-button-style": theme?.buttonStyle ?? "GRADIENT",
    "--tenant-radius": (theme?.borderRadius ?? 20) + "px",
    fontFamily: (theme?.bodyFont ?? theme?.fontFamily ?? "Tajawal") + ', "Segoe UI", Tahoma, Arial, sans-serif',
  } as CSSProperties;

  const totalStudents = courses.reduce((sum, course) => sum + course._count.enrollments, 0);
  const courseData = courses.map((course) => ({
    id: course.id,
    slug: course.slug,
    title: course.title,
    subject: course.subject,
    grade: course.grade,
    description: course.description,
    thumbnailUrl: course.thumbnailUrl,
    price: Number(course.price),
    sectionsCount: course._count.sections,
    studentsCount: course._count.enrollments,
  }));

  return (
    <main className="tenantPublic tenantShowcase tenantCourseCatalogPage" style={style}>
      <TenantPublicHeader
        tenant={{
          slug: tenant.slug,
          name: tenant.name,
          subject: tenant.subject,
          logoUrl: tenant.logoUrl,
          platformName: tenant.settings?.platformName,
        }}
        isLoggedInStudent={isLoggedInStudent}
      />

      <section className="catalogHero wrap">
        <div className="catalogHeroCopy">
          <span className="tenantEyebrow"><Sparkles size={16} /> تعلّم بوضوح، وتقدّم بثقة</span>
          <h1>اختار الكورس اللي يناسب هدفك، وابدأ من أول خطوة.</h1>
          <p>{tenant.settings?.description ?? tenant.description ?? "محتوى مرتب وشرح واضح يساعدك تفهم وتراجع وتتابع تقدمك في مكان واحد."}</p>
          <div className="catalogHeroActions">
            <a className="btn tenantPrimary" href="#catalog-grid">شوف الكورسات <ArrowLeft size={18} /></a>
            {isLoggedInStudent ? <Link className="tenantTextButton" href="/dashboard">ارجع للوحة التعلم</Link> : <Link className="tenantTextButton" href={"/t/" + tenant.slug + "/register"}>أنشئ حساب طالب</Link>}
          </div>
          <div className="catalogHeroMetrics">
            <span><b>{courses.length.toLocaleString("en-US")}</b><small>كورس منشور</small></span>
            <span><b>{totalStudents.toLocaleString("en-US")}</b><small>اشتراك تعليمي</small></span>
            <span><b>24/7</b><small>تعلّم في أي وقت</small></span>
          </div>
        </div>
        <div className="catalogHeroVisual" aria-hidden="true">
          <span className="catalogOrb orbOne" />
          <span className="catalogOrb orbTwo" />
          <div className="catalogHeroPanel">
            <div className="catalogHeroPanelTop"><BookOpenCheck size={22} /><span>مسار تعلمك يبدأ هنا</span></div>
            <div className="catalogHeroPanelIllustration"><GraduationCap size={78} /><i /><i /><i /></div>
            <div className="catalogHeroPanelBottom"><span>محتوى منظم</span><span>متابعة واضحة</span><span>تجربة آمنة</span></div>
          </div>
        </div>
      </section>

      <section id="catalog-grid" className="catalogSection wrap">
        <div className="tenantSectionHead">
          <div><span>المكتبة التعليمية</span><h2>كل الكورسات في مكان واحد</h2><p>ابحث، فلتر، ثم افتح تفاصيل الكورس قبل الاشتراك.</p></div>
          <a className="catalogBackLink" href={"/t/" + tenant.slug}><ArrowLeft size={17} /> الرئيسية</a>
        </div>
        <CourseCatalogClient
          tenantSlug={tenant.slug}
          courses={courseData}
          isLoggedInStudent={isLoggedInStudent}
          enrolledCourseIds={enrolledCourseIds}
        />
      </section>
    </main>
  );
}
