"use client";

import { useState } from "react";
import { CreditCard, Landmark, Smartphone } from "lucide-react";

type PaymentSettingsState = {
  vodafoneCashEnabled: boolean;
  vodafoneCashNumber: string;
  instaPayEnabled: boolean;
  instaPayAddress: string;
  bankTransferEnabled: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankIban: string;
  accountHolderName: string;
  paymentInstructions: string;
};

export function PaymentSettingsForm({ initial }: { initial: PaymentSettingsState }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/teacher/payment-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json().catch(() => null);
      setSuccess(response.ok);
      setMessage(response.ok ? "تم حفظ إعدادات الدفع والاشتراكات بنجاح" : result?.message ?? "تعذر حفظ إعدادات الدفع");
    } catch {
      setMessage("تعذر الاتصال بالخادم. حاول مرة أخرى.");
    } finally {
      setSaving(false);
    }
  }

  return <form className="saasPanel settingsForm paymentSettingsForm" onSubmit={save}>
    <div className="settingsSectionIntro"><i><CreditCard /></i><div><span>التحويل اليدوي</span><h2>إعدادات الدفع والاشتراكات</h2><p>أضف الوسائل المتاحة لديك لاستقبال اشتراكات الطلاب. تظهر هذه البيانات للطلاب عند تفعيلها.</p></div></div>

    <div className="paymentMethodCard paymentPhoneCard">
      <header><i className="vodafoneIcon"><Smartphone /></i><div><span className="paymentPrimaryLabel">وسيلة التحويل الأساسية</span><h3>رقم تحويل اشتراكات الطلاب</h3><p>اكتب رقم المحفظة الذي يحوّل عليه الطالب قيمة الكورس، ثم فعّل ظهوره في نافذة الاشتراك.</p></div><label className="methodSwitch methodSwitchLabeled"><small>{form.vodafoneCashEnabled ? "ظاهر للطلاب" : "غير ظاهر"}</small><input type="checkbox" checked={form.vodafoneCashEnabled} onChange={(event) => setForm({ ...form, vodafoneCashEnabled: event.target.checked })} aria-label="إظهار رقم التحويل للطلاب" /><span /></label></header>
      <label>رقم الهاتف لاستقبال التحويلات<input dir="ltr" inputMode="tel" autoComplete="tel" placeholder="01XXXXXXXXX" value={form.vodafoneCashNumber} onChange={(event) => setForm({ ...form, vodafoneCashNumber: event.target.value })} required={form.vodafoneCashEnabled} /><small className="paymentFieldHint">{form.vodafoneCashEnabled ? "سيظهر هذا الرقم للطالب مع زر نسخ مباشر عند الاشتراك." : "الرقم محفوظ، لكنه لن يظهر للطلاب حتى تفعيل الزر بالأعلى."}</small></label>
    </div>

    <div className="paymentMethodCard">
      <header><i className="instapayIcon"><Landmark /></i><div><h3>InstaPay</h3><p>استقبال التحويلات عبر تطبيق InstaPay.</p></div><label className="methodSwitch"><input type="checkbox" checked={form.instaPayEnabled} onChange={(event) => setForm({ ...form, instaPayEnabled: event.target.checked })} /><span /></label></header>
      {form.instaPayEnabled && <label>عنوان الدفع أو رقم الهاتف في InstaPay<input dir="ltr" placeholder="name@instapay أو 01XXXXXXXXX" value={form.instaPayAddress} onChange={(event) => setForm({ ...form, instaPayAddress: event.target.value })} required={form.instaPayEnabled} /></label>}
    </div>

    <div className="paymentMethodCard">
      <header><i className="bankIcon"><Landmark /></i><div><h3>تحويل بنكي مباشر (Bank Transfer)</h3><p>استقبال التحويلات إلى حسابك البنكي.</p></div><label className="methodSwitch"><input type="checkbox" checked={form.bankTransferEnabled} onChange={(event) => setForm({ ...form, bankTransferEnabled: event.target.checked })} /><span /></label></header>
      {form.bankTransferEnabled && <div className="fieldGrid">
        <label>اسم البنك<input placeholder="مثال: البنك الأهلي المصري / CIB" value={form.bankName} onChange={(event) => setForm({ ...form, bankName: event.target.value })} required={form.bankTransferEnabled} /></label>
        <label>رقم الحساب البنكي<input dir="ltr" placeholder="أدخل رقم الحساب" value={form.bankAccountNumber} onChange={(event) => setForm({ ...form, bankAccountNumber: event.target.value })} required={form.bankTransferEnabled} /></label>
        <label style={{ gridColumn: "1 / -1" }}>رقم IBAN (اختياري)<input dir="ltr" placeholder="EGXXXXXXXXXXXXXXXXXXXXXX" value={form.bankIban} onChange={(event) => setForm({ ...form, bankIban: event.target.value })} /></label>
      </div>}
    </div>

    <div className="fieldGrid">
      <label>اسم صاحب الحساب المستفيد<input placeholder="الاسم كما يظهر في الحساب أو المحفظة" value={form.accountHolderName} onChange={(event) => setForm({ ...form, accountHolderName: event.target.value })} required={form.vodafoneCashEnabled || form.instaPayEnabled || form.bankTransferEnabled} /></label>
    </div>
    <label>تعليمات وإرشادات الدفع للطالب<textarea value={form.paymentInstructions} onChange={(event) => setForm({ ...form, paymentInstructions: event.target.value })} placeholder="اكتب الخطوات التفصيلية للطالب (مثال: قم بالتحويل ثم أرفق صورة الإيصال أو رقم العملية)." maxLength={1200} /></label>
    <button className="btn primary" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ رقم التحويل وطرق الدفع"}</button>
    {message ? <p className={success ? "formNotice" : "formError"} role="status">{message}</p> : null}
  </form>;
}
