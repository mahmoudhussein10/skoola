"use client";

import { FormEvent, useState } from "react";
import { Plus, Sparkles } from "lucide-react";

import { CourseImageField } from "../../course-thumbnail";

export function CourseForm() {

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form));
    setLoading(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/teacher/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage(result?.message ?? "تعذر إنشاء الكورس. راجع البيانات وحاول مرة أخرى.");
        return;
      }
      setSuccess(true);
      const published = result?.course?.status === "PUBLISHED";
      setMessage(published ? "تم إنشاء الكورس ونشره للطلاب بنجاح." : "تم إنشاء الكورس وحفظه كمسودة بنجاح.");
      window.dispatchEvent(new CustomEvent("course-created", { detail: result.course }));
      form.reset();
      setImageVersion((version) => version + 1);
    } catch {
      setMessage("تعذر الاتصال بالخادم. بياناتك ما زالت موجودة؛ حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return <form className="courseCreateForm premiumCreateForm" onSubmit={submit}>
    <div className="createFormIntro"><i><Sparkles /></i><div><h3>بيانات الكورس الجديد</h3><p>اكتب بيانات واضحة للطالب، ويمكنك تعديلها لاحقًا.</p></div></div>
    <div className="fieldGrid">
      <label>عنوان الكورس<input name="title" placeholder="اكتب عنوان الكورس" required /></label>
      <label>الرابط المختصر<input name="slug" dir="ltr" placeholder="course-name" required pattern="[a-z0-9-]+" /></label>
      <label>الصف الدراسي<select name="grade"><option value="FIRST_PREPARATORY">الأول الإعدادي</option><option value="SECOND_PREPARATORY">الثاني الإعدادي</option><option value="THIRD_PREPARATORY">الثالث الإعدادي</option><option value="FIRST_SECONDARY">الأول الثانوي</option><option value="SECOND_SECONDARY">الثاني الثانوي</option><option value="THIRD_SECONDARY">الثالث الثانوي</option></select></label>
      <label>المادة الدراسية<input name="subject" placeholder="اكتب اسم المادة" required /></label>
      <label>السعر بالجنيه<input name="price" type="number" min="0" defaultValue="0" required dir="ltr" /></label>
      <label>الظهور للطلاب<select name="status" defaultValue="PUBLISHED"><option value="PUBLISHED">منشور — يظهر فورًا</option><option value="DRAFT">مسودة — مخفي</option></select></label>
    </div>
    <CourseImageField key={imageVersion} />
    <label>وصف الكورس<textarea name="description" placeholder="ماذا سيتعلم الطالب داخل هذا الكورس؟" minLength={10} required /></label>
    <div className="courseFormActions"><button className="createCourseSubmit" disabled={loading}><Plus size={18} />{loading ? "جارٍ إنشاء الكورس…" : "إنشاء الكورس"}</button>{message ? <span className={success ? "success" : "error"} role="status">{message}</span> : null}</div>
  </form>;
}