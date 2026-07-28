"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Copy, ExternalLink, Link2, Share2, UserPlus } from "lucide-react";
import { PUBLIC_SITE_ORIGIN } from "@/lib/public-site-url";


export function StudentInviteLink({ tenantSlug }: { tenantSlug: string }) {
  const [copied, setCopied] = useState(false);

  const loginPath = `/t/${tenantSlug}/login`;
  const registerPath = `/t/${tenantSlug}/register`;
  const studentLoginUrl = `${PUBLIC_SITE_ORIGIN}${loginPath}`;

  async function copyToClipboard() {
    await navigator.clipboard.writeText(studentLoginUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(`رابط دخول الطلاب إلى منصتي التعليمية:\n${studentLoginUrl}\n\nإذا لم يكن لديك حساب، اضغط "إنشاء حساب جديد" داخل الصفحة.`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="studentInviteCard saasPanel" aria-labelledby="student-invite-title">
      <div className="studentInviteCopy">
        <span className="studentInviteEyebrow"><Link2 size={17} /> بوابة الطلاب الخاصة بأكاديميتك</span>
        <h3 id="student-invite-title">الرابط الذي ترسله لطلابك</h3>
        <p>يفتح صفحة تسجيل دخول الطالب مباشرة، وبداخلها زر واضح لإنشاء حساب جديد لمن لم يسجل من قبل.</p>
        <code dir="ltr" title={studentLoginUrl}>{studentLoginUrl}</code>
      </div>
      <div className="studentInviteActions">
        <button type="button" onClick={copyToClipboard} className="studentInvitePrimary">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? "تم نسخ رابط الدخول" : "نسخ رابط دخول الطلاب"}
        </button>
        <button type="button" onClick={shareWhatsApp} className="studentInviteWhatsApp">
          <Share2 size={18} /> مشاركة عبر واتساب
        </button>
        <Link href={loginPath} target="_blank" className="studentInviteSecondary">
          <ExternalLink size={17} /> معاينة صفحة الدخول
        </Link>
        <Link href={registerPath} target="_blank" className="studentInviteSecondary">
          <UserPlus size={17} /> فتح إنشاء حساب طالب
        </Link>
      </div>
    </section>
  );
}