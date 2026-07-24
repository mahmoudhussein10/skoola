"use client";

import { useState } from "react";

export function StaffAcceptanceForm({ token, email }: { token: string; email: string }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/auth/staff-invite/" + encodeURIComponent(token), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return setMessage(result?.message ?? "تعذر قبول الدعوة");
    window.location.href = result.redirectTo;
  }
  return <form className="authForm" onSubmit={submit}><label>البريد<input name="email" dir="ltr" value={email} readOnly /></label><label>الاسم الكامل<input name="fullName" minLength={3} maxLength={100} required /></label><div className="fieldGrid"><label>اسم المستخدم<input name="username" dir="ltr" pattern="[a-zA-Z0-9_]{3,30}" required /></label><label>رقم الهاتف<input name="phone" dir="ltr" pattern="01[0125][0-9]{8}" required /></label><label>كلمة المرور<input name="password" type="password" minLength={10} maxLength={128} required /></label><label>تأكيد كلمة المرور<input name="confirmPassword" type="password" minLength={10} maxLength={128} required /></label></div><button className="btn primary authSubmit" disabled={loading}>{loading ? "جارٍ إنشاء الحساب…" : "قبول الدعوة وإنشاء الحساب"}</button>{message ? <p className="formError">{message}</p> : null}</form>;
}