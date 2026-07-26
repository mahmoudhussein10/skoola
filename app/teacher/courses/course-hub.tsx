"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArrowUpLeft, BookOpen, Check, CheckCircle2, Clock3, Edit3, Eye, EyeOff, GraduationCap, Layers3, Plus, Search, Sparkles, Users, X } from "lucide-react";
import { CourseImageField, CourseThumbnail } from "../../course-thumbnail";
import styles from "./course-studio.module.css";

type CourseItem = {
  id: string;
  title: string;
  slug: string;
  description: string;
  grade: "FIRST_SECONDARY" | "SECOND_SECONDARY" | "THIRD_SECONDARY";
  subject: string;
  price: number;
  thumbnailUrl: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sections: number;
  enrollments: number;
};

const grades = {
  FIRST_SECONDARY: "الأول الثانوي",
  SECOND_SECONDARY: "الثاني الثانوي",
  THIRD_SECONDARY: "الثالث الثانوي",
} as const;

const statusText = { DRAFT: "مسودة", PUBLISHED: "منشور", ARCHIVED: "مؤرشف" } as const;

export function CourseHub({ initialCourses, canManage }: { initialCourses: CourseItem[]; canManage: boolean }) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [editing, setEditing] = useState<CourseItem | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const created = (event: Event) => {
      const course = (event as CustomEvent).detail;
      setCourses((items) => [{ ...course, price: Number(course.price), sections: 0, enrollments: 0 }, ...items.filter((item) => item.id !== course.id)]);
    };
    window.addEventListener("course-created", created);
    return () => window.removeEventListener("course-created", created);
  }, []);

  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditing(null);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [editing]);

  const visible = useMemo(() => courses.filter((course) => [course.title, course.subject, course.slug].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [courses, query]);
  const totals = {
    published: courses.filter((course) => course.status === "PUBLISHED").length,
    students: courses.reduce((sum, course) => sum + course.enrollments, 0),
    lessons: courses.reduce((sum, course) => sum + course.sections, 0),
  };

  async function toggle(course: CourseItem) {
    const nextStatus = course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBusyId(course.id);
    setNotice(null);
    setCourses((items) => items.map((item) => item.id === course.id ? { ...item, status: nextStatus } : item));
    const response = await fetch("/api/teacher/courses", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId: course.id, status: nextStatus }) });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setCourses((items) => items.map((item) => item.id === course.id ? course : item));
      setNotice({ type: "error", text: result?.message ?? "تعذر تغيير حالة الكورس" });
    } else {
      setNotice({ type: "success", text: nextStatus === "PUBLISHED" ? "تم نشر الكورس للطلاب بنجاح وأصبح ظاهرًا على المنصة." : "تم إخفاء الكورس من صفحة الطلاب وحفظه كمسودة." });
      router.refresh();
    }
    setBusyId(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id);
    setNotice(null);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...data, courseId: editing.id, price: Number(data.price) };
    const response = await fetch("/api/teacher/courses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setNotice({ type: "error", text: result?.message ?? "تعذر حفظ التعديلات" });
    } else {
      setCourses((items) => items.map((item) => item.id === editing.id ? { ...item, ...result.course, price: Number(result.course.price) } : item));
      setNotice({ type: "success", text: result.course.status === "PUBLISHED" ? "تم حفظ التعديلات ونشر الكورس للطلاب بنجاح." : "تم حفظ تعديلات الكورس كمسودة بنجاح." });
      setEditing(null);
      router.refresh();
    }
    setBusyId(null);
  }

  const metrics = [
    { label: "إجمالي الكورسات", value: courses.length, note: "داخل مكتبتك", icon: BookOpen, tone: styles.blueMetric },
    { label: "الكورسات المنشورة", value: totals.published, note: "متاحة للطلاب", icon: CheckCircle2, tone: styles.greenMetric },
    { label: "اشتراكات الطلاب", value: totals.students, note: "عبر كل الكورسات", icon: Users, tone: styles.violetMetric },
    { label: "الوحدات التعليمية", value: totals.lessons, note: "محتوى منظم", icon: Layers3, tone: styles.orangeMetric },
  ];

  return <section className={styles.workspace} aria-labelledby="course-library-title">
    <div className={styles.metrics}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return <article className={styles.metric} key={metric.label}>
          <span className={metric.tone}><Icon size={21} /></span>
          <div><small>{metric.label}</small><b>{metric.value.toLocaleString("ar-EG")}</b><em>{metric.note}</em></div>
        </article>;
      })}
    </div>

    <div className={styles.librarySurface}>
      <header className={styles.libraryHeader}>
        <div>
          <span className={styles.sectionLabel}><Sparkles size={15} /> مكتبة المحتوى</span>
          <h2 id="course-library-title">كورسات الأكاديمية</h2>
          <p>راجع حالة كل كورس وانتقل إلى المحتوى أو التعديل من مكان واحد.</p>
        </div>
        <label className={`${styles.search} dashboardSearchControl`}>
          <Search size={19} aria-hidden="true" />
          <span className="srOnly">البحث في الكورسات</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم أو المادة..." type="search" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="مسح البحث"><X size={16} /></button> : null}
        </label>
      </header>

      {notice ? <div className={notice.type === "success" ? styles.successNotice : styles.errorNotice} role="status" aria-live="polite">
        <span><Check size={18} /></span><p>{notice.text}</p><button type="button" onClick={() => setNotice(null)} aria-label="إغلاق الرسالة"><X size={17} /></button>
      </div> : null}

      {visible.length ? <div className={styles.courseGrid}>
        {visible.map((course, index) => {
          const StatusIcon = course.status === "PUBLISHED" ? CheckCircle2 : course.status === "ARCHIVED" ? Archive : Clock3;
          return <article className={styles.courseCard} key={course.id}>
            <div className={styles.courseCover}>
              <span className={course.status === "PUBLISHED" ? styles.publishedBadge : course.status === "ARCHIVED" ? styles.archivedBadge : styles.draftBadge}><StatusIcon size={14} /> {statusText[course.status]}</span>
              {course.thumbnailUrl ? <CourseThumbnail src={course.thumbnailUrl} alt={course.title} /> : <div className={styles.coverFallback + " " + styles["tone" + (index % 4)]}><span>{course.subject.slice(0, 2)}</span><small>{course.subject}</small><BookOpen size={82} /></div>}
              <div className={styles.coverMeta}><span>{grades[course.grade]}</span><b>{course.subject}</b></div>
            </div>

            <div className={styles.courseBody}>
              <div className={styles.courseTitleRow}>
                <div><span>{course.slug}</span><h3>{course.title}</h3></div>
                <span className={styles.price}>{course.price.toLocaleString("ar-EG")} <small>ج.م</small></span>
              </div>
              <p className={styles.description}>{course.description}</p>

              <div className={styles.cardStats}>
                <span><i><Layers3 size={17} /></i><b>{course.sections.toLocaleString("ar-EG")}</b><small>وحدات</small></span>
                <span><i><GraduationCap size={17} /></i><b>{course.enrollments.toLocaleString("ar-EG")}</b><small>طالب</small></span>
                <span><i><Eye size={17} /></i><b>{course.status === "PUBLISHED" ? "ظاهر" : "مخفي"}</b><small>على المنصة</small></span>
              </div>

              {canManage ? <div className={styles.cardActions}>
                <Link className={styles.manageAction} href={'/teacher/courses/' + course.id}><Layers3 size={18} /><span>إدارة المحتوى والدروس</span><ArrowUpLeft size={17} /></Link>
                <div>
                  <button className={styles.editAction} type="button" onClick={() => setEditing(course)}><Edit3 size={16} /> تعديل</button>
                  <button className={styles.visibilityAction} type="button" disabled={busyId === course.id} onClick={() => toggle(course)}>
                    {course.status === "PUBLISHED" ? <EyeOff size={16} /> : <Eye size={16} />}
                    {busyId === course.id ? "جارٍ الحفظ..." : course.status === "PUBLISHED" ? "إخفاء" : "نشر"}
                  </button>
                </div>
              </div> : null}
            </div>
          </article>;
        })}
      </div> : <div className={styles.emptyState}>
        <span className={styles.emptyVisual}><BookOpen size={34} /><i /><b /></span>
        <span className={styles.emptyLabel}>{query ? "لا توجد نتيجة مطابقة" : "مكتبتك جاهزة"}</span>
        <h3>{query ? "لم نعثر على هذا الكورس" : "ابدأ بصناعة أول كورس"}</h3>
        <p>{query ? "جرّب البحث باسم آخر أو امسح كلمة البحث لعرض جميع الكورسات." : "أنشئ الكورس، أضف وحداته ودروسه ثم انشره لطلابك عندما يصبح جاهزًا."}</p>
        {query ? <button type="button" onClick={() => setQuery("")}>عرض كل الكورسات</button> : canManage ? <a href="#create-course"><Plus size={17} /> إنشاء أول كورس</a> : null}
      </div>}
    </div>

    {editing ? createPortal(<div className={styles.editOverlay} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}>
      <form key={editing.id} className={styles.editSheet} onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="edit-course-title">
        <header><div><span>تعديل بيانات الكورس</span><h2 id="edit-course-title">{editing.title}</h2><p>حدّث البيانات والصورة وحالة الظهور ثم احفظ التعديلات.</p></div><button type="button" onClick={() => setEditing(null)} aria-label="إغلاق"><X size={21} /></button></header>
        <div className={styles.editFields}>
          <label>عنوان الكورس<input name="title" defaultValue={editing.title} minLength={3} required autoFocus /></label>
          <label>الرابط المختصر<input name="slug" dir="ltr" defaultValue={editing.slug} pattern="[a-z0-9-]+" required /></label>
          <label>الصف<select name="grade" defaultValue={editing.grade}>{Object.entries(grades).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>المادة<input name="subject" defaultValue={editing.subject} required /></label>
          <label>السعر<input name="price" type="number" min="0" defaultValue={editing.price} required /></label>
          <label>الحالة<select name="status" defaultValue={editing.status}><option value="PUBLISHED">منشور</option><option value="DRAFT">مسودة</option><option value="ARCHIVED">مؤرشف</option></select></label>
          <div className={styles.imageField}><CourseImageField initialUrl={editing.thumbnailUrl} courseId={editing.id} /></div>
          <label className={styles.wideField}>وصف الكورس<textarea name="description" defaultValue={editing.description} minLength={10} required /></label>
        </div>
        <footer><button type="button" className={styles.cancelEdit} onClick={() => setEditing(null)}>إلغاء</button><button className={styles.saveEdit} disabled={busyId === editing.id}>{busyId === editing.id ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></footer>
      </form>
    </div>, document.body) : null}
  </section>;
}
