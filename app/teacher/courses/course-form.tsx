"use client";

import { FormEvent, useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { CourseImageField } from "../../course-thumbnail";

export function CourseForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/teacher/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))),
      });
      const result = await response.json().catch(() => null);
      setSuccess(response.ok);
      setMessage(result?.message ?? (response.ok ? "تم إنشاء الكورس" : "تعذر إنشاء الكورس"));
      if (response.ok) {
        window.dispatchEvent(new CustomEvent("course-created", { detail: result.course }));
        event.currentTarget.reset();
        setImageVersion((version) => version + 1);
        router.refresh();
      }
    } catch {
      setMessage("تعذر الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  return <form className="courseCreateForm premiumCreateForm" onSubmit={submit}>
    <div className="createFormIntro"><i><Sparkles /></i><div><h3>بيانات الكورس الجديد</h3><p>اكتب بيانات واضحة للطالب، ويمكنك تعديلها لاحقًا.</p></div></div>
    <div className="fieldGrid">
      <label>عنوان الكورس<input name="title" placeholder="اكتب عنوان الكورس" required /></label>
      <label>الرابط المختصر<input name="slug" dir="ltr" placeholder="course-name" required pattern="[a-z0-9-]+" /></label>
      <label>الصف الدراسي<select name="grade"><option value="FIRST_SECONDARY">الأول الثانوي</option><option value="SECOND_SECONDARY">الثاني الثانوي</option><option value="THIRD_SECONDARY">الثالث الثانوي</option></select></label>
      <label>المادة الدراسية<input name="subject" placeholder="اكتب اسم المادة" required /></label>
      <label>السعر بالجنيه<input name="price" type="number" min="0" defaultValue="0" required dir="ltr" /></label>
      <label>الظهور للطلاب<select name="status" defaultValue="PUBLISHED"><option value="PUBLISHED">منشور — يظهر فورًا</option><option value="DRAFT">مسودة — مخفي</option></select></label>
    </div>
    <CourseImageField key={imageVersion} />
    <label>وصف الكورس<textarea name="description" placeholder="ماذا سيتعلم الطالب داخل هذا الكورس؟" minLength={10} required /></label>
    <div className="courseFormActions"><button className="createCourseSubmit" disabled={loading}><Plus size={18} />{loading ? "جارٍ إنشاء الكورس…" : "إنشاء الكورس"}</button>{message ? <span className={success ? "success" : "error"} role="status">{message}</span> : null}</div>
  </form>;
}