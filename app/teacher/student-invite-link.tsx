"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Share2, Link2 } from "lucide-react";

export function StudentInviteLink({ tenantSlug }: { tenantSlug: string }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const registerUrl = origin ? `${origin}/t/${tenantSlug}/register` : `/t/${tenantSlug}/register`;

  function copyToClipboard() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(registerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function shareWhatsApp() {
    if (typeof window !== "undefined") {
      const text = encodeURIComponent(`رابط تسجيل الطلاب المنضمين لمنصتي التعليمية:\n${registerUrl}`);
      window.open(`https://wa.me/?text=${text}`, "_blank");
    }
  }

  return (
    <section className="studentInviteCard saasPanel" style={{ margin: "20px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "260px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--sk-blue)", fontWeight: "800", fontSize: "12px" }}>
            <Link2 size={16} />
            <span>رابط انضمام الطلاب الأكاديمي</span>
          </div>
          <h3 style={{ margin: "6px 0 4px", fontSize: "17px", color: "var(--sk-navy)", fontWeight: "900" }}>
            رابط تسجيل الطلاب الخاص بك
          </h3>
          <p style={{ margin: 0, fontSize: "12px", color: "var(--sk-muted)" }}>
            شارك هذا الرابط المباشر مع طلابك ليسجلوا حسابتهم ويرتبطوا بأكاديميتك تلقائيًا.
          </p>
          <div style={{ marginTop: "10px", padding: "8px 14px", background: "#f8fafc", border: "1px solid var(--sk-border)", borderRadius: "10px", display: "inline-block", fontSize: "12px", color: "#0f172a", direction: "ltr", fontWeight: "600" }}>
            {registerUrl}
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            onClick={copyToClipboard}
            className="skoolaOutlineBtn"
            style={{ padding: "10px 16px", borderRadius: "12px", cursor: "pointer", fontSize: "12px", fontWeight: "700" }}
          >
            {copied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
            {copied ? "تم نسخ الرابط!" : "نسخ رابط التسجيل"}
          </button>
          <button
            type="button"
            onClick={shareWhatsApp}
            className="skoolaBtn"
            style={{ padding: "10px 16px", borderRadius: "12px", background: "#25D366", borderColor: "#25D366", color: "#fff", cursor: "pointer", fontSize: "12px", fontWeight: "800" }}
          >
            <Share2 size={16} />
            مشاركة عبر واتساب
          </button>
        </div>
      </div>
    </section>
  );
}
