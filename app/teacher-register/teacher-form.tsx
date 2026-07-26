"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Camera, CheckCircle2, GraduationCap, ShieldCheck, Upload, UserRound } from "lucide-react";

const grades = [
  ["FIRST_PREPARATORY", "الأول الإعدادي"],
  ["SECOND_PREPARATORY", "الثاني الإعدادي"],
  ["THIRD_PREPARATORY", "الثالث الإعدادي"],
  ["FIRST_SECONDARY", "الأول الثانوي"],
  ["SECOND_SECONDARY", "الثاني الثانوي"],
  ["THIRD_SECONDARY", "الثالث الثانوي"],
] as const;

export function TeacherSignupForm() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [slug, setSlug] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  function choosePhoto(file?: File) {
    setMessage("");
    if (!file) {
      setPhoto(null);
      setPreview("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) {
      setMessage("اختر صورة بصيغة JPG أو PNG أو WebP أو AVIF.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setMessage("حجم الصورة يجب ألا يتجاوز 8 ميجابايت.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }
    if (!form.getAll("grades").length) {
      setMessage("اختر صفًا دراسيًا واحدًا على الأقل.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/teacher-signup", { method: "POST", body: form });
      const result = await response.json().catch(() => ({ message: "تعذر إنشاء الحساب، حاول مرة أخرى." }));
      if (!response.ok) {
        setMessage(result.message || "تعذر إنشاء الحساب.");
        return;
      }
      setSuccess(true);
      setMessage(result.warning || "تم إنشاء منصتك بنجاح. جارٍ فتح لوحة التحكم...");
      if (result.warning) await new Promise((resolve) => window.setTimeout(resolve, 1800));
      router.push(result.redirectTo || "/teacher/onboarding");
      router.refresh();
    } catch {
      setMessage("تعذر الاتصال بالخدمة. تحقق من الإنترنت وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="authForm registerForm teacherSignupForm" onSubmit={submit}>
      <section className="teacherSignupSection teacherPhotoSection">
        <div className="teacherSignupSectionHead">
          <span><Camera size={19} /></span>
          <div><h2>صورتك الشخصية</h2><p>ستظهر لطلابك داخل واجهة الأكاديمية، ويمكن تغييرها لاحقًا.</p></div>
        </div>
        <button className="teacherPhotoPicker" type="button" onClick={() => fileInput.current?.click()}>
          <span className="teacherPhotoPreview" style={preview ? { backgroundImage: `url("${preview}")` } : undefined} role={preview ? "img" : undefined} aria-label={preview ? "معاينة صورة المدرس" : undefined}>
            {!preview ? <UserRound size={34} /> : null}
          </span>
          <span><b>{photo ? "تغيير الصورة" : "ارفع صورتك من الجهاز"}</b><small>{photo ? photo.name : "JPG أو PNG أو WebP — بحد أقصى 8MB"}</small></span>
          <Upload size={20} />
        </button>
        <input ref={fileInput} className="teacherPhotoInput" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(event) => choosePhoto(event.target.files?.[0])} />
      </section>

      <section className="teacherSignupSection">
        <div className="teacherSignupSectionHead">
          <span><UserRound size={19} /></span>
          <div><h2>بيانات المدرس</h2><p>بيانات الدخول والتواصل الأساسية.</p></div>
        </div>
        <div className="fieldGrid">
          <label>اسم المدرس<input name="fullName" required minLength={2} maxLength={100} autoComplete="name" placeholder="الاسم بالكامل" /></label>
          <label>اسم المستخدم<input name="username" required minLength={3} maxLength={40} dir="ltr" autoComplete="username" placeholder="ahmed.teacher" pattern="[A-Za-z0-9._-]+" /></label>
          <label>البريد الإلكتروني<input name="email" required type="email" maxLength={160} dir="ltr" autoComplete="email" placeholder="name@example.com" /></label>
          <label>رقم الهاتف<input name="phone" required type="tel" dir="ltr" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" pattern="01[0125][0-9]{8}" /></label>
        </div>
      </section>

      <section className="teacherSignupSection">
        <div className="teacherSignupSectionHead">
          <span><Building2 size={19} /></span>
          <div><h2>بيانات الأكاديمية</h2><p>اختر اسمًا ورابطًا واضحين لطلابك.</p></div>
        </div>
        <div className="fieldGrid">
          <label>اسم المنصة<input name="platformName" required minLength={2} maxLength={120} placeholder="أكاديمية الأستاذ أحمد" /></label>
          <label className="fieldWide teacherSlugField">
            <span>رابط المنصة الخاص بك</span>
            <input name="slug" required minLength={3} maxLength={50} dir="ltr" value={slug} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="مثال: ahmed-math" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" aria-describedby="teacher-slug-guide" />
            <div className="teacherSlugGuide" id="teacher-slug-guide">
              <b>تكتب إيه هنا؟</b>
              <p>اكتب اسمك أو اسم الأكاديمية <strong>بالإنجليزي</strong>، ومن غير مسافات. استخدم شرطة <strong dir="ltr">-</strong> بين الكلمات.</p>
              <span>أمثلة صحيحة: <code>ahmed-math</code> · <code>reem-academy</code> · <code>mostafa-science</code></span>
              <small>رابطك الذي سترسله للطلاب:</small>
              <strong className="teacherSlugPreview" dir="ltr">skoola-rho.vercel.app/t/{slug || "ahmed-math"}</strong>
            </div>
            {slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? <small className="teacherSlugError">اكتب الرابط بحروف إنجليزية صغيرة وأرقام فقط. مثال: ahmed-math</small> : null}
          </label>
          <label className="fieldWide">المادة أو التخصص<input name="subject" required minLength={2} maxLength={80} placeholder="مثال: الرياضيات" /></label>
        </div>
      </section>

      <section className="teacherSignupSection">
        <div className="teacherSignupSectionHead">
          <span><GraduationCap size={19} /></span>
          <div><h2>الصفوف الدراسية</h2><p>تمت إضافة سنوات الإعدادي الثلاث بجانب المرحلة الثانوية.</p></div>
        </div>
        <div className="teacherGradeChoices">
          {grades.map(([value, label]) => <label key={value}><input type="checkbox" name="grades" value={value} defaultChecked /><span><CheckCircle2 size={17} />{label}</span></label>)}
        </div>
      </section>

      <section className="teacherSignupSection">
        <div className="teacherSignupSectionHead">
          <span><ShieldCheck size={19} /></span>
          <div><h2>تأمين الحساب</h2><p>استخدم كلمة مرور قوية لا تقل عن 10 أحرف.</p></div>
        </div>
        <div className="fieldGrid">
          <label>كلمة المرور<input name="password" required type="password" minLength={10} maxLength={128} autoComplete="new-password" /></label>
          <label>تأكيد كلمة المرور<input name="confirmPassword" required type="password" minLength={10} maxLength={128} autoComplete="new-password" /></label>
        </div>
      </section>

      <input className="teacherSignupHoneypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <label className="check teacherSignupTerms"><input name="acceptedTerms" value="true" type="checkbox" required /> أوافق على شروط الاستخدام وسياسة الخصوصية</label>
      {message ? <p className={success ? "formSuccess" : "formError"} role="status">{message}</p> : null}
      <button className="btn primary authSubmit teacherSignupSubmit" disabled={loading}>
        {loading ? "جارٍ إنشاء منصتك..." : "إنشاء منصتي والبدء"}
      </button>
    </form>
  );
}
