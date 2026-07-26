import { ArrowUpLeft, BookOpen, CheckCircle2, ChevronDown, Plus, Sparkles, Users } from "lucide-react";
import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { hasPermission } from "../../../lib/permissions";
import { CourseForm } from "./course-form";
import { CourseHub } from "./course-hub";
import styles from "./course-studio.module.css";

export default async function CoursesPage() {
  const context = await requirePermission("courses.view");
  const tenantId = context.membership.tenantId;
  const canManage = hasPermission(context.membership.role, "courses.manage", context.membership.permissions);
  const courses = await prisma.course.findMany({ where: { tenantId }, include: { _count: { select: { sections: true, enrollments: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const items = courses.map((course) => ({ id: course.id, title: course.title, slug: course.slug, description: course.description, grade: course.grade, subject: course.subject, price: Number(course.price), thumbnailUrl: course.thumbnailUrl, status: course.status, sections: course._count.sections, enrollments: course._count.enrollments }));
  const publishedCourses = items.filter((course) => course.status === "PUBLISHED").length;
  const totalStudents = items.reduce((sum, course) => sum + course.enrollments, 0);

  return <DashboardShell kind="teacher" title="الكورسات" subtitle="أنشئ محتواك، نظّمه وانشره لطلابك من مساحة عمل واحدة" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="courses-studio-title">
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}><Sparkles size={16} /> استوديو المحتوى التعليمي</span>
          <h2 id="courses-studio-title">حوّل خبرتك إلى كورسات<br />يحب طلابك إكمالها.</h2>
          <p>أنشئ الكورس، رتّب وحداته، أضف الدروس والاختبارات ثم انشره عندما يصبح جاهزًا.</p>
          <div className={styles.heroActions}>
            {canManage ? <a className={styles.primaryHeroAction} href="#create-course"><Plus size={19} /> إنشاء كورس جديد</a> : null}
            <a className={styles.secondaryHeroAction} href={'/t/' + context.membership.tenant.slug} target="_blank" rel="noreferrer">عرض منصة الطلاب <ArrowUpLeft size={18} /></a>
          </div>
        </div>
        <div className={styles.heroDashboard} aria-label="ملخص مكتبة الكورسات">
          <div className={styles.heroDashboardHead}><span><BookOpen size={18} /></span><div><small>مكتبة الأكاديمية</small><strong>جاهزة للنمو</strong></div><i /></div>
          <div className={styles.heroMiniGrid}>
            <article><CheckCircle2 size={18} /><span><b>{publishedCourses.toLocaleString("ar-EG")}</b><small>كورس منشور</small></span></article>
            <article><Users size={18} /><span><b>{totalStudents.toLocaleString("ar-EG")}</b><small>اشتراك طلاب</small></span></article>
          </div>
          <div className={styles.heroProgress}><span><b>جاهزية المحتوى</b><small>{items.length ? "مكتبتك تعمل الآن" : "ابدأ بأول كورس"}</small></span><i><b style={{ width: items.length ? "78%" : "18%" }} /></i></div>
        </div>
      </section>

      {canManage ? <details className={styles.creator} id="create-course">
        <summary><span className={styles.creatorIcon}><Plus size={21} /></span><span className={styles.creatorCopy}><b>إنشاء كورس جديد</b><small>أدخل البيانات الأساسية وارفع صورة الكورس ثم ابدأ إضافة المحتوى.</small></span><span className={styles.creatorAction}>فتح النموذج <ChevronDown size={18} /></span></summary>
        <CourseForm />
      </details> : null}

      <CourseHub key={items.map((item) => item.id).join(":")} initialCourses={items} canManage={canManage} />
    </div>
  </DashboardShell>;
}
