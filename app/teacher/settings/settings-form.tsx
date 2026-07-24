"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TenantSettingsFormState = { platformName: string; heroTitle: string; description: string; supportPhone: string; supportEmail: string; facebook: string; youtube: string; whatsapp: string; publicPageLive: boolean };

export function TenantSettingsForm({ initial }: { initial: TenantSettingsFormState }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/teacher/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => null);
    setSaving(false);
    setMessage(response.ok ? "تم حفظ بيانات منصتك" : data?.message ?? "تعذر الحفظ");
    if (response.ok) router.refresh();
  }
  return <form className="saasPanel settingsForm" onSubmit={save}><div className="fieldGrid"><label>اسم المنصة<input value={form.platformName} onChange={(event) => setForm({ ...form, platformName: event.target.value })} minLength={3} maxLength={100} required /></label><label>عنوان الهيرو<input value={form.heroTitle} onChange={(event) => setForm({ ...form, heroTitle: event.target.value })} maxLength={180} /></label><label>بريد الدعم<input dir="ltr" type="email" value={form.supportEmail} onChange={(event) => setForm({ ...form, supportEmail: event.target.value })} /></label><label>هاتف الدعم<input dir="ltr" value={form.supportPhone} onChange={(event) => setForm({ ...form, supportPhone: event.target.value })} maxLength={30} /></label><label>Facebook<input dir="ltr" type="url" value={form.facebook} onChange={(event) => setForm({ ...form, facebook: event.target.value })} /></label><label>YouTube<input dir="ltr" type="url" value={form.youtube} onChange={(event) => setForm({ ...form, youtube: event.target.value })} /></label><label>WhatsApp<input dir="ltr" type="url" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} /></label></div><label>وصف مختصر<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={1000} /></label><fieldset className="settingsChecks"><legend>النشر</legend><label><input type="checkbox" checked={form.publicPageLive} onChange={(event) => setForm({ ...form, publicPageLive: event.target.checked })} />نشر الصفحة العامة للطلاب</label></fieldset><button className="btn primary" disabled={saving}>{saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}</button>{message ? <p className="formNotice">{message}</p> : null}</form>;
}