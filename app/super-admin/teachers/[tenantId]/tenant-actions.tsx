"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TenantActions({ tenantId, status }: { tenantId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function update(nextStatus: "ACTIVE" | "SUSPENDED" | "DISABLED") {
    const message = nextStatus === "SUSPENDED" ? "إيقاف المنصة مؤقتًا؟ لن تُحذف البيانات." : "تأكيد تغيير حالة المنصة؟";
    if (!window.confirm(message)) return;
    setLoading(true);
    const response = await fetch("/api/super-admin/tenants/" + tenantId + "/status", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setLoading(false);
    if (!response.ok) return window.alert("تعذر تحديث الحالة");
    router.refresh();
  }

  async function openSupportMode() {
    if (!window.confirm("فتح المنصة في وضع دعم للقراءة فقط لمدة 30 دقيقة؟ سيتم تسجيل العملية.")) return;
    setLoading(true);
    const response = await fetch("/api/super-admin/support/" + tenantId, { method: "POST" });
    const data = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok) return window.alert(data?.message ?? "تعذر بدء وضع الدعم");
    window.location.href = data.redirectTo;
  }

  return <div className="tenantActions">
    <button className="support" disabled={loading} onClick={openSupportMode}>دخول دعم آمن</button>
    <button disabled={loading || status === "ACTIVE"} onClick={() => update("ACTIVE")}>تفعيل</button>
    <button className="warning" disabled={loading || status === "SUSPENDED"} onClick={() => update("SUSPENDED")}>إيقاف مؤقت</button>
    <button className="danger" disabled={loading || status === "DISABLED"} onClick={() => update("DISABLED")}>تعطيل</button>
  </div>;
}