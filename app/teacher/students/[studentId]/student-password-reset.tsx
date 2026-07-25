"use client";

import { useState } from "react";
import { CheckCircle2, Copy, KeyRound, ShieldAlert, X } from "lucide-react";

type ResetResult = { temporaryPassword: string; message: string };

export function StudentPasswordReset({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResetResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function resetPassword() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/teacher/students/${studentId}/reset-password`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.message ?? "تعذر إعادة تعيين كلمة المرور");
        return;
      }
      setResult({ temporaryPassword: data.temporaryPassword, message: data.message });
      setConfirming(false);
    } catch {
      setError("تعذر الاتصال بالخادم. لم يتم تغيير كلمة المرور.");
    } finally {
      setLoading(false);
    }
  }

  async function copyPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.temporaryPassword);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return <section className="studentResetCard">
    <div className="studentResetIntro"><i><KeyRound size={22} /></i><div><span>مساعدة الطالب في الدخول</span><h3>إعادة تعيين كلمة المرور</h3><p>أنشئ كلمة مرور جديدة للطالب عند نسيان كلمة المرور. سيتم إنهاء جلساته القديمة لحماية الحساب.</p></div></div>
    {!result ? <button className="btn secondary resetPasswordTrigger" onClick={() => setConfirming(true)}><KeyRound size={17} /> إنشاء كلمة مرور جديدة</button> : <div className="temporaryPasswordResult" role="status"><CheckCircle2 size={21} /><div><b>تمت إعادة التعيين بنجاح</b><p>{result.message}</p><div><code dir="ltr">{result.temporaryPassword}</code><button onClick={copyPassword}><Copy size={16} /> {copied ? "تم النسخ" : "نسخ"}</button></div><small>أرسلها إلى {studentName} عبر وسيلة آمنة؛ لن تظهر لك هذه الكلمة مرة أخرى بعد مغادرة الصفحة.</small></div></div>}
    {error ? <p className="studentResetError" role="alert">{error}</p> : null}
    {confirming ? <div className="resetConfirmBox"><button className="resetConfirmClose" onClick={() => setConfirming(false)} aria-label="إغلاق"><X size={17} /></button><ShieldAlert size={25} /><div><b>تأكيد إعادة تعيين كلمة المرور</b><p>سيتم تسجيل خروج {studentName} من كل الأجهزة، ولن تعمل كلمة المرور القديمة.</p></div><div><button className="btn secondary" onClick={() => setConfirming(false)}>إلغاء</button><button className="btn primary" disabled={loading} onClick={resetPassword}>{loading ? "جارٍ إنشاء كلمة المرور…" : "تأكيد وإنشاء كلمة جديدة"}</button></div></div> : null}
  </section>;
}
