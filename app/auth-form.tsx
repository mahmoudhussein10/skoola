"use client";

import Link from "next/link";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const governorates = ["القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "الغربية", "المنوفية", "القليوبية", "البحيرة", "الفيوم", "بني سويف", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان", "بورسعيد", "السويس", "الإسماعيلية", "دمياط", "كفر الشيخ", "مطروح", "الوادي الجديد", "البحر الأحمر", "شمال سيناء", "جنوب سيناء"];

export function LoginForm({ variant = "default", tenantSlug, portal }: { variant?: "default" | "super-admin"; tenantSlug?: string; portal?: "student" | "teacher" } = {}) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier: data.get("identifier"), password: data.get("password"), remember: data.get("remember") === "on", tenantSlug, portal: variant === "super-admin" ? "super-admin" : (tenantSlug ? "student" : portal) }),
      });
      const result = await response.json();
      if (!response.ok) setMessage(result.message ?? "تعذر تسجيل الدخول");
      else router.push(result.redirectTo);
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى");
    } finally {
      setLoading(false);
    }
  }

  return <form className="authForm" onSubmit={submit} noValidate>
    <label>البريد الإلكتروني أو اسم المستخدم أو رقم الهاتف<input name="identifier" inputMode="text" autoComplete="username" required placeholder="example@email.com" /></label>
    <label>كلمة المرور<div className="passwordField"><input name="password" type={show ? "text" : "password"} autoComplete="current-password" minLength={8} required placeholder="••••••••" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}>{show ? "إخفاء" : "إظهار"}</button></div></label>
    <div className="formRow"><label className="check"><input name="remember" type="checkbox" /> تذكرني</label><Link href="/forgot-password">نسيت كلمة المرور؟</Link></div>
    {message && <p className="formError" role="alert">{message}</p>}
    <button className="btn primary authSubmit" disabled={loading}>{loading ? "جارٍ تسجيل الدخول…" : variant === "super-admin" ? "دخول الإدارة العليا ←" : "تسجيل الدخول ←"}</button>
    {variant === "super-admin" ? <p className="authSwitch">هذا المدخل مخصص لحسابات الإدارة العليا فقط.</p> : tenantSlug ? <div className="authAccountPrompt"><span>طالب جديد في المنصة؟</span><Link className="authCreateAccount" href={`/t/${tenantSlug}/register`}>أنشئ حساب طالب جديد</Link><small>التسجيل يستغرق دقائق ويحفظ تقدمك ونتائجك.</small></div> : portal === "teacher" ? <p className="authSwitch">مدرس جديد؟ <Link href="/teacher-register">أنشئ منصتك التعليمية</Link></p> : <p className="authSwitch">طالب جديد؟ <Link href="/register">اختر أكاديميتك وأنشئ حسابك</Link></p>}
  </form>;
}

export function RegisterForm({ tenantSlug }: { tenantSlug?: string } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setMessage(""); setErrors({});
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...data, acceptedTerms: data.acceptedTerms === "on" }) });
      const result = await response.json();
      if (!response.ok) { setMessage(result.message ?? "تعذر إنشاء الحساب"); setErrors(result.errors ?? {}); }
      else router.push(result.redirectTo);
    } catch { setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى"); }
    finally { setLoading(false); }
  }

  const error = (name: string) => errors[name]?.[0] ? <small className="fieldError">{errors[name][0]}</small> : null;
  return <form className="authForm registerForm" onSubmit={submit} noValidate>{tenantSlug ? <input type="hidden" name="tenantSlug" value={tenantSlug} /> : null}
    <div className="fieldGrid">
      <label>الاسم بالكامل<input name="fullName" autoComplete="name" required />{error("fullName")}</label>
      <label>اسم المستخدم<input name="username" autoComplete="username" dir="ltr" required />{error("username")}</label>
      <label>البريد الإلكتروني <small>(اختياري)</small><input name="email" type="email" autoComplete="email" dir="ltr" />{error("email")}</label>
      <label>رقم الهاتف<input name="phone" type="tel" inputMode="numeric" autoComplete="tel" dir="ltr" placeholder="01XXXXXXXXX" required />{error("phone")}</label>
      <label>هاتف ولي الأمر<input name="parentPhone" type="tel" inputMode="numeric" dir="ltr" placeholder="01XXXXXXXXX" required />{error("parentPhone")}</label>
      <label>الصف الدراسي<select name="grade" required><option value="FIRST_SECONDARY">الأول الثانوي</option><option value="SECOND_SECONDARY">الثاني الثانوي</option><option value="THIRD_SECONDARY">الثالث الثانوي</option></select>{error("grade")}</label>
      <label>المحافظة<select name="governorate" required>{governorates.map((item) => <option key={item}>{item}</option>)}</select>{error("governorate")}</label>
      <span />
      <label>كلمة المرور<input name="password" type="password" autoComplete="new-password" minLength={8} required />{error("password")}</label>
      <label>تأكيد كلمة المرور<input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />{error("confirmPassword")}</label>
    </div>
    <label className="check terms"><input name="acceptedTerms" type="checkbox" required /> أوافق على شروط الاستخدام وسياسة الخصوصية</label>
    {message && <p className="formError" role="alert">{message}</p>}
    <button className="btn primary authSubmit" disabled={loading}>{loading ? "جارٍ إنشاء الحساب…" : "إنشاء حساب الطالب ←"}</button>
    <p className="authSwitch">لديك حساب بالفعل؟ <Link href={tenantSlug ? `/t/${tenantSlug}/login` : "/login"}>سجّل الدخول إلى حسابك</Link></p>
  </form>;
}
