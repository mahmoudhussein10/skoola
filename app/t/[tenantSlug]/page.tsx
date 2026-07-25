import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowLeft, BookOpenCheck, CheckCircle2, GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { requirePublicTenant } from "../../../lib/tenant";
import { getAuthContext } from "../../../lib/auth";
import { CourseThumbnail } from "../../course-thumbnail";
import { TenantPublicHeader } from "../../components/tenant-public-header";

export const dynamic = "force-dynamic";

const gradeLabels = { FIRST_SECONDARY: "الأول الثانوي", SECOND_SECONDARY: "الثاني الثانوي", THIRD_SECONDARY: "الثالث الثانوي" } as const;

export default async function TenantPublicPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const [tenant, auth] = await Promise.all([requirePublicTenant(tenantSlug), getAuthContext()]);
  const isLoggedInStudent = auth?.user.role === "STUDENT" && auth.membership?.tenantId === tenant.id;
  const isLoggedInTeacher = Boolean(auth && (auth.user.role === "SUPER_ADMIN" || auth.user.role === "ADMIN" || auth.user.role.startsWith("TEACHER")) && auth.membership?.tenantId === tenant.id);
  const isPublicLive = tenant.settings?.publicPageLive ?? true;

  if (tenant.status === "SUSPENDED") {
    return <main className="tenantUnavailable"><section><span>صيانة مؤقتة</span><h1>{tenant.name}</h1><p>هذه المنصة غير متاحة مؤقتًا. بيانات الطلاب محفوظة ويمكن العودة لاحقًا.</p></section></main>;
  }
  if (!isPublicLive && !isLoggedInTeacher) {
    return <main className="tenantUnavailable"><section><span>منصة {tenant.name}</span><h1>{tenant.name}</h1><p>يجهز المدرس الصفحة العامة حاليًا. يمكنك الانضمام أو الدخول مباشرة إلى لوحتك التعليمية.</p>{isLoggedInStudent ? <Link className="btn tenantPrimary" href="/dashboard">انتقل إلى لوحتك التعليمية ←</Link> : <div className="tenantUnavailableActions"><Link className="btn tenantPrimary" href={"/t/" + tenant.slug + "/register"}>إنشاء حساب طالب ←</Link><Link className="btn tenantSecondary" href={"/t/" + tenant.slug + "/login"}>تسجيل الدخول</Link></div>}</section></main>;
  }

  const courses = await prisma.course.findMany({
    where: { tenantId: tenant.id, status: "PUBLISHED" },
    include: { _count: { select: { sections: true, enrollments: true } } },
    orderBy: { createdAt: "desc" }, take: 12,
  });
  const enrolledCourseIds = isLoggedInStudent ? new Set((await prisma.enrollment.findMany({ where: { tenantId: tenant.id, studentId: auth.user.id, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { courseId: true } })).map((item) => item.courseId)) : new Set<string>();
  const totalStudents = courses.reduce((sum, course) => sum + course._count.enrollments, 0);
  const theme = tenant.theme;
  const defaultHomepageSections = ["HERO", "COURSES", "FEATURES", "STATS", "FAQ", "CONTACT"];
  const homepageSections = Array.isArray(theme?.homepageSections) ? theme.homepageSections.filter((section): section is string => typeof section === "string") : defaultHomepageSections;
  const sectionStyle = (section: string): CSSProperties => ({ order: Math.max(1, homepageSections.indexOf(section) + 1), display: homepageSections.includes(section) ? undefined : "none" });
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
    "--tenant-footer": theme?.footerColor ?? theme?.secondaryColor ?? "#081b3a",
    "--tenant-link": theme?.linkColor ?? theme?.primaryColor ?? "#1565f5",
    "--tenant-hover": theme?.hoverColor ?? "#0f4ed8",
    "--tenant-heading-font": theme?.headingFont ?? theme?.fontFamily ?? "Tajawal",
    "--tenant-button-font": theme?.buttonFont ?? theme?.fontFamily ?? "Tajawal",
    "--tenant-card-style": theme?.cardStyle ?? "ELEVATED",
    "--tenant-button-style": theme?.buttonStyle ?? "GRADIENT",
    "--tenant-radius": (theme?.borderRadius ?? 20) + "px",
    fontFamily: `${theme?.bodyFont ?? theme?.fontFamily ?? "Tajawal"}, "Segoe UI", Tahoma, Arial, sans-serif`,
  } as CSSProperties;

  const primaryHref = isLoggedInStudent ? "/dashboard" : "/t/" + tenant.slug + "/register";
  return <main className={`tenantPublic tenantShowcase tenantHeroLayout-${(theme?.heroLayout ?? "SPLIT").toLowerCase()}`} style={style}>
    <TenantPublicHeader tenant={{ slug: tenant.slug, name: tenant.name, subject: tenant.subject, logoUrl: tenant.logoUrl, platformName: tenant.settings?.platformName }} isLoggedInStudent={isLoggedInStudent} />
    <section className="tenantHero wrap" style={sectionStyle("HERO")}><div className="tenantHeroCopy tenantReveal"><span className="tenantEyebrow"><Sparkles size={16} /> تعلّم مع {tenant.name}</span><h1>{theme?.heroTitle ?? tenant.settings?.heroTitle ?? "فهم أعمق. نتائج أقوى. رحلة تعليم واضحة."}</h1><p>{theme?.heroSubtitle ?? tenant.settings?.description ?? tenant.description ?? "محتوى منظم، شرح واضح، ومتابعة حقيقية تساعدك تتقدم بثقة خطوة بخطوة."}</p><div className="tenantHeroActions"><Link className="btn tenantPrimary" href={primaryHref}>{isLoggedInStudent ? "اذهب إلى لوحتي" : (theme?.heroCtaLabel ?? "أنشئ حسابك مجانًا")} <ArrowLeft size={18} /></Link><Link className="tenantTextButton" href="#courses">{theme?.heroSecondaryLabel ?? "استكشف الكورسات"}</Link></div><div className="tenantHeroProof"><span><CheckCircle2 size={16} /> محتوى منظم</span><span><CheckCircle2 size={16} /> متابعة للتقدم</span><span><CheckCircle2 size={16} /> تجربة آمنة</span></div></div>
      <div className="tenantTeacher tenantReveal tenantRevealDelay"><span className="teacherRing one" /><span className="teacherRing two" /><span className="tenantHeroAura" /><div className="tenantFloatingBadge badgeTop"><BookOpenCheck size={21} /><span><b>{courses.length.toLocaleString("en-US")} كورس</b><small>متاح على المنصة</small></span></div><Image src={theme?.teacherPortraitUrl || theme?.heroImageUrl || theme?.loginCoverUrl || "/hero.png"} alt={tenant.name} width={700} height={600} priority /><div className="tenantFloatingBadge badgeBottom"><span className="liveDot" /><span><b>تعلّم بطريقتك</b><small>من أي جهاز وفي أي وقت</small></span></div></div>
    </section>
    <section className="tenantTrustBar" style={sectionStyle("STATS")}><div className="wrap"><div><b>{courses.length.toLocaleString("en-US")}</b><span>كورس منشور</span></div><div><b>{totalStudents.toLocaleString("en-US")}</b><span>اشتراك تعليمي</span></div><div><b>RTL</b><span>واجهة عربية متكاملة</span></div><div><b>آمن</b><span>بيانات كل منصة معزولة</span></div></div></section>
    <section id="courses" className="tenantCourses wrap" style={sectionStyle("COURSES")}><div className="tenantSectionHead"><div><span>ابدأ رحلتك</span><h2>كورسات مصممة لتفهم وتتقدم</h2><p>اختر الكورس المناسب لصفك، واعرف تفاصيله قبل الاشتراك.</p></div>{isLoggedInStudent ? <Link href="/dashboard">عرض كورساتي <ArrowLeft size={17} /></Link> : null}</div>{courses.length ? <div className="tenantCourseGrid">{courses.map((course, index) => <article id={"course-" + course.id} className={`tenantCourseCard tone-${index % 3}`} key={course.id}><div className="tenantCourseArt">{course.thumbnailUrl ? <CourseThumbnail src={course.thumbnailUrl} alt={course.title} /> : <><span>{course.subject}</span><b>{course.subject.slice(0, 2)}</b><i /><em /></>}</div><div className="tenantCourseBody"><div className="courseMeta"><span>{gradeLabels[course.grade]}</span><small><Users size={13} /> {course._count.enrollments.toLocaleString("en-US")} طالب</small></div><h3>{course.title}</h3><p>{course.description}</p><div className="tenantCourseFooter"><span><small>سعر الكورس</small><b>{Number(course.price) === 0 ? "مجاني" : Number(course.price).toLocaleString("en-US") + " ج.م"}</b></span>{enrolledCourseIds.has(course.id) ? <Link className="tenantCourseAction enrolled" href={"/course?courseId=" + course.id}>متابعة الكورس <ArrowLeft size={16} /></Link> : <Link className="tenantCourseAction" href={"/t/" + tenant.slug + "/courses/" + course.slug}>تفاصيل الكورس <ArrowLeft size={16} /></Link>}</div></div></article>)}</div> : <div className="emptyState tenantCourseEmpty"><span>✦</span><h3>الكورسات قيد التجهيز</h3><p>سيظهر محتوى المدرس هنا فور نشر أول كورس.</p></div>}</section>
    <section id="why" className="tenantValueBand" style={sectionStyle("FEATURES")}><div className="wrap"><div className="tenantSectionHead light"><div><span>تجربة متكاملة</span><h2>كل ما تحتاجه للتعلّم بثقة</h2><p>المنصة تربط المحتوى والتقدم والنتائج في مكان واحد هادئ وواضح.</p></div></div><div className="tenantValueGrid"><article><i><BookOpenCheck /></i><h3>محتوى مرتب</h3><p>دروس ووحدات مرتبة لتعرف دائمًا أين أنت وما الخطوة التالية.</p></article><article><i><GraduationCap /></i><h3>متابعة حقيقية</h3><p>تقدمك ونتائجك محفوظة داخل حسابك وتظهر لك بوضوح.</p></article><article><i><ShieldCheck /></i><h3>خصوصية وأمان</h3><p>حسابك مرتبط بمنصة مدرسك، وبيانات كل منصة معزولة عن غيرها.</p></article></div></div></section>
    <section className="tenantFinalCta" style={sectionStyle("CONTACT")}><div className="wrap"><div><span>جاهز تبدأ؟</span><h2>{isLoggedInStudent ? "ارجع لمساحتك وكمّل تقدمك." : "أنشئ حسابك وانضم إلى رحلة التعلّم."}</h2></div><Link className="btn tenantPrimary" href={primaryHref}>{isLoggedInStudent ? "افتح لوحتي" : "ابدأ الآن"} <ArrowLeft size={18} /></Link></div></section>
    <footer className="tenantFooter"><div className="wrap"><div><b>{tenant.settings?.platformName ?? tenant.name}</b><small>{tenant.subject ?? "منصة تعليمية"}</small></div><span>© {new Date().getFullYear()} جميع الحقوق محفوظة</span></div></footer>
  </main>;
}
