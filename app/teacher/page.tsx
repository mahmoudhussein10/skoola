import Link from "next/link";
import { Suspense, type ComponentType } from "react";
import {
  AlertCircle, ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, CreditCard,
  ExternalLink, GraduationCap, ImageIcon, LayoutDashboard, PlayCircle, Plus,
  Settings, Sparkles, Users,
} from "lucide-react";
import { requireTenantMember } from "../../lib/auth";
import { hasPermission, tenantStaffRoles } from "../../lib/permissions";
import { getTeacherDashboardData, type TeacherDashboardAttention } from "../../lib/teacher-dashboard";
import { DashboardShell } from "../dashboard-shell";
import { ActiveAnnouncements } from "../active-announcements";
import { TeacherOnboardingJourneySection } from "./onboarding-journey-section";
import { OnboardingJourneySkeleton } from "./onboarding-journey";
import styles from "./teacher-dashboard.module.css";

type DashboardIcon = ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>;

const attentionIcons: Record<string, DashboardIcon> = {
  payments: CreditCard,
  "published-course": BookOpen,
  logo: ImageIcon,
  "course-images": ImageIcon,
  lessons: PlayCircle,
  exams: ClipboardCheck,
  students: Users,
};

export default async function TeacherDashboard() {
  const context = await requireTenantMember(tenantStaffRoles);
  const canViewAnalytics = hasPermission(context.membership.role, "analytics.view", context.membership.permissions);
  const { tenant, tenantId } = context.membership;

  if (!canViewAnalytics) {
    return (
      <DashboardShell kind="teacher" title="لوحة التحكم" subtitle={tenant.name} userName={context.user.fullName} tenantSlug={tenant.slug} supportMode={context.supportMode}>
        <section className={styles.restrictedWelcome}>
          <span><Sparkles size={16} /> مساحة عملك</span>
          <h2>مرحبًا، {context.user.fullName}</h2>
          <p>تظهر لك الأدوات المتاحة وفقًا لصلاحيات حسابك داخل الأكاديمية.</p>
          <div>
            <Link href="/teacher/courses"><BookOpen size={17} /> عرض الكورسات</Link>
            {hasPermission(context.membership.role, "students.view", context.membership.permissions) ? <Link href="/teacher/students"><Users size={17} /> عرض الطلاب</Link> : null}
          </div>
        </section>
      </DashboardShell>
    );
  }

  const dashboard = await getTeacherDashboardData(tenantId);
  const summary = [
    { label: "طلاب جدد", value: dashboard.today.newStudents, note: "منذ بداية اليوم", icon: GraduationCap, tone: "blue" },
    { label: "مشاهدات اليوم", value: dashboard.today.lessonViews, note: "دروس فُتحت اليوم", icon: PlayCircle, tone: "violet" },
    { label: "امتحانات اليوم", value: dashboard.today.examAttempts, note: "محاولات بدأت اليوم", icon: ClipboardCheck, tone: "amber" },
    { label: "الكورسات المنشورة", value: dashboard.today.publishedCourses, note: `من إجمالي ${dashboard.totals.courses.toLocaleString("ar-EG")}`, icon: BookOpen, tone: "green" },
  ] as const;

  const quickActions = [
    { label: "إنشاء كورس", href: "/teacher/courses#create-course", icon: Plus },
    { label: "إضافة درس", href: "/teacher/content/create?mode=lesson", icon: PlayCircle },
    { label: "إنشاء امتحان", href: "/teacher/content/create?mode=exam", icon: ClipboardCheck },
    { label: "دعوة طالب", href: "/teacher/students", icon: Users },
    { label: "الإعدادات", href: "/teacher/settings", icon: Settings },
  ];

  return (
    <DashboardShell kind="teacher" title="لوحة التحكم" subtitle={`${tenant.name} — ملخص واضح لما يحدث الآن`} userName={context.user.fullName} tenantSlug={tenant.slug} supportMode={context.supportMode}>
      <ActiveAnnouncements tenantId={tenantId} audience="teacher" />

      <section className={styles.welcome} aria-labelledby="teacher-welcome-title">
        <div className={styles.welcomeCopy}>
          <span><LayoutDashboard size={16} /> نظرة اليوم</span>
          <h2 id="teacher-welcome-title">مرحبًا، {context.user.fullName}</h2>
          <p>{dashboard.welcomeMessage}</p>
        </div>
        <Link href={`/t/${tenant.slug}`} target="_blank" className={styles.academyLink}>عرض الأكاديمية <ExternalLink size={17} /></Link>
      </section>

      <section className={styles.summarySection} aria-labelledby="today-summary-title">
        <header className={styles.sectionHeader}>
          <div><span>ملخص سريع</span><h2 id="today-summary-title">ما حدث اليوم</h2></div>
          <small>بيانات حقيقية ومحدّثة من أكاديميتك</small>
        </header>
        <div className={styles.summaryGrid}>
          {summary.map((item) => {
            const Icon = item.icon;
            return <article className={`${styles.summaryCard} ${styles[item.tone]}`} key={item.label}><i><Icon size={21} aria-hidden /></i><div><span>{item.label}</span><strong>{item.value.toLocaleString("ar-EG")}</strong><small>{item.note}</small></div></article>;
          })}
        </div>
      </section>

      <Suspense fallback={<OnboardingJourneySkeleton />}>
        <TeacherOnboardingJourneySection tenantSlug={tenant.slug} />
      </Suspense>

      {!context.supportMode && dashboard.attention.length > 0 ? (
        <section className={styles.attentionSection} aria-labelledby="attention-title">
          <header className={styles.sectionHeader}><div><span>إجراءات مهمة</span><h2 id="attention-title">يحتاج إلى انتباهك</h2></div><small>مرتبة حسب الأولوية</small></header>
          <div className={styles.attentionList}>{dashboard.attention.map((item) => <AttentionItem item={item} key={item.id} />)}</div>
        </section>
      ) : null}

      {!context.supportMode ? (
        <section className={styles.quickSection} aria-labelledby="quick-actions-title">
          <header className={styles.sectionHeader}><div><span>اختصارات</span><h2 id="quick-actions-title">إجراءات سريعة</h2></div></header>
          <div className={styles.quickGrid}>
            {quickActions.map((item) => { const Icon = item.icon; return <Link href={item.href} key={item.label}><i><Icon size={19} aria-hidden /></i><span>{item.label}</span><ArrowLeft size={16} aria-hidden /></Link>; })}
          </div>
        </section>
      ) : null}

      <section className={styles.activitySection} aria-labelledby="recent-activity-title">
        <header className={styles.sectionHeader}><div><span>آخر التحديثات</span><h2 id="recent-activity-title">النشاط الأخير</h2></div>{dashboard.activities.length ? <small>آخر {dashboard.activities.length.toLocaleString("ar-EG")} أحداث</small> : null}</header>
        {dashboard.activities.length ? (
          <ol className={styles.activityList}>
            {dashboard.activities.map((item) => <li key={item.id}><i><CheckCircle2 size={17} aria-hidden /></i><div><strong>{item.action}</strong><span>{item.actorName} · {item.relativeTime}</span></div></li>)}
          </ol>
        ) : (
          <div className={styles.emptyActivity}>
            <i><Sparkles size={25} aria-hidden /></i>
            <div><h3>لم يبدأ أي نشاط بعد</h3><p>أنشئ أول كورس، وستظهر هنا أهم أحداث الأكاديمية تلقائيًا.</p></div>
            {!context.supportMode ? <Link href="/teacher/courses#create-course">إنشاء أول كورس <ArrowLeft size={16} /></Link> : null}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function AttentionItem({ item }: { item: TeacherDashboardAttention }) {
  const Icon = attentionIcons[item.id] ?? AlertCircle;
  return <article className={`${styles.attentionItem} ${styles[item.tone]}`}><i><Icon size={20} aria-hidden /></i><div><h3>{item.title}</h3><p>{item.description}</p></div><Link href={item.href}>{item.actionLabel} <ArrowLeft size={15} aria-hidden /></Link></article>;
}
