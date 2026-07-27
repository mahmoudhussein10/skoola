"use client";

import { FormEvent, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Copy, CreditCard, LogOut, Send, Smartphone, Upload } from "lucide-react";

const PAYMENT_NUMBER = "01064225977";

export function OpeningFeeClient({ teacherName, academyName, amount, dueAt, status, pendingAt }: { teacherName:string; academyName:string; amount:number; dueAt:string; status:string; pendingAt:string|null }) {
  const [method, setMethod] = useState<"VODAFONE_CASH" | "INSTAPAY">("VODAFONE_CASH");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(status === "SUBMITTED");
  const expired = new Date(dueAt) <= new Date();

  async function copyNumber() {
    await navigator.clipboard.writeText(PAYMENT_NUMBER);
    setMessage("تم نسخ رقم الدفع");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    form.set("paymentMethod", method);
    const response = await fetch("/api/teacher/opening-fee", { method: "POST", body: form });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) return setMessage(result?.message || "تعذر إرسال طلب الدفع");
    setSubmitted(true);
    
    // TODO: Meta Pixel - Do NOT fire 'Purchase' here because the payment is only PENDING admin approval.
    // The Purchase event should be fired only when the backend confirms payment.
    // This can be done by redirecting to a success page after activation, or by using Facebook Conversions API (CAPI) on the server.
    
    setMessage("وصل طلب الدفع إلى السوبر أدمن بالتاريخ والوقت. سيتم تفعيل حسابك بعد اعتماد التحويل.");
  }

  return <main className="openingFeePage">
    <section className="openingFeeCard">
      <header>
        <span className={submitted ? "pending" : "warning"}>{submitted ? <Clock3 size={24}/> : <AlertTriangle size={24}/>}</span>
        <div><small>{academyName}</small><h1>{submitted ? "التحويل قيد المراجعة" : expired ? "تم إيقاف الحساب مؤقتًا" : "أكمل تفعيل حسابك"}</h1><p>أهلًا {teacherName}، رسوم فتح الحساب تُدفع مرة واحدة فقط.</p></div>
      </header>

      {submitted ? <div className="openingFeePending"><CheckCircle2 size={24}/><div><b>تم استلام طلبك</b><span>{pendingAt ? `أُرسل في ${new Date(pendingAt).toLocaleString("ar-EG")}` : "طلبك مسجل لدى الإدارة"}، وسيُعاد تشغيل الحساب فور الاعتماد.</span></div></div> :
      <form onSubmit={submit}>
        <div className="openingFeeAmount"><span>رسوم فتح الحساب</span><b>{amount.toLocaleString("en-US")} ج.م</b><small>{expired ? "انتهت مهلة الـ24 ساعة" : `آخر موعد: ${new Date(dueAt).toLocaleString("ar-EG")}`}</small></div>
        <div className="openingFeeMethods">
          <button type="button" className={method === "VODAFONE_CASH" ? "active" : ""} onClick={() => setMethod("VODAFONE_CASH")}><Smartphone size={20}/><span><b>فودافون كاش</b><small dir="ltr">{PAYMENT_NUMBER}</small></span></button>
          <button type="button" className={method === "INSTAPAY" ? "active" : ""} onClick={() => setMethod("INSTAPAY")}><CreditCard size={20}/><span><b>InstaPay</b><small dir="ltr">{PAYMENT_NUMBER}</small></span></button>
        </div>
        <button className="openingFeeCopy" type="button" onClick={copyNumber}><Copy size={17}/> نسخ رقم الدفع</button>
        <label>رقم عملية التحويل (اختياري)<input name="referenceNumber" dir="ltr" maxLength={100} placeholder="Transaction ID" /></label>
        <label className="openingFeeUpload"><Upload size={22}/><span><b>ارفع صورة التحويل</b><small>JPG أو PNG أو WebP — بحد أقصى 10MB</small></span><input name="proof" type="file" accept="image/jpeg,image/png,image/webp,image/avif" required /></label>
        <button className="btn primary openingFeeSubmit" disabled={busy}><Send size={18}/>{busy ? "جارٍ رفع الإيصال..." : "إرسال التحويل للمراجعة"}</button>
      </form>}
      {message ? <p className="openingFeeMessage" role="status">{message}</p> : null}
      <form action="/api/auth/logout" method="post"><button className="openingFeeLogout" type="submit"><LogOut size={17}/> تسجيل الخروج</button></form>
    </section>
  </main>;
}
