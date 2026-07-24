"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { Brand } from "../ui";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true);
    const identifier = new FormData(event.currentTarget).get("identifier");
    try { const response = await fetch("/api/auth/forgot-password", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ identifier }) }); const result = await response.json(); setMessage(result.message); }
    catch { setMessage("تعذر الاتصال بالخادم"); } finally { setLoading(false); }
  }
  return <main className="simpleAuth"><Brand /><section className="panel"><span className="tag orange">استعادة الحساب</span><h1>نسيت كلمة المرور؟</h1><p>أدخل البريد الإلكتروني أو رقم الهاتف المرتبط بالحساب.</p><form className="authForm" onSubmit={submit}><label>البريد أو رقم الهاتف<input name="identifier" required /></label>{message && <p className="formNotice">{message}</p>}<button className="btn primary authSubmit" disabled={loading}>{loading ? "جارٍ الإرسال…" : "إرسال تعليمات الاستعادة"}</button></form><Link className="backLink" href="/login">← العودة لتسجيل الدخول</Link></section></main>;
}
