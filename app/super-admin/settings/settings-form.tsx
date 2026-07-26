"use client";

import { useState } from "react";

type Settings = {
  platformName: string;
  supportEmail: string;
  supportPhone: string;
  registrationEnabled: boolean;
  teacherRegistrationEnabled: boolean;
  maintenanceMode: boolean;
  requireAdminApproval: boolean;
  maxDevicesPerStudent: number;
  defaultTenantStatus: "TRIAL" | "ACTIVE" | "SUSPENDED" | "DISABLED";
  maxUploadSizeMb: number;
  allowedUploadTypes: string[];
};

const uploadTypes = [
  ["application/pdf", "PDF"],
  ["image/jpeg", "JPEG"],
  ["image/png", "PNG"],
  ["image/webp", "WebP"],
  ["video/mp4", "MP4"],
] as const;

export function PlatformSettingsForm({ initial }: { initial: Settings }) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function toggleType(value: string) {
    setForm((current) => ({ ...current, allowedUploadTypes: current.allowedUploadTypes.includes(value) ? current.allowedUploadTypes.filter((item) => item !== value) : [...current.allowedUploadTypes, value] }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/super-admin/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, teacherRegistrationEnabled: false }) });
    const data = await response.json().catch(() => null);
    setSaving(false);
    setMessage(response.ok ? "تم حفظ إعدادات النظام" : data?.message ?? "تعذر حفظ الإعدادات");
  }
  return <form className="saasPanel settingsForm" onSubmit={save}>
    <div className="fieldGrid">
      <label>اسم المنصة<input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} required minLength={3} /></label>
      <label>بريد الدعم<input dir="ltr" type="email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} /></label>
      <label>هاتف الدعم<input dir="ltr" value={form.supportPhone} onChange={(event) => setForm({ ...form, supportPhone: event.target.value })} /></label>
      <label>الحالة الافتراضية للمدرس<select value={form.defaultTenantStatus} onChange={(event) => setForm({ ...form, defaultTenantStatus: event.target.value as Settings["defaultTenantStatus"] })}><option value="TRIAL">تجريبي</option><option value="ACTIVE">نشط</option><option value="SUSPENDED">موقوف</option><option value="DISABLED">معطل</option></select></label>
      <label>الحد الأقصى للأجهزة<input type="number" min="1" max="10" value={form.maxDevicesPerStudent} onChange={(event) => setForm({ ...form, maxDevicesPerStudent: Number(event.target.value) })} /></label>
      <label>أقصى حجم رفع (MB)<input type="number" min="1" max="500" value={form.maxUploadSizeMb} onChange={(event) => setForm({ ...form, maxUploadSizeMb: Number(event.target.value) })} /></label>
    </div>
    <fieldset className="settingsChecks"><legend>سياسات التسجيل والتشغيل</legend>
      <label><input type="checkbox" checked={form.registrationEnabled} onChange={(event) => setForm({ ...form, registrationEnabled: event.target.checked })} />السماح بتسجيل الطلاب</label>
      <div className="managedTeacherPolicy"><b>إنشاء المدرسين من الإدارة العليا فقط</b><small>لا يوجد تسجيل ذاتي للمدرسين؛ أنشئ كل منصة من صفحة المدرسين لضمان المراجعة والعزل الصحيح.</small></div>
      <label><input type="checkbox" checked={form.requireAdminApproval} onChange={(event) => setForm({ ...form, requireAdminApproval: event.target.checked })} />مراجعة حسابات الطلاب قبل التفعيل</label>
      <label><input type="checkbox" checked={form.maintenanceMode} onChange={(event) => setForm({ ...form, maintenanceMode: event.target.checked })} />وضع الصيانة</label>
    </fieldset>
    <fieldset className="settingsChecks"><legend>أنواع الرفع المسموح بها</legend>{uploadTypes.map(([value, label]) => <label key={value}><input type="checkbox" checked={form.allowedUploadTypes.includes(value)} onChange={() => toggleType(value)} />{label}</label>)}</fieldset>
    <div className="editorActions"><button className="btn primary" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button></div>
    {message ? <p className="formNotice">{message}</p> : null}
  </form>;
}
