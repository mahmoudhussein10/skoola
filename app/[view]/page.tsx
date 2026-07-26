import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { prisma } from "../../lib/prisma";
import { getAuthContext, homeForRole, requireTenantMember } from "../../lib/auth";
import { Side, AppTop, Brand } from "../ui";
import { ActiveAnnouncements } from "../active-announcements";
import { StudentActivation } from "../student-activation";
import { CourseThumbnail } from "../course-thumbnail";
import { BellRing, ChartNoAxesColumnIncreasing, GraduationCap, Trophy } from "lucide-react";

import { StudentCourseViewer } from "../course/student-course-viewer";
import { PushSettingsCard } from "../notifications/push-client";

function Empty({ icon, title, text, action, href }: { icon: string; title: string; text: string; action?: string; href?: string }) {
  return <div className="emptyState"><span>{icon}</span><h3>{title}</h3><p>{text}</p>{action && href ? <Link className="btn primary" href={href}>{action}</Link> : null}</div>;
}

const gradeLabels = { FIRST_PREPARATORY: "الأول الإعدادي", SECOND_PREPARATORY: "الثاني الإعدادي", THIRD_PREPARATORY: "الثالث الإعدادي", FIRST_SECONDARY: "الأول الثانوي", SECOND_SECONDARY: "الثاني الثانوي", THIRD_SECONDARY: "الثالث الثانوي" } as const;

type ViewerCourseRecord = {
  id: string;
  title: string;
  subject: string;
  sections: Array<{
    id: string;
    title: string;
    lessons: Array<{
      id: string;
      sectionId: string;
      title: string;
      description: string | null;
      content: string | null;
      type: "VIDEO" | "TEXT" | "FILE" | "VIDEO_WITH_ATTACHMENT";
      videoId: string | null;
      videoUrl: string | null;
      attachmentUrl: string | null;
      thumbnailUrl: string | null;
      duration: number;
      order: number;
      progress: Array<{ completed: boolean }>;
    }>;
    exams: Array<{
      id: string;
      title: string;
      description: string | null;
      durationMinutes: number;
      passingScore: unknown;
      maxAttempts: number;
      showResultImmediately: boolean;
      showAnswersAfterSubmit: boolean;
      questions: Array<{
        id: string;
        text: string;
        imageUrl: string | null;
        type: "MCQ" | "TRUE_FALSE";
        options: unknown;
        points: unknown;
      }>;
      attempts: Array<{
        score: unknown;
        maxScore: unknown;
        percentage: unknown;
        passed: boolean | null;
        submittedAt: Date | null;
        startedAt: Date;
      }>;
    }>;
  }>;
};

async function Dashboard() {
  const auth = await getAuthContext();
  if (!auth) redirect("/login?role=student&next=/dashboard");
  if (auth.user.role !== "STUDENT") {
    const roleLabel = auth.user.role === "SUPER_ADMIN" || auth.user.role === "ADMIN" ? "الإدارة العليا" : "إدارة الأكاديمية";
    return (
      <main className="roleMismatchPage" dir="rtl"><section className="roleMismatchCard">
        <div className="roleMismatchIcon" aria-hidden="true">↔</div><span className="roleMismatchEyebrow">حساب مختلف مسجّل حاليًا</span>
        <h1>هذه لوحة الطالب</h1><p>أنت مسجّل الدخول بحساب <strong>{roleLabel}</strong> باسم {auth.user.fullName}. حفاظًا على الصلاحيات والبيانات، استخدم حساب طالب لفتح هذه اللوحة.</p>
        <div className="roleMismatchActions"><form action="/api/auth/logout" method="post"><input type="hidden" name="next" value="/login?role=student&next=/dashboard" /><button className="btn primary" type="submit">تبديل الحساب والدخول كطالب</button></form><Link className="btn roleMismatchSecondary" href={homeForRole(auth.user.role)}>العودة إلى لوحة {roleLabel}</Link></div>
        <small>لن يتم دمج صلاحيات الإدارة مع بيانات الطلاب.</small>
      </section></main>
    );
  }
  const context = await requireTenantMember("STUDENT");
  const { user, membership } = context;
  const tenantId = membership.tenantId;

  const [profile, enrollments, attempts, unread] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      select: { grade: true },
    }),
    prisma.enrollment.findMany({
      where: { tenantId, studentId: user.id, status: { in: ["ACTIVE", "COMPLETED"] } },
      include: {
        course: {
          include: {
            sections: {
              include: {
                lessons: { where: { tenantId, status: "PUBLISHED" }, orderBy: { order: "asc" } },
              },
            },
          },
        },
      },
      orderBy: [{ lastAccessAt: "desc" }, { enrolledAt: "desc" }],
    }),
    prisma.examAttempt.findMany({
      where: { tenantId, studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } },
      include: { exam: true },
      orderBy: { submittedAt: "desc" },
      take: 5,
    }),
    prisma.notificationRecipient.count({ where: { tenantId, userId: user.id, isRead: false, isArchived: false } }),
  ]);

  const enrolledIds = enrollments.map((item) => item.courseId);
  const availableCourses = await prisma.course.findMany({
    where: {
      tenantId,
      status: "PUBLISHED",
      ...(profile ? { grade: profile.grade } : {}),
      ...(enrolledIds.length ? { id: { notIn: enrolledIds } } : {}),
    },
    include: { _count: { select: { sections: true, enrollments: true } } },
    orderBy: { createdAt: "desc" },
    take: 6,
  });

  const current = enrollments.find((item) => item.status === "ACTIVE");
  const progress = current ? Number(current.progressPercentage) : 0;
  const completed = enrollments.filter(
    (item) => item.status === "COMPLETED" || Number(item.progressPercentage) === 100
  ).length;
  const average = attempts.length
    ? attempts.reduce((sum, item) => sum + Number(item.score ?? 0), 0) / attempts.length
    : 0;
  const firstName = user.fullName.trim().split(" ")[0];

  return (
    <div className="appShell studentShell">
      <Side />
      <main className="appMain">
        <AppTop
          title={"أهلًا يا " + firstName + " 👋"}
          sub={"كل رحلتك داخل " + membership.tenant.name}
          userName={user.fullName}
        />
        <ActiveAnnouncements tenantId={tenantId} audience="student" />
        <PushSettingsCard />

        <section className="dashboardHero studentDashboardHero">
          <div className="studentHeroCopy">
            <span>مساحتك التعليمية</span>
            <h2>
              {current
                ? "خطوة صغيرة اليوم تصنع فرقًا كبيرًا."
                : availableCourses.length
                ? "كورسات مدرسك جاهزة لك."
                : "رحلتك تبدأ من هنا."}
            </h2>
            <p>
              {current
                ? `وصلت إلى ${progress.toLocaleString("en-US")}% في ${current.course.title}. كمّل من حيث توقفت.`
                : availableCourses.length
                ? "استكشف الكورسات المناسبة لصفك واختر خطوتك القادمة."
                : "سيظهر هنا كل كورس جديد ينشره مدرسك."}
            </p>
            <div className="studentHeroActions">
              {current ? (
                <Link className="btn primary" href={`/course?courseId=${current.courseId}`}>
                  متابعة التعلّم ←
                </Link>
              ) : null}
              <Link className="studentGhostButton" href={"/t/" + membership.tenant.slug + "#courses"}>
                زيارة صفحة المدرس
              </Link>
            </div>
          </div>
          <div className="studentHeroVisual">
            <span className="orbit orbitOne" />
            <span className="orbit orbitTwo" />
            <div className="progressMedal">
              <small>تقدمك الحالي</small>
              <b>{progress.toLocaleString("en-US")}%</b>
              <i>
                <em style={{ width: `${progress}%` }} />
              </i>
            </div>
            <div className="studentLearningArt" aria-hidden="true">
              <i className="learningBook bookBack" />
              <i className="learningBook bookFront">
                <b>SK</b>
                <span>تعلم اليوم</span>
              </i>
              <span className="learningSpark sparkOne">✦</span>
              <span className="learningSpark sparkTwo">•</span>
              <span className="learningAvatar">{firstName.charAt(0)}</span>
            </div>
          </div>
        </section>

        <section className="kpis studentKpis" aria-label="ملخص تقدّمك">
          <article className="kpi studentKpi blue">
            <div className="studentKpiHead"><i><GraduationCap size={20} /></i><span>كورساتي</span></div>
            <b>{enrollments.length.toLocaleString("en-US")}</b>
            <small>مسجلة على حسابك</small>
          </article>
          <article className="kpi studentKpi green">
            <div className="studentKpiHead"><i><Trophy size={20} /></i><span>تم إنجازه</span></div>
            <b>{completed.toLocaleString("en-US")}</b>
            <small>كورس مكتمل</small>
          </article>
          <article className="kpi studentKpi purple">
            <div className="studentKpiHead"><i><ChartNoAxesColumnIncreasing size={20} /></i><span>متوسط النتائج</span></div>
            <b>{average.toLocaleString("en-US", { maximumFractionDigits: 1 })}%</b>
            <small>{attempts.length.toLocaleString("en-US")} محاولة</small>
          </article>
          <article className="kpi studentKpi orange">
            <div className="studentKpiHead"><i><BellRing size={20} /></i><span>التنبيهات</span></div>
            <b>{unread.toLocaleString("en-US")}</b>
            <small>تحتاج انتباهك</small>
          </article>
        </section>

        <div className="studentContentGrid">
          <section id="my-courses" className="panel studentPanel">
            <div className="panelHead rich">
              <div>
                <span>واصل التعلّم</span>
                <h2>كورساتي</h2>
              </div>
              <small>{enrollments.length.toLocaleString("en-US")} كورس</small>
            </div>
            {enrollments.length ? (
              <div className="realCourseList">
                {enrollments.map((item) => (
                  <Link
                    className="realCourse enrolledCourse"
                    href={`/course?courseId=${item.courseId}`}
                    key={item.id}
                  >
                    <div className="courseMonogram">{item.course.subject.slice(0, 2)}</div>
                    <div className="enrolledCourseCopy">
                      <small>{gradeLabels[item.course.grade]}</small>
                      <h3>{item.course.title}</h3>
                      <p>{item.course.sections.length.toLocaleString("en-US")} وحدات تعليمية</p>
                      <i>
                        <em style={{ width: `${Number(item.progressPercentage)}%` }} />
                      </i>
                    </div>
                    <strong>{Number(item.progressPercentage).toLocaleString("en-US")}%</strong>
                  </Link>
                ))}
              </div>
            ) : (
              <Empty
                icon="📚"
                title="لم تشترك في كورس بعد"
                text="الكورسات المنشورة المناسبة لصفك موجودة بالأسفل، ويمكنك معرفة تفاصيل الاشتراك من صفحة المدرس."
              />
            )}
          </section>

          <section id="exam-results" className="panel studentPanel resultsPanel">
            <div className="panelHead rich">
              <div>
                <span>قياس مستواك</span>
                <h2>آخر النتائج</h2>
              </div>
            </div>
            {attempts.length ? (
              attempts.map((attempt) => (
                <div className="task resultTask" key={attempt.id}>
                  <i>✓</i>
                  <span>
                    <b>{attempt.exam.title}</b>
                    <small>
                      {attempt.submittedAt?.toLocaleDateString("ar-EG") ?? "قيد التصحيح"}
                    </small>
                  </span>
                  <b>{Number(attempt.score ?? 0).toLocaleString("en-US")}</b>
                </div>
              ))
            ) : (
              <Empty
                icon="📊"
                title="لا توجد نتائج بعد"
                text="نتائج امتحاناتك ستظهر هنا تلقائيًا."
              />
            )}
          </section>
        </div>

        <StudentActivation />

        <section className="panel studentPanel discoverPanel">
          <div className="panelHead rich">
            <div>
              <span>مناسب لصفك الدراسي</span>
              <h2>اكتشف كورسات {membership.tenant.name}</h2>
            </div>
            <Link href={"/t/" + membership.tenant.slug + "#courses"}>عرض الكل ←</Link>
          </div>
          {availableCourses.length ? (
            <div className="studentCatalog">
              {availableCourses.map((course, index) => (
                <Link
                  href={"/t/" + membership.tenant.slug + "/courses/" + course.slug}
                  className={`catalogCourse tone-${index % 3}`}
                  key={course.id}
                >
                  <div className="catalogArt">
                    {course.thumbnailUrl ? (
                      <CourseThumbnail src={course.thumbnailUrl} alt={course.title} />
                    ) : (
                      <>
                        <span>{course.subject}</span>
                        <b>{course.subject.slice(0, 2)}</b>
                        <i />
                      </>
                    )}
                  </div>
                  <div>
                    <small>{gradeLabels[course.grade]}</small>
                    <h3>{course.title}</h3>
                    <p>{course.description}</p>
                    <footer>
                      <span>{course._count.sections.toLocaleString("en-US")} وحدات</span>
                      <b>
                        {Number(course.price) === 0
                          ? "مجاني"
                          : Number(course.price).toLocaleString("en-US") + " ج.م"}
                      </b>
                    </footer>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="catalogEmpty">
              <span>✦</span>
              <div>
                <h3>
                  {enrollments.length
                    ? "أنت مسجل في كل الكورسات المتاحة لصفك"
                    : "لا توجد كورسات منشورة لصفك بعد"}
                </h3>
                <p>أي كورس جديد ينشره المدرس سيظهر هنا تلقائيًا.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

async function Course({ courseId, lessonId }: { courseId?: string; lessonId?: string }) {
  const auth = await getAuthContext();
  if (!auth) redirect("/login");
  const { user, membership } = auth;
  const tenantId = membership?.tenantId;

  const isStaffOrAdmin =
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    user.role === "TEACHER_OWNER" ||
    user.role === "TEACHER_ADMIN" ||
    user.role === "TEACHER_EDITOR";

  let courseData: ViewerCourseRecord | null = null;

  if (isStaffOrAdmin) {
    courseData = await prisma.course.findFirst({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(courseId ? { id: courseId } : {}),
      },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
              include: {
                progress: { where: { studentId: user.id } },
              },
            },
            exams: {
              orderBy: { id: "asc" },
              include: {
                questions: {
                  orderBy: { order: "asc" },
                  select: { id: true, text: true, imageUrl: true, type: true, options: true, points: true },
                },
                attempts: {
                  where: { studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } },
                  orderBy: { submittedAt: "desc" },
                },
              },
            },
          },
        },
      },
    });
  } else {
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        tenantId,
        studentId: user.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
        ...(courseId ? { courseId } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: {
        course: {
          include: {
            sections: {
              where: { tenantId, status: "PUBLISHED" },
              orderBy: { order: "asc" },
              include: {
                lessons: {
                  where: { tenantId, status: "PUBLISHED" },
                  orderBy: { order: "asc" },
                  include: {
                    progress: { where: { tenantId, studentId: user.id } },
                  },
                },
                exams: {
                  where: { tenantId, status: "PUBLISHED" },
                  orderBy: { id: "asc" },
                  include: {
                    questions: {
                      where: { tenantId },
                      orderBy: { order: "asc" },
                      select: { id: true, text: true, imageUrl: true, type: true, options: true, points: true },
                    },
                    attempts: {
                      where: { tenantId, studentId: user.id, status: { in: ["SUBMITTED", "GRADED"] } },
                      orderBy: { submittedAt: "desc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { lastAccessAt: "desc" },
    });
    courseData = enrollment?.course ?? null;
  }

  if (!courseData) {
    return (
      <main className="coursePage">
        <div className="courseTop">
          <nav className="wrap courseNav">
            <Brand />
            <Link href="/dashboard">العودة للوحة التحكم ←</Link>
          </nav>
        </div>
        <div className="wrap standaloneEmpty">
          <Empty
            icon="🔒"
            title="لا يوجد كورس متاح"
            text="تحتاج إلى اشتراك نشط قبل مشاهدة محتوى هذا الكورس."
            action="العودة للوحة الطالب"
            href="/dashboard"
          />
        </div>
      </main>
    );
  }

  // Format data for StudentCourseViewer
  const viewerCourse = {
    id: courseData.id,
    title: courseData.title,
    subject: courseData.subject,
    sections: courseData.sections.map((sec) => ({
      id: sec.id,
      title: sec.title,
      lessons: sec.lessons.map((l) => ({
        id: l.id,
        sectionId: l.sectionId,
        sectionTitle: sec.title,
        title: l.title,
        description: l.description,
        content: l.content,
        type: l.type,
        videoId: l.videoId,
        videoUrl: l.videoUrl,
        attachmentUrl: l.attachmentUrl,
        thumbnailUrl: l.thumbnailUrl,
        duration: l.duration,
        order: l.order,
        completed: Boolean(l.progress?.[0]?.completed),
      })),
      exams: sec.exams.map((e) => {
        const lastAtt = e.attempts?.[0];
        return {
          id: e.id,
          title: e.title,
          description: e.description,
          durationMinutes: e.durationMinutes,
          passingScore: Number(e.passingScore),
          maxAttempts: e.maxAttempts,
          showResultImmediately: e.showResultImmediately,
          showAnswersAfterSubmit: e.showAnswersAfterSubmit,
          questionsCount: e.questions.length,
          questions: e.questions.map((q) => ({
            id: q.id,
            text: q.text,
            imageUrl: q.imageUrl ?? null,
            type: q.type,
            options: (Array.isArray(q.options) ? q.options : []) as string[],
            points: Number(q.points),
          })),
          myAttemptsCount: e.attempts.length,
          lastAttempt: lastAtt
            ? {
                score: Number(lastAtt.score ?? 0),
                maxScore: Number(lastAtt.maxScore ?? 0),
                percentage: Number(lastAtt.percentage ?? 0),
                passed: Boolean(lastAtt.passed),
                submittedAt: lastAtt.submittedAt?.toISOString() ?? lastAtt.startedAt.toISOString(),
              }
            : null,
        };
      }),
    })),
  };

  const studentUser = {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
  };

  return (
    <StudentCourseViewer
      user={studentUser}
      course={viewerCourse}
      initialLessonId={lessonId}
      initialProgress={0}
    />
  );
}

function Parents() {
  return <main className="parentInfo"><div className="wrap parentInfoGrid"><div><Brand /><span className="tag orange">متابعة مبنية على بيانات حقيقية</span><h1>اعرف مستوى ابنك من نشاطه الفعلي.</h1><p>تقارير المشاهدة والامتحانات والاشتراكات تظهر فقط بعد ربط الطالب بولي الأمر. لا نعرض أي أرقام تجريبية.</p><Link className="btn primary" href="/login?role=student">دخول الطالب ←</Link></div><Image src="/hero.png" alt="مدرس المنصة" width={700} height={600} /></div></main>;
}

export default async function View({ params, searchParams }: { params: Promise<{ view: string }>; searchParams: Promise<{ courseId?: string; lessonId?: string }> }) {
  const [{ view }, query] = await Promise.all([params, searchParams]);
  if (view === "dashboard") return <Dashboard />;
  if (view === "course") return <Course courseId={query.courseId} lessonId={query.lessonId} />;
  if (view === "admin") redirect("/teacher");
  if (view === "parents") return <Parents />;
  notFound();
}
