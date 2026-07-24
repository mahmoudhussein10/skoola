"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CourseStatusButton({ courseId, status }: { courseId: string; status: "DRAFT" | "PUBLISHED" | "ARCHIVED" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const nextStatus = status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
  async function updateStatus() {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/teacher/courses", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ courseId, status: nextStatus }) });
      const result = await response.json();
      if (!response.ok) setMessage(result.message ?? "تعذر تحديث الحالة"); else router.refresh();
    } catch { setMessage("تعذر الاتصال بالخادم"); } finally { setLoading(false); }
  }
  return <div className="courseStatusAction"><button type="button" onClick={updateStatus} disabled={loading}>{loading ? "جارٍ التحديث…" : status === "PUBLISHED" ? "إخفاء" : "نشر الآن"}</button>{message ? <small role="alert">{message}</small> : null}</div>;
}
