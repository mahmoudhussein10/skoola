"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TenantOption = { id: string; name: string; slug: string };

type FormState = {
  title: string;
  message: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL";
  audience: "ALL_TEACHERS" | "SELECTED_TENANTS" | "TEACHERS_ONLY" | "ALL_USERS";
  tenantIds: string[];
  startsAt: string;
  endsAt: string;
  dismissible: boolean;
  active: boolean;
};

function localDateTime() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function AnnouncementForm({ tenants }: { tenants: TenantOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({ title: "", message: "", severity: "INFO", audience: "ALL_TEACHERS", tenantIds: [], startsAt: localDateTime(), endsAt: "", dismissible: true, active: true });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  function toggleTenant(id: string) {
    setForm((current) => ({ ...current, tenantIds: current.tenantIds.includes(id) ? current.tenantIds.filter((item) => item !== id) : [...current.tenantIds, id] }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch("/api/super-admin/announcements", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, startsAt: new Date(form.startsAt).toISOString(), endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null }) });
    const data = await response.json().catch(() => null);
    setSaving(false);
    setMessage(response.ok ? "تم نشر الإعلان" : data?.message ?? "تعذر نشر الإعلان");
    if (response.ok) { setForm({ ...form, title: "", message: "", tenantIds: [] }); router.refresh(); }
  }
  return <form className="announcementForm" onSubmit={submit}><h3>إنشاء إعلان جديد</h3><div className="fieldGrid"><label>العنوان<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} minLength={3} maxLength={120} required /></label><label>الحدة<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as FormState["severity"] })}><option value="INFO">معلومة</option><option value="SUCCESS">نجاح</option><option value="WARNING">تنبيه</option><option value="CRITICAL">حرج</option></select></label><label>الجمهور<select value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value as FormState["audience"], tenantIds: [] })}><option value="ALL_TEACHERS">كل المدرسين</option><option value="SELECTED_TENANTS">منصات محددة</option><option value="TEACHERS_ONLY">المدرسون فقط</option><option value="ALL_USERS">كل المستخدمين</option></select></label><label>تاريخ البداية<input dir="ltr" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label><label>تاريخ النهاية (اختياري)<input dir="ltr" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} /></label></div><label>الرسالة<textarea value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} minLength={5} maxLength={2000} required /></label>{form.audience === "SELECTED_TENANTS" ? <fieldset className="tenantPicker"><legend>اختر المنصات</legend>{tenants.map((tenant) => <label key={tenant.id}><input type="checkbox" checked={form.tenantIds.includes(tenant.id)} onChange={() => toggleTenant(tenant.id)} />{tenant.name}<small>/{tenant.slug}</small></label>)}</fieldset> : null}<div className="settingsChecks"><label><input type="checkbox" checked={form.dismissible} onChange={(event) => setForm({ ...form, dismissible: event.target.checked })} />قابل للإغلاق</label><label><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />نشط فورًا</label></div><button className="btn primary" disabled={saving}>{saving ? "جارٍ النشر…" : "نشر الإعلان"}</button>{message ? <p className="formNotice">{message}</p> : null}</form>;
}

export function AnnouncementToggle({ id, active }: { id: string; active: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  async function toggle() {
    setLoading(true);
    const response = await fetch("/api/super-admin/announcements/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !active }) });
    setLoading(false);
    if (response.ok) router.refresh();
  }
  return <button disabled={loading} onClick={toggle}>{active ? "إيقاف" : "تفعيل"}</button>;
}