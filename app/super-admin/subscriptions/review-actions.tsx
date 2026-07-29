"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./subscriptions.module.css";

export function SubscriptionReviewActions({ requestId, status }: { requestId: string; status: string }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function review(nextStatus: "APPROVED" | "REJECTED" | "NEEDS_REVIEW") {
    let rejectionReason: string | undefined;
    if (nextStatus === "REJECTED" || nextStatus === "NEEDS_REVIEW") { const reason = window.prompt(nextStatus === "REJECTED" ? "اكتب سبب الرفض ليظهر للمدرس:" : "اكتب المطلوب توضيحه في الإيصال:"); if (!reason?.trim()) return; rejectionReason = reason.trim(); }
    if (nextStatus === "APPROVED" && !window.confirm("تأكيد التحويل وتفعيل اشتراك الأكاديمية؟")) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/super-admin/subscriptions/payments/${requestId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus, rejectionReason }) });
    const data = await response.json().catch(() => null); setBusy(false); setMessage(response.ok ? "تم حفظ القرار" : data?.message ?? "تعذر حفظ القرار"); if (response.ok) router.refresh();
  }
  if (status !== "PENDING" && status !== "NEEDS_REVIEW") return null;
  return <div className={styles.actions}><button onClick={() => review("APPROVED")} disabled={busy}>قبول وتفعيل</button><button onClick={() => review("NEEDS_REVIEW")} disabled={busy}>يحتاج مراجعة</button><button className={styles.reject} onClick={() => review("REJECTED")} disabled={busy}>رفض</button>{message ? <small>{message}</small> : null}</div>;
}