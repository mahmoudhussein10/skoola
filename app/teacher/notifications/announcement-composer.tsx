"use client";

import { useState } from "react";
import { BellRing, Eye, LoaderCircle, Send, X } from "lucide-react";

const categories = [
  ["COURSE_CONTENT", "محتوى الكورسات"],
  ["EXAMS", "الامتحانات"],
  ["RESULTS", "النتائج"],
  ["ENROLLMENTS", "الاشتراكات"],
  ["PAYMENTS", "المدفوعات"],
  ["ADMINISTRATIVE", "إداري"],
] as const;

export function AnnouncementComposer({ courses }: { courses: Array<{ id: string; title: string }> }) {
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "ADMINISTRATIVE",
    audience: "ALL_STUDENTS",
    courseId: "",
    internalUrl: "",
  });
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function send() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/teacher/notifications/announce", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, requestId: crypto.randomUUID(), courseId: form.courseId || null, internalUrl: form.internalUrl || null }),
      });
      const data = await response.json().catch(() => ({ ok: false, message: "تعذر الاتصال بالخادم" }));
      if (!response.ok || !data.ok) throw new Error(data.message || "تعذر إرسال الإعلان");
      setMessage(`تم الإرسال إلى ${Number(data.recipientCount).toLocaleString("en-US")} حساب`);
      setForm({ title: "", body: "", category: "ADMINISTRATIVE", audience: "ALL_STUDENTS", courseId: "", internalUrl: "" });
      setPreview(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر إرسال الإعلان");
    } finally {
      setBusy(false);
    }
  }

  return <section className="academyAnnouncementComposer" dir="rtl">
    <header><i><BellRing size={22}/></i><div><span>إعلان الأكاديمية</span><h3>أرسل تنبيهًا حقيقيًا لجمهور محدد</h3><p>سيظهر داخل مركز الإشعارات، ويصل Push للأجهزة المفعّلة فقط.</p></div></header>
    <div className="announcementFormGrid">
      <label>العنوان<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={120} placeholder="مثال: مراجعة مهمة قبل الامتحان"/></label>
      <label>التصنيف<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>الجمهور<select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value, courseId: "" })}><option value="ALL_STUDENTS">كل الطلاب النشطين</option><option value="COURSE_STUDENTS">طلاب كورس محدد</option><option value="STAFF">فريق الأكاديمية</option></select></label>
      {form.audience === "COURSE_STUDENTS" ? <label>الكورس<select value={form.courseId} onChange={(event) => setForm({ ...form, courseId: event.target.value })}><option value="">اختر الكورس</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label> : null}
      <label className="announcementBodyField">نص الإعلان<textarea rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} maxLength={600} placeholder="اكتب رسالة واضحة ومختصرة بدون بيانات حساسة أو روابط خارجية"/><small dir="ltr">{form.body.length.toLocaleString("en-US")} / 600</small></label>
      <label className="announcementUrlField">رابط داخلي اختياري<input dir="ltr" value={form.internalUrl} onChange={(event) => setForm({ ...form, internalUrl: event.target.value })} placeholder="/teacher أو /course?courseId=..."/></label>
    </div>
    <div className="announcementActions"><button className="btn secondary" type="button" onClick={() => setPreview(true)} disabled={!form.title.trim() || !form.body.trim()}><Eye size={17}/>معاينة وتأكيد</button></div>
    {message ? <p className="announcementMessage" role="status">{message}</p> : null}
    {preview ? <div className="announcementPreviewBackdrop"><section role="dialog" aria-modal="true" aria-labelledby="announcement-preview-title"><button className="announcementPreviewClose" aria-label="إغلاق المعاينة" onClick={() => setPreview(false)}><X size={18}/></button><i><BellRing size={22}/></i><span>معاينة الإعلان</span><h3 id="announcement-preview-title">{form.title}</h3><p>{form.body}</p><small>لن تتضمن رسالة Push أي بيانات إضافية غير الظاهرة هنا.</small><div><button className="btn primary" onClick={send} disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>}تأكيد الإرسال</button><button className="btn secondary" onClick={() => setPreview(false)} disabled={busy}>العودة للتعديل</button></div></section></div> : null}
  </section>;
}
