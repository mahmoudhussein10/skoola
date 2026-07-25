import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  HelpCircle,
  Lock,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { prisma } from "../../../../../lib/prisma";
import { requirePublicTenant } from "../../../../../lib/tenant";
import { getAuthContext } from "../../../../../lib/auth";
import { CourseThumbnail } from "../../../../course-thumbnail";
import { visiblePaymentMethods } from "../../../../../lib/payment-settings";
import { StudentCheckoutClient } from "./student-checkout-client";
import { TenantPublicHeader } from "../../../../components/tenant-public-header";

export const dynamic = "force-dynamic";

const gradeLabels = {
  FIRST_SECONDARY: "الأول الثانوي",
  SECOND_SECONDARY: "الثاني الثانوي",
  THIRD_SECONDARY: "الثالث الثانوي",
} as const;

const lessonTypeLabels = {
  VIDEO: "فيديو",
  TEXT: "شرح نصي",
  FILE: "ملف / رابط",
  VIDEO_WITH_ATTACHMENT: "فيديو مع مرفقات",
} as const;

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; courseSlug: string }>;
}) {
  const { tenantSlug, courseSlug } = await params;
  const [tenant, auth] = await Promise.all([
    requirePublicTenant(tenantSlug),
    getAuthContext(),
  ]);

  const paymentSettings = await prisma.teacherBillingSettings.findUnique({
    where: { tenantId: tenant.id },
  });

  const course = await prisma.course.findFirst({
    where: {
      tenantId: tenant.id,
      slug: courseSlug,
      status: "PUBLISHED",
    },
    include: {
      createdBy: { select: { fullName: true, avatarUrl: true } },
      sections: {
        where: { tenantId: tenant.id },
        orderBy: { order: "asc" },
        include: {
          lessons: {
            where: { tenantId: tenant.id, status: "PUBLISHED" },
            orderBy: { order: "asc" },
          },
        },
      },
      _count: { select: { enrollments: true } },
    },
  });

  if (!course) {
    notFound();
  }

  const publishedExams = await prisma.exam.findMany({
    where: {
      tenantId: tenant.id,
      courseId: course.id,
      status: "PUBLISHED",
    },
    orderBy: { id: "asc" },
    include: {
      _count: { select: { questions: true } },
    },
  });

  const publishedSections = course.sections.filter(
    (s) => (s as { status?: string }).status !== "DRAFT" && (s as { status?: string }).status !== "HIDDEN"
  );

  const isLoggedInStudent =
    auth?.user.role === "STUDENT" && auth.membership?.tenantId === tenant.id;

  let isEnrolled = false;
  let enrollmentProgress = 0;

  if (auth?.user && auth.membership?.tenantId === tenant.id) {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        tenantId_studentId_courseId: {
          tenantId: tenant.id,
          studentId: auth.user.id,
          courseId: course.id,
        },
      },
    });
    if (enrollment && (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED")) {
      isEnrolled = true;
      enrollmentProgress = Number(enrollment.progressPercentage);
    }
  }

  // Totals
  const totalLessons = publishedSections.reduce((acc, s) => acc + s.lessons.length, 0);
  const totalExams = publishedExams.length;
  const totalDurationMinutes = publishedSections.reduce(
    (acc, s) => acc + s.lessons.reduce((lAcc, l) => lAcc + l.duration, 0),
    0
  );

  const durationHours = Math.floor(totalDurationMinutes / 60);
  const remainingMins = totalDurationMinutes % 60;
  const durationFormatted =
    totalDurationMinutes > 0
      ? durationHours > 0
        ? `${durationHours} ساعة و ${remainingMins} دقيقة`
        : `${totalDurationMinutes} دقيقة`
      : "محتوى شامل متكامل";

  const redirectParam = encodeURIComponent(`/t/${tenant.slug}/courses/${course.slug}`);

  return (
    <main className="tenantPublic courseDetailPage">
      <TenantPublicHeader tenant={{ slug: tenant.slug, name: tenant.name, subject: tenant.subject, logoUrl: tenant.logoUrl, platformName: tenant.settings?.platformName }} isLoggedInStudent={isLoggedInStudent} />

      {/* Hero Header Section */}
      <section className="courseHeroSection wrap">
        <div className="courseHeroGrid">
          {/* Left Column: Info & Details */}
          <div className="courseHeroContent">
            <div className="breadcrumbRow">
              <Link href={`/t/${tenant.slug}`}>الرئيسية</Link>
              <span>/</span>
              <Link href={`/t/${tenant.slug}#courses`}>الكورسات</Link>
              <span>/</span>
              <span className="active">{course.title}</span>
            </div>

            <div className="courseMetaBadgeRow">
              <span className="tag blue">{gradeLabels[course.grade]}</span>
              <span className="tag purple">{course.subject}</span>
              <span className="tag green">كورس متاح للاشتراك</span>
            </div>

            <h1 className="courseMainTitle">{course.title}</h1>
            <p className="courseMainDesc">{course.description}</p>

            <div className="teacherCardMini">
              <div className="teacherAvatarRing">
                {course.createdBy.fullName.trim().charAt(0)}
              </div>
              <div>
                <span className="teacherTitle">أستاذ المادة والمنهج</span>
                <b className="teacherName">{course.createdBy.fullName}</b>
              </div>
            </div>

            <div className="courseStatsFlex">
              <div className="statPill">
                <BookOpen size={18} />
                <span><b>{publishedSections.length}</b> أقسام</span>
              </div>
              <div className="statPill">
                <PlayCircle size={18} />
                <span><b>{totalLessons}</b> دروس</span>
              </div>
              <div className="statPill">
                <HelpCircle size={18} />
                <span><b>{totalExams}</b> امتحانات</span>
              </div>
              <div className="statPill">
                <Clock size={18} />
                <span>{durationFormatted}</span>
              </div>
              <div className="statPill">
                <Users size={18} />
                <span><b>{course._count.enrollments.toLocaleString("en-US")}</b> طالب</span>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Card & Purchase CTA */}
          <div className="courseHeroCardWrapper">
            <div className="courseCheckoutCard">
              <div className="cardThumbnailBox">
                {course.thumbnailUrl ? (
                  <CourseThumbnail src={course.thumbnailUrl} alt={course.title} />
                ) : (
                  <div className="defaultArtCover">
                    <Sparkles size={32} />
                    <span>{course.subject}</span>
                    <b>{course.subject.slice(0, 2)}</b>
                  </div>
                )}
              </div>

              <div className="cardBody">
                <div className="cardPriceRow">
                  <div>
                    <small>تكلفة الاشتراك في الكورس</small>
                    <b className="priceAmount">
                      {Number(course.price) === 0
                        ? "مجاني بالكامل"
                        : `${Number(course.price).toLocaleString("en-US")} ج.م`}
                    </b>
                  </div>
                  <span className="badge amber">وصول كامل</span>
                </div>

                {isEnrolled ? (
                  <div className="enrolledSuccessBanner">
                    <CheckCircle2 size={24} />
                    <div>
                      <b>أنت مشترك بالفعل في هذا الكورس!</b>
                      <small>نسبة إنجازك حتى الآن: {enrollmentProgress}%</small>
                    </div>
                    <Link className="btn tenantPrimary lg fullCtaBtn" href={`/course?courseId=${course.id}`}>
                      متابعة الدراسة والدروس <ArrowLeft size={18} />
                    </Link>
                  </div>
                ) : auth?.user ? (
                  <div>
                    {auth.user.role !== "STUDENT" ? (
                      <small style={{ display: "block", marginBottom: "8px", textAlign: "center", color: "#64748b", fontWeight: 700 }}>
                        👁️ عرض بصفتك المدرس (معاينة تجربة شراء الطالب):
                      </small>
                    ) : null}
                    <StudentCheckoutClient
                      courseId={course.id}
                      courseTitle={course.title}
                      coursePrice={Number(course.price)}
                      teacherName={course.createdBy.fullName}
                      paymentMethods={visiblePaymentMethods(paymentSettings)}
                      paymentInstructions={paymentSettings?.paymentInstructions}
                    />
                  </div>
                ) : (
                  <div className="guestSubscribeBox">
                    <Link
                      className="btn tenantPrimary lg fullCtaBtn"
                      href={`/t/${tenant.slug}/login?redirect=${redirectParam}`}
                    >
                      <Sparkles size={18} />
                      تسجيل الدخول والاشتراك الآن
                      <ArrowLeft size={18} />
                    </Link>
                    <div className="guestSubText">
                      <span>ليس لديك حساب طالب؟</span>
                      <Link href={`/t/${tenant.slug}/register?redirect=${redirectParam}`}>
                        أنشئ حساب طالب جديد في الأكاديمية
                      </Link>
                    </div>
                  </div>
                )}

                <ul className="courseFeaturesList">
                  <li>
                    <CheckCircle2 size={16} />
                    <span>وصول فوري لجميع الفيديوهات والملخصات</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>اختبارات إلكترونية وتقييم فوري للدرجات</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} />
                    <span>إمكانية التكرار والمشاهدة من الهاتف أو الكمبيوتر</span>
                  </li>
                  <li>
                    <ShieldCheck size={16} />
                    <span>دعم فني ومتابعة مستمرة مع المدرس</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Course Content Section */}
      <section className="courseContentSection wrap">
        {course.fullDescription ? (
          <div className="panel fullDescPanel">
            <div className="panelHead">
              <div>
                <span>معلومات عن المنهج</span>
                <h2>تفاصيل وشرح محتوى الكورس</h2>
              </div>
            </div>
            <div className="descText">{course.fullDescription}</div>
          </div>
        ) : null}

        <div className="panel curriculumPanel">
          <div className="panelHead">
            <div>
              <span>منهج المادة</span>
              <h2>الأقسام والدروس والامتحانات المتاحة</h2>
            </div>
            <small className="secSummaryBadge">
              {publishedSections.length} أقسام · {totalLessons} دروس · {totalExams} امتحانات
            </small>
          </div>

          <div className="sectionsList">
            {publishedSections.length ? (
              publishedSections.map((section, idx) => (
                <details key={section.id} className="sectionAccordion" open={idx === 0}>
                  <summary className="sectionSummary">
                    <div className="secTitleGroup">
                      <span className="secIdx">{idx + 1}</span>
                      <div>
                        <h3>{section.title}</h3>
                        {section.description ? <p>{section.description}</p> : null}
                      </div>
                    </div>
                    <div className="secCounts">
                      <span>{section.lessons.length} دروس</span>
                      {publishedExams.filter((e) => e.sectionId === section.id).length > 0 ? (
                        <span>
                          {publishedExams.filter((e) => e.sectionId === section.id).length} امتحانات
                        </span>
                      ) : null}
                    </div>
                  </summary>

                  <div className="sectionItems">
                    {section.lessons.map((lesson) => {
                      const canAccess = isEnrolled || lesson.isPreview;
                      return (
                        <div
                          key={lesson.id}
                          className={`contentRow ${!canAccess ? "locked" : ""}`}
                        >
                          <div className="rowMain">
                            <div className="iconFrame">
                              {lesson.type === "VIDEO" || lesson.type === "VIDEO_WITH_ATTACHMENT" ? (
                                <PlayCircle size={18} />
                              ) : (
                                <FileText size={18} />
                              )}
                            </div>
                            <div>
                              <h4>{lesson.title}</h4>
                              <small>
                                {lessonTypeLabels[lesson.type]}
                                {lesson.duration > 0 ? ` · ${lesson.duration} دقيقة` : ""}
                              </small>
                            </div>
                          </div>

                          <div className="rowActions">
                            {lesson.isPreview ? (
                              <span className="badge amber">
                                <Eye size={12} /> معاينة مجانية
                              </span>
                            ) : null}

                            {isEnrolled ? (
                              <Link
                                className="btn sm primary"
                                href={`/course?courseId=${course.id}&lessonId=${lesson.id}`}
                              >
                                مشاهدة الدرس <ArrowLeft size={14} />
                              </Link>
                            ) : lesson.isPreview ? (
                              <Link
                                className="btn sm outline"
                                href={`/course?courseId=${course.id}&lessonId=${lesson.id}`}
                              >
                                تجربة المعاينة المجانية <Eye size={14} />
                              </Link>
                            ) : (
                              <span className="lockedLabel">
                                <Lock size={14} /> يتطلب الاشتراك
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {publishedExams
                      .filter((e) => e.sectionId === section.id)
                      .map((exam) => (
                        <div
                          key={exam.id}
                          className={`contentRow examRow ${!isEnrolled ? "locked" : ""}`}
                        >
                          <div className="rowMain">
                            <div className="iconFrame purple">
                              <HelpCircle size={18} />
                            </div>
                            <div>
                              <h4>{exam.title}</h4>
                              <small>
                                كويز إلكتروني · {exam._count.questions} أسئلة · {exam.durationMinutes} دقيقة
                              </small>
                            </div>
                          </div>

                          <div className="rowActions">
                            {isEnrolled ? (
                              <Link
                                className="btn sm primary"
                                href={`/course?courseId=${course.id}&examId=${exam.id}`}
                              >
                                ابدأ الامتحان <ArrowLeft size={14} />
                              </Link>
                            ) : (
                              <span className="lockedLabel">
                                <Lock size={14} /> يتطلب الاشتراك
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </details>
              ))
            ) : (
              <div className="emptyCurriculum">
                <p>محتوى الدروس والامتحانات قيد الإعداد وسيتم نشره قريباً.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
