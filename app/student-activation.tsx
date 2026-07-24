"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StudentActivation() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage(""); setSuccess(false);
    try {
      const response = await fetch("/api/student/activate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const result = await response.json();
      setSuccess(response.ok);
      setMessage(response.ok ? result.alreadyActive ? "الكورس موجود بالفعل في حسابك." : `تم تفعيل ${result.courseTitle} وإضافته إلى كورساتك.` : result.message ?? "تعذر تفعيل الكود");
      if (response.ok) { setCode(""); router.refresh(); }
    } catch { setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى"); } finally { setLoading(false); }
  }
  return <div id="activate-course" className="activationStrip"><div><span>لديك كود تفعيل؟</span><b>أضف كورسك إلى حسابك فورًا</b><small>أدخل الكود الذي حصلت عليه من المدرس.</small></div><form onSubmit={activate}><input suppressHydrationWarning value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} dir="ltr" autoComplete="off" placeholder="XXXX-XXXX-XXXX" aria-label="كود تفعيل الكورس" required /><button suppressHydrationWarning disabled={loading}>{loading ? "جارٍ التفعيل…" : "تفعيل الكورس"}</button></form>{message ? <p className={success ? "success" : "error"} role="status">{message}</p> : null}</div>;
}
