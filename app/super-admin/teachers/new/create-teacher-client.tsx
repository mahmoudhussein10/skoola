"use client";

import { useState } from "react";
import Link from "next/link";

export function CreateTeacherClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [subject, setSubject] = useState("الكيمياء");
  const [platformName, setPlatformName] = useState("");
  const [slug, setSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1565f5");
  const [secondaryColor, setSecondaryColor] = useState("#081b3a");
  const [subscriptionStart, setSubscriptionStart] = useState(() => new Date().toISOString().split("T")[0]);
  const [subscriptionEnd, setSubscriptionEnd] = useState("");
  const [pricePerStudent, setPricePerStudent] = useState<number>(50);
  const [studentLimit, setStudentLimit] = useState<number>(500);
  const [status, setStatus] = useState("ACTIVE");
  const [internalNotes, setInternalNotes] = useState("");

  // Created Success Screen Data
  const [createdData, setCreatedData] = useState<{
    name: string;
    publicUrl: string;
    username: string;
    tempPassword: string;
    teacherName: string;
    id: string;
  } | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCreds, setCopiedCreds] = useState(false);

  function handleNameChange(name: string) {
    setPlatformName(name);
    if (!slug) {
      const suggested = name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-");
      if (suggested) setSlug(suggested);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/super-admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone,
          emailOrUsername,
          tempPassword,
          subject,
          name: platformName,
          slug,
          primaryColor,
          secondaryColor,
          subscriptionStart,
          subscriptionEnd: subscriptionEnd || null,
          pricePerStudent: Number(pricePerStudent),
          studentLimit: Number(studentLimit),
          status,
          internalNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "فشل إنشاء منصة المدرس");
      }

      setCreatedData(data.platform);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "حدث خطأ أثناء الإنشاء";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const copyToClipboard = (text: string, type: "link" | "creds") => {
    navigator.clipboard.writeText(text);
    if (type === "link") {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2000);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1.5rem", marginTop: "1.5rem" }}>
      {/* Top Header Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
            إضافة وتأهيل منصة معزولة جديدة
          </h2>
          <p style={{ color: "#64748b", fontSize: "0.85rem", margin: "0.2rem 0 0" }}>
            قم بإدخال بيانات المعلم والمنصة المستقلة لإطلاق البيئة فوراً وتوليد بيانات الدخول.
          </p>
        </div>

        <Link href="/super-admin/teachers" className="btn secondary" style={{ padding: "0.55rem 1.1rem", fontSize: "0.85rem" }}>
          ← العودة لقائمة المدرسين
        </Link>
      </div>

      {createdData ? (
        /* SUCCESS PANEL */
        <section className="saasPanel" style={{ background: "#ffffff", padding: "2.5rem", borderRadius: "16px", border: "2px solid #22c55e", textAlign: "center" }}>
          <div style={{ width: "70px", height: "70px", borderRadius: "50%", background: "#dcfce7", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.2rem", margin: "0 auto 1.25rem" }}>
            ✓
          </div>
          <h2 style={{ fontSize: "1.6rem", color: "#15803d", fontWeight: 800, margin: "0 0 0.5rem" }}>
            تم إنشاء منصة المدرس وتفعيلها بنجاح! 🎉
          </h2>
          <p style={{ color: "#475569", fontSize: "0.95rem", margin: "0 auto 1.75rem", maxWidth: "540px" }}>
            تم إنشاء الحساب والبيئة المعزولة وتوليد بيانات الدخول. يمكنك نسخها وإرسالها للمدرس مباشرة.
          </p>

          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", padding: "1.75rem", borderRadius: "14px", display: "grid", gap: "1.25rem", textAlign: "right", maxWidth: "700px", margin: "0 auto 2rem" }}>
            <div style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: "0.75rem" }}>
              <small style={{ color: "#64748b", fontWeight: 700, fontSize: "0.8rem" }}>اسم المنصة والمعلم</small>
              <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", marginTop: "0.2rem" }}>
                {createdData.name} <span style={{ fontSize: "0.95rem", color: "#64748b", fontWeight: 500 }}>({createdData.teacherName})</span>
              </div>
            </div>

            <div>
              <small style={{ color: "#64748b", fontWeight: 700, fontSize: "0.8rem" }}>الرابط العام للمنصة (Public URL)</small>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.35rem" }}>
                <input
                  dir="ltr"
                  readOnly
                  value={`${typeof window !== "undefined" ? window.location.origin : ""}${createdData.publicUrl}`}
                  style={{ flex: 1, padding: "0.65rem 0.85rem", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "0.9rem", fontWeight: 600 }}
                />
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => copyToClipboard(`${window.location.origin}${createdData.publicUrl}`, "link")}
                  style={{ padding: "0.65rem 1.25rem", fontSize: "0.85rem" }}
                >
                  {copiedLink ? "تم النسخ ✓" : "نسخ الرابط 🔗"}
                </button>
              </div>
            </div>

            <div>
              <small style={{ color: "#64748b", fontWeight: 700, fontSize: "0.8rem" }}>بيانات الدخول الإدارية للمدرس</small>
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", padding: "1rem", borderRadius: "10px", marginTop: "0.35rem", display: "grid", gap: "0.4rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>اسم المستخدم / البريد:</span>
                  <code dir="ltr" style={{ background: "#f1f5f9", padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>{createdData.username}</code>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#64748b", fontSize: "0.85rem" }}>كلمة المرور المؤقتة:</span>
                  <code dir="ltr" style={{ background: "#f1f5f9", padding: "0.25rem 0.5rem", borderRadius: "6px", fontSize: "0.9rem", fontWeight: 700, color: "#1565f5" }}>{createdData.tempPassword}</code>
                </div>
              </div>

              <button
                type="button"
                className="btn secondary"
                style={{ marginTop: "0.75rem", width: "100%", padding: "0.65rem", fontSize: "0.85rem" }}
                onClick={() => copyToClipboard(`اسم المستخدم: ${createdData.username}\nكلمة المرور: ${createdData.tempPassword}\nرابط المنصة: ${window.location.origin}${createdData.publicUrl}`, "creds")}
              >
                {copiedCreds ? "تم النسخ ✓" : "📋 نسخ الرسالة النصية الكاملة للمدرس"}
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setCreatedData(null);
                setPlatformName("");
                setSlug("");
                setFullName("");
                setPhone("");
                setEmailOrUsername("");
              }}
            >
              + إنشاء منصة معلم آخر
            </button>

            <Link href={`/super-admin/teachers/${createdData.id}`} className="btn primary">
              الانتقال لإدارة المنصة والفوترة ←
            </Link>
          </div>
        </section>
      ) : (
        /* MAIN FORM & PREVIEW GRID */
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", alignItems: "start" }}>
          {/* FORM PANEL */}
          <form suppressHydrationWarning onSubmit={handleSubmit} className="saasPanel" style={{ background: "#ffffff", padding: "2rem", borderRadius: "16px", border: "1px solid #dfe4ec" }}>
            {error && (
              <div style={{ background: "#fef2f2", color: "#991b1b", padding: "1rem", borderRadius: "10px", marginBottom: "1.5rem", border: "1px solid #fecaca", fontSize: "0.9rem", fontWeight: 600 }}>
                ⚠️ {error}
              </div>
            )}

            {/* SECTION 1 */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", borderBottom: "1px solid #edf0f4", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>👤</span> 1. بيانات المدرس والحساب
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>اسم المدرس بالكامل *</label>
                <input suppressHydrationWarning required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اكتب اسم المدرس" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>رقم الهاتف *</label>
                <input suppressHydrationWarning required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>اسم المستخدم أو البريد *</label>
                <input suppressHydrationWarning required value={emailOrUsername} onChange={(e) => setEmailOrUsername(e.target.value)} placeholder="البريد أو اسم المستخدم" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>كلمة المرور المؤقتة *</label>
                <input suppressHydrationWarning required value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="كلمة مرور مؤقتة قوية" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>المادة / التخصص التعليمي</label>
                <input suppressHydrationWarning value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="اكتب المادة التي يدرسها" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>
            </div>

            {/* SECTION 2 */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", borderBottom: "1px solid #edf0f4", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🌐</span> 2. إعدادات المنصة المعزولة
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>اسم المنصة *</label>
                <input required value={platformName} onChange={(e) => handleNameChange(e.target.value)} placeholder="اكتب اسم المنصة" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>الرابط الفريد (Slug) *</label>
                <input required dir="ltr" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^\w-]/g, ""))} placeholder="teacher-platform" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem", color: "#1565f5", fontWeight: 700 }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>اللون الرئيسي للمنصة</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ width: "42px", height: "42px", padding: "0.2rem", borderRadius: "8px", border: "1px solid #dfe4ec", cursor: "pointer" }} />
                  <input type="text" dir="ltr" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1, padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.85rem" }} />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>اللون الثانوي</label>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ width: "42px", height: "42px", padding: "0.2rem", borderRadius: "8px", border: "1px solid #dfe4ec", cursor: "pointer" }} />
                  <input type="text" dir="ltr" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ flex: 1, padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.85rem" }} />
                </div>
              </div>
            </div>

            {/* SECTION 3 */}
            <h3 style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", borderBottom: "1px solid #edf0f4", paddingBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>💳</span> 3. الاشتراكات والفوترة والحدود
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.75rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>السعر المحسوب لكل طالب (ج.م) *</label>
                <input type="number" required min={0} value={pricePerStudent} onChange={(e) => setPricePerStudent(Number(e.target.value))} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem", fontWeight: 700 }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>الحد الأقصى للطلاب</label>
                <input type="number" required min={10} value={studentLimit} onChange={(e) => setStudentLimit(Number(e.target.value))} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem", fontWeight: 700 }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>تاريخ بداية الاشتراك</label>
                <input type="date" value={subscriptionStart} onChange={(e) => setSubscriptionStart(e.target.value)} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>تاريخ الانتهاء (اختياري)</label>
                <input type="date" value={subscriptionEnd} onChange={(e) => setSubscriptionEnd(e.target.value)} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
              </div>

              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>حالة حساب المنصة</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem", fontWeight: 700 }}>
                  <option value="ACTIVE">🟢 نشط (ACTIVE)</option>
                  <option value="TRIAL">⏳ تجريبي (TRIAL)</option>
                  <option value="SUSPENDED">⚠️ موقوف (SUSPENDED)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "1.75rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>ملاحظات إدارية داخلية (خاصة بالإدارة فقط)</label>
              <textarea rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} placeholder="ملاحظات داخلية اختيارية" style={{ width: "100%", padding: "0.65rem 0.85rem", borderRadius: "10px", border: "1px solid #dfe4ec", fontSize: "0.9rem" }} />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", borderTop: "1px solid #edf0f4", paddingTop: "1.25rem" }}>
              <Link href="/super-admin/teachers" className="btn secondary">
                إلغاء
              </Link>

              <button
                type="submit"
                disabled={loading}
                className="btn primary"
                style={{ padding: "0.75rem 2rem", fontSize: "0.95rem" }}
              >
                {loading ? "جاري الإنشاء..." : "🚀 إنشاء منصة المدرس آليًا"}
              </button>
            </div>
          </form>

          {/* LIVE PREVIEW CARD */}
          <div className="saasPanel" style={{ background: "#ffffff", padding: "1.5rem", borderRadius: "16px", border: "1px solid #dfe4ec", position: "sticky", top: "1.5rem" }}>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#0f172a", marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>🎨</span> معاينة هيدر منصة المدرس
            </h3>

            {/* Platform Mockup */}
            <div style={{ background: secondaryColor, borderRadius: "14px", padding: "1.25rem", color: "#ffffff", marginBottom: "1.25rem" }}>
              <div style={{ fontSize: "0.75rem", opacity: 0.8, textTransform: "uppercase", marginBottom: "0.4rem" }}>معاينة الواجهة العامة</div>
              <div style={{ fontSize: "1.15rem", fontWeight: 800, marginBottom: "0.25rem" }}>
                {platformName || "منصة الأستاذ التعليمية"}
              </div>
              <div style={{ fontSize: "0.85rem", opacity: 0.9 }}>
                معلم {subject || "المادة"} · {fullName || "اسم المدرس"}
              </div>

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <div style={{ background: primaryColor, padding: "0.35rem 0.75rem", borderRadius: "8px", fontSize: "0.75rem", fontWeight: 700 }}>
                  تصفح الكورسات
                </div>
                <div style={{ background: "rgba(255,255,255,0.15)", padding: "0.35rem 0.75rem", borderRadius: "8px", fontSize: "0.75rem" }}>
                  تسجيل طالب
                </div>
              </div>
            </div>

            {/* Slug URL */}
            <div style={{ background: "#f8fafc", border: "1px solid #edf0f4", padding: "0.85rem", borderRadius: "10px", marginBottom: "1rem" }}>
              <small style={{ color: "#64748b", display: "block", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.2rem" }}>رابط المنصة العام (Domain Slug)</small>
              <code dir="ltr" style={{ color: "#1565f5", fontWeight: 700, fontSize: "0.85rem" }}>
                /t/{slug || "ahmed-samir"}
              </code>
            </div>

            {/* Price breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid #edf0f4" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>سعر الطالب المحسوب</span>
                <b style={{ fontSize: "1.1rem", color: "#0f172a" }}>{pricePerStudent} ج.م</b>
              </div>
              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "10px", textAlign: "center", border: "1px solid #edf0f4" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b" }}>الحد الأقصى للطلاب</span>
                <b style={{ fontSize: "1.1rem", color: "#0f172a" }}>{studentLimit} طالب</b>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
