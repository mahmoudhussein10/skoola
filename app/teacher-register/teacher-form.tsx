"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function TeacherSignupForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/teacher-signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...data, acceptedTerms: data.acceptedTerms === "on" }),
    });
    const result = await response.json().catch(() => ({ message: "تعذر إنشاء الحساب" }));
    setLoading(false);
    if (!response.ok) return setMessage(result.message);
    router.push(result.redirectTo);
  }

  return <form className="authForm registerForm" onSubmit={submit}>
    <div className="fieldGrid">
      <label>اسم المدرس<input name="fullName" required autoComplete="name" /></label>
      <label>اسم المستخدم<input name="username" required dir="ltr" autoComplete="username" /></label>
      <label>البريد الإلكتروني<input name="email" required type="email" dir="ltr" autoComplete="email" /></label>
      <label>رقم الهاتف<input name="phone" required type="tel" dir="ltr" placeholder="01XXXXXXXXX" /></label>
      <label>اسم المنصة<input name="platformName" required placeholder="أكاديمية الأستاذ..." /></label>
      <label>رابط المنصة<input name="slug" required dir="ltr" placeholder="ahmed-academy" pattern="[a-z0-9-]+" /></label>
      <label>المادة أو التخصص<input name="subject" required placeholder="الرياضيات" /></label>
      <span />
      <label>كلمة المرور<input name="password" required type="password" minLength={10} autoComplete="new-password" /></label>
      <label>تأكيد كلمة المرور<input name="confirmPassword" required type="password" minLength={10} autoComplete="new-password" /></label>
    </div>
    <label className="check"><input name="acceptedTerms" type="checkbox" required /> أوافق على شروط الاستخدام وسياسة الخصوصية</label>
    {message ? <p className="formError">{message}</p> : null}
    <button className="btn primary authSubmit" disabled={loading}>{loading ? "جارٍ إنشاء منصتك…" : "إنشاء منصة المدرس ←"}</button>
  </form>;
}
