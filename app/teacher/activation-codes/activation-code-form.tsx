"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Sparkles, KeyRound, CopyCheck } from "lucide-react";

export function ActivationCodeForm({ courses }: { courses: Array<{ id: string; title: string }> }) {
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    setCodes([]);
    const raw = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/teacher/activation-codes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...raw,
        count: Number(raw.count),
        maxUses: Number(raw.maxUses),
        courseId: raw.courseId || null,
        expiresAt: raw.expiresAt ? new Date(String(raw.expiresAt)).toISOString() : null,
      }),
    });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return setMessage(data?.message ?? "تعذر إنشاء الأكواد");
    setCodes(data.codes);
    setMessage("تم إنشاء الأكواد بنجاح 🎉 انسخ الأكواد الآن لحفظها لديك قبل مغادرة الصفحة.");
    router.refresh();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  function copyAllCodes() {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <>
      <form className="activationForm" onSubmit={submit}>
        <h3>
          <KeyRound size={20} style={{ color: "#2563eb" }} />
          إنشاء دفعة أكواد تفعيل جديدة
        </h3>
        <div className="fieldGrid">
          <label>
            <span>وصف الدفعة</span>
            <input name="label" maxLength={80} placeholder="مثال: طلاب الصف الأول الثانوي" />
          </label>
          <label>
            <span>الكورس المخصص</span>
            <select name="courseId">
              <option value="">كود عام (شامل كافة المنصة)</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>عدد الأكواد المطلوبة</span>
            <input name="count" type="number" min="1" max="50" defaultValue="5" />
          </label>
          <label>
            <span>عدد مرات استخدام كل كود</span>
            <input name="maxUses" type="number" min="1" max="1000" defaultValue="1" />
          </label>
          <label>
            <span>تاريخ انتهاء الصلاحية (اختياري)</span>
            <input name="expiresAt" type="datetime-local" />
          </label>
        </div>
        <button className="btn primary lg" disabled={loading} style={{ marginTop: "16px" }}>
          <Sparkles size={18} />
          {loading ? "جارٍ التوليد والتشفير…" : "إنشاء دفعة الأكواد الآن ←"}
        </button>
      </form>

      {message ? <p className="formNotice" style={{ marginTop: "16px" }}>{message}</p> : null}

      {codes.length > 0 && (
        <div className="generatedCodesBox" style={{ marginTop: "24px", background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "18px", padding: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "900", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <KeyRound size={18} color="#2563eb" />
              الأكواد المُنشأة حديثًا ({codes.length}):
            </h4>
            <button
              type="button"
              className="btn primary sm"
              onClick={copyAllCodes}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              {copiedAll ? <CopyCheck size={16} /> : <Copy size={16} />}
              {copiedAll ? "تم نسخ كافة الأكواد! ✓" : "نسخ كافة الأكواد دفعة واحدة"}
            </button>
          </div>

          <div className="codesGrid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
            {codes.map((code) => (
              <div
                key={code}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "12px",
                  padding: "10px 14px",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                }}
              >
                <code style={{ fontSize: "16px", fontWeight: "900", color: "#0f172a", letterSpacing: "1px", direction: "ltr" }}>
                  {code}
                </code>
                <button
                  type="button"
                  className="btn sm outline"
                  onClick={() => copyCode(code)}
                  style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "8px", cursor: "pointer" }}
                >
                  {copiedCode === code ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copiedCode === code ? "تم النسخ" : "نسخ الكود"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}