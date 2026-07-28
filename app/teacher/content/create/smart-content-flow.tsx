"use client";

import { FormEvent, useState } from "react";
import { ArrowLeft, BookOpen, CheckCircle2, ClipboardCheck, Layers3, Loader2, PlayCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import styles from "./smart-content-flow.module.css";

type Mode = "lesson" | "exam";
type CourseOption = { id: string; title: string };
type UnitOption = { id: string; title: string };

type Props = {
  mode: Mode;
  courses: CourseOption[];
  activeCourse?: CourseOption;
  units: UnitOption[];
};

function buildTarget(mode: Mode, courseId: string, unitId?: string) {
  const query = new URLSearchParams({ intent: mode });
  if (unitId) query.set("sectionId", unitId);
  return `/teacher/courses/${courseId}?${query.toString()}`;
}

async function readResult(response: Response) {
  return response.json().catch(() => null) as Promise<{ message?: string; course?: CourseOption; section?: UnitOption } | null>;
}

export function SmartContentFlow({ mode, courses, activeCourse, units }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [createdCourse, setCreatedCourse] = useState<CourseOption | null>(null);
  const isLesson = mode === "lesson";
  const currentCourse = createdCourse ?? activeCourse;
  const ModeIcon = isLesson ? PlayCircle : ClipboardCheck;

  function selectCourse(courseId: string) {
    if (!courseId) return;
    const query = new URLSearchParams({ mode, courseId });
    router.replace(`/teacher/content/create?${query.toString()}`);
  }

  function selectUnit(unitId: string) {
    if (!currentCourse || !unitId) return;
    router.push(buildTarget(mode, currentCourse.id, unitId));
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const unitTitle = String(form.get("unitTitle") ?? "").trim();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/teacher/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          grade: String(form.get("grade") ?? "FIRST_PREPARATORY"),
          slug: `course-${Date.now().toString(36)}`,
          description: `محتوى تعليمي منظم لكورس ${title}`,
          price: 0,
          thumbnailUrl: "",
          status: "DRAFT",
        }),
      });
      const result = await readResult(response);
      if (!response.ok || !result?.course) {
        setMessage(result?.message ?? "تعذر إنشاء الكورس. راجع البيانات وحاول مرة أخرى.");
        return;
      }

      setCreatedCourse(result.course);
      if (!isLesson) {
        router.push(buildTarget(mode, result.course.id));
        return;
      }

      const unitResponse = await fetch(`/api/teacher/courses/${result.course.id}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: unitTitle, description: "" }),
      });
      const unitResult = await readResult(unitResponse);
      if (!unitResponse.ok || !unitResult?.section) {
        setMessage(unitResult?.message ?? "تم إنشاء الكورس، لكن تعذر إنشاء الوحدة. اكتب اسم الوحدة وحاول مرة أخرى.");
        return;
      }
      router.push(buildTarget(mode, result.course.id, unitResult.section.id));
    } catch {
      setMessage("تعذر الاتصال بالخادم. بياناتك ما زالت موجودة؛ حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  async function createUnit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentCourse || loading) return;
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/teacher/courses/${currentCourse.id}/sections`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: String(form.get("unitTitle") ?? "").trim(), description: "" }),
      });
      const result = await readResult(response);
      if (!response.ok || !result?.section) {
        setMessage(result?.message ?? "تعذر إنشاء الوحدة. حاول مرة أخرى.");
        return;
      }
      router.push(buildTarget(mode, currentCourse.id, result.section.id));
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page} dir="rtl">
      <section className={styles.card} aria-labelledby="smart-content-title">
        <header className={styles.header}>
          <span className={styles.icon}><ModeIcon size={24} aria-hidden /></span>
          <div>
            <span className={styles.eyebrow}>إنشاء سريع ومنظم</span>
            <h2 id="smart-content-title">{isLesson ? "إضافة درس جديد" : "إنشاء امتحان جديد"}</h2>
            <p>{isLesson ? "هنحدد مكان الدرس الأول، وبعدها هتكتب بياناته فورًا." : "اختار الكورس، وبعدها هتبدأ تجهيز الامتحان فورًا."}</p>
          </div>
        </header>

        <div className={styles.progress} aria-label="خطوات الإنشاء">
          <span className={styles.active}><b>١</b> تجهيز المحتوى</span>
          <i aria-hidden />
          <span><b>٢</b> بيانات {isLesson ? "الدرس" : "الامتحان"}</span>
        </div>

        {courses.length === 0 && !createdCourse ? (
          <form className={styles.form} onSubmit={createCourse}>
            <div className={styles.notice}><BookOpen size={20} /><div><b>{isLesson ? "قبل إضافة أول درس، هنجهز الكورس والوحدة من نفس المكان." : "قبل إنشاء أول امتحان، هنجهز الكورس من نفس المكان."}</b><p>محتاجين بيانات بسيطة دلوقتي، وتقدر تكمل باقي التفاصيل بعدين.</p></div></div>
            <div className={styles.grid}>
              <label><span>اسم الكورس</span><input name="title" minLength={3} maxLength={120} required autoFocus placeholder="مثال: رياضيات أولى إعدادي" /></label>
              <label><span>الصف الدراسي</span><select name="grade" defaultValue="FIRST_PREPARATORY"><option value="FIRST_PREPARATORY">الأول الإعدادي</option><option value="SECOND_PREPARATORY">الثاني الإعدادي</option><option value="THIRD_PREPARATORY">الثالث الإعدادي</option><option value="FIRST_SECONDARY">الأول الثانوي</option><option value="SECOND_SECONDARY">الثاني الثانوي</option><option value="THIRD_SECONDARY">الثالث الثانوي</option></select></label>
              {isLesson ? <label><span>اسم أول وحدة</span><input name="unitTitle" minLength={2} maxLength={120} required placeholder="مثال: الوحدة الأولى" /></label> : null}
            </div>
            {message ? <p className={styles.error} role="alert">{message}</p> : null}
            <button className={styles.primary} disabled={loading}>{loading ? <Loader2 className={styles.spinner} size={19} /> : <ArrowLeft size={18} />}{loading ? "جاري التجهيز..." : `جهّز وابدأ ${isLesson ? "الدرس" : "الامتحان"}`}</button>
          </form>
        ) : null}

        {courses.length > 1 && !activeCourse ? (
          <div className={styles.selector}>
            <div className={styles.notice}><BookOpen size={20} /><div><b>{isLesson ? "الدرس ده تابع لأنهي كورس؟" : "الامتحان ده تابع لأنهي كورس؟"}</b><p>اختار الكورس علشان نحط المحتوى في مكانه الصحيح.</p></div></div>
            <label><span>اختار الكورس</span><select defaultValue="" onChange={(event) => selectCourse(event.target.value)} autoFocus><option value="" disabled>اضغط لاختيار الكورس</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          </div>
        ) : null}

        {isLesson && currentCourse && units.length === 0 ? (
          <form className={styles.form} onSubmit={createUnit}>
            <div className={styles.selected}><CheckCircle2 size={18} /><span>الكورس المختار: <b>{currentCourse.title}</b></span></div>
            <div className={styles.notice}><Layers3 size={20} /><div><b>الكورس ده لسه مفيهوش وحدات.</b><p>أنشئ أول وحدة وكمل إضافة الدرس من غير ما تخرج من الخطوة دي.</p></div></div>
            <label><span>اسم أول وحدة</span><input name="unitTitle" minLength={2} maxLength={120} required autoFocus placeholder="مثال: الوحدة الأولى" /></label>
            {message ? <p className={styles.error} role="alert">{message}</p> : null}
            <button className={styles.primary} disabled={loading}>{loading ? <Loader2 className={styles.spinner} size={19} /> : <Plus size={18} />}{loading ? "جاري إنشاء الوحدة..." : "أنشئ الوحدة وكمل الدرس"}</button>
          </form>
        ) : null}

        {isLesson && currentCourse && units.length > 1 ? (
          <div className={styles.selector}>
            <div className={styles.selected}><CheckCircle2 size={18} /><span>الكورس المختار: <b>{currentCourse.title}</b></span></div>
            <div className={styles.notice}><Layers3 size={20} /><div><b>الدرس ده جوه أنهي وحدة؟</b><p>اختار الوحدة، وفورم الدرس هيفتح لك مباشرة.</p></div></div>
            <label><span>اختار الوحدة</span><select defaultValue="" onChange={(event) => selectUnit(event.target.value)} autoFocus><option value="" disabled>اضغط لاختيار الوحدة</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.title}</option>)}</select></label>
          </div>
        ) : null}
      </section>
    </main>
  );
}
