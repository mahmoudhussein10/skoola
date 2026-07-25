"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Check, Edit3, Eye, EyeOff, Layers3, Search, Users, WalletCards, X } from "lucide-react";
import { CourseImageField, CourseThumbnail } from "../../course-thumbnail";

type CourseItem = {
  id: string; title: string; slug: string; description: string; grade: "FIRST_SECONDARY" | "SECOND_SECONDARY" | "THIRD_SECONDARY";
  subject: string; price: number; thumbnailUrl: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; sections: number; enrollments: number;
};
const grades = { FIRST_SECONDARY: "الأول الثانوي", SECOND_SECONDARY: "الثاني الثانوي", THIRD_SECONDARY: "الثالث الثانوي" } as const;
const statusText = { DRAFT: "مسودة", PUBLISHED: "منشور", ARCHIVED: "مؤرشف" } as const;

export function CourseHub({ initialCourses, canManage }: { initialCourses: CourseItem[]; canManage: boolean }) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [editing, setEditing] = useState<CourseItem | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const created = (event: Event) => {
      const course = (event as CustomEvent).detail;
      setCourses((items) => [{ ...course, price: Number(course.price), sections: 0, enrollments: 0 }, ...items.filter((item) => item.id !== course.id)]);
    };
    window.addEventListener("course-created", created);
    return () => window.removeEventListener("course-created", created);
  }, []);

  const visible = useMemo(() => courses.filter((course) => [course.title, course.subject, course.slug].some((value) => value.toLowerCase().includes(query.toLowerCase()))), [courses, query]);
  const totals = { published: courses.filter((c) => c.status === "PUBLISHED").length, students: courses.reduce((sum, c) => sum + c.enrollments, 0), lessons: courses.reduce((sum, c) => sum + c.sections, 0) };

  async function toggle(course: CourseItem) {
    const nextStatus = course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBusyId(course.id); setNotice("");
    setCourses((items) => items.map((item) => item.id === course.id ? { ...item, status: nextStatus } : item));
    const response = await fetch("/api/teacher/courses", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId: course.id, status: nextStatus }) });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setCourses((items) => items.map((item) => item.id === course.id ? course : item));
      setNotice(result?.message ?? "تعذر تغيير حالة الكورس");
    } else {
      setNotice(nextStatus === "PUBLISHED" ? "تم نشر الكورس للطلاب فورًا" : "تم إخفاء الكورس من صفحة الطلاب");
      router.refresh();
    }
    setBusyId(null);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusyId(editing.id); setNotice("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const payload = { ...data, courseId: editing.id, price: Number(data.price) };
    const response = await fetch("/api/teacher/courses", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok) setNotice(result?.message ?? "تعذر حفظ التعديلات");
    else {
      setCourses((items) => items.map((item) => item.id === editing.id ? { ...item, ...result.course, price: Number(result.course.price) } : item));
      setNotice("تم حفظ تعديلات الكورس");
      setEditing(null);
      router.refresh();
    }
    setBusyId(null);
  }

  return <section className="courseWorkspace">
    <div className="courseMetrics">
      <article><i className="blue"><BookOpen /></i><span>إجمالي الكورسات<b>{courses.length.toLocaleString("en-US")}</b></span></article>
      <article><i className="green"><Eye /></i><span>منشور للطلاب<b>{totals.published.toLocaleString("en-US")}</b></span></article>
      <article><i className="violet"><Users /></i><span>إجمالي الاشتراكات<b>{totals.students.toLocaleString("en-US")}</b></span></article>
      <article><i className="orange"><Layers3 /></i><span>الوحدات التعليمية<b>{totals.lessons.toLocaleString("en-US")}</b></span></article>
    </div>
    <div className="courseToolbar"><div><h2>مكتبة الكورسات</h2><p>عدّل وانشر وتابع أداء كل كورس من مكان واحد.</p></div><label><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث عن كورس..." /></label></div>
    {notice ? <div className="courseNotice"><Check size={16}/>{notice}<button onClick={() => setNotice("")} aria-label="إغلاق"><X size={15}/></button></div> : null}
    {visible.length ? <div className="courseAdminGrid">{visible.map((course, index) => <article className="courseAdminCard" key={course.id}>
      <div className={`courseAdminArt tone${index % 4}`}><span className={`courseStatusBadge ${course.status.toLowerCase()}`}>{statusText[course.status]}</span>{course.thumbnailUrl ? <CourseThumbnail src={course.thumbnailUrl} alt={course.title} /> : <><div className="courseAdminGlyph">{course.subject.slice(0, 2)}</div><small>{course.subject}</small><i/><em/></>}</div>
      <div className="courseAdminBody"><span className="courseGrade">{grades[course.grade]}</span><h3>{course.title}</h3><p>{course.description}</p>
        <div className="courseCardStats"><span><Layers3 size={15}/><b>{course.sections}</b> وحدات</span><span><Users size={15}/><b>{course.enrollments}</b> طلاب</span><span><WalletCards size={15}/><b>{course.price.toLocaleString("en-US")}</b> ج.م</span></div>
        {canManage ? <div className="courseCardActions">
          <a className="courseActionBtn primaryAction" href={`/teacher/courses/${course.id}`}><Layers3 size={16}/> إدارة المحتوى والدروس</a>
          <div className="courseActionSubRow">
            <button className="courseActionBtn editAction" onClick={() => setEditing(course)}><Edit3 size={15}/> تعديل الكورس</button>
            <button className="courseActionBtn toggleAction" disabled={busyId === course.id} onClick={() => toggle(course)}>{course.status === "PUBLISHED" ? <EyeOff size={15}/> : <Eye size={15}/>} {busyId === course.id ? "جارٍ..." : course.status === "PUBLISHED" ? "إخفاء" : "نشر"}</button>
          </div>
        </div> : null}
      </div>
    </article>)}</div> : <div className="courseLibraryEmpty"><BookOpen size={30}/><h3>{query ? "لا توجد نتائج مطابقة" : "ابدأ بأول كورس"}</h3><p>{query ? "جرّب كلمة بحث أخرى." : "أنشئ كورسًا جديدًا وسيظهر هنا وفي صفحة الطلاب بعد النشر."}</p></div>}
    {editing ? <div className="courseEditOverlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditing(null)}><form className="courseEditSheet" onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="edit-course-title"><header><div><span>تعديل الكورس</span><h2 id="edit-course-title">{editing.title}</h2></div><button type="button" onClick={() => setEditing(null)} aria-label="إغلاق"><X/></button></header><div className="courseEditFields">
      <label>عنوان الكورس<input name="title" defaultValue={editing.title} minLength={3} required /></label><label>الرابط المختصر<input name="slug" dir="ltr" defaultValue={editing.slug} pattern="[a-z0-9-]+" required /></label>
      <label>الصف<select name="grade" defaultValue={editing.grade}>{Object.entries(grades).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>المادة<input name="subject" defaultValue={editing.subject} required /></label>
      <label>السعر<input name="price" type="number" min="0" defaultValue={editing.price} required /></label><label>الحالة<select name="status" defaultValue={editing.status}><option value="PUBLISHED">منشور</option><option value="DRAFT">مسودة</option><option value="ARCHIVED">مؤرشف</option></select></label>
      <CourseImageField initialUrl={editing.thumbnailUrl} courseId={editing.id} /><label className="wide">وصف الكورس<textarea name="description" defaultValue={editing.description} minLength={10} required /></label>
    </div><footer><button type="button" className="cancel" onClick={() => setEditing(null)}>إلغاء</button><button className="save" disabled={busyId === editing.id}>{busyId === editing.id ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></footer></form></div> : null}
  </section>;
}
