"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StaffInviteForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const response = await fetch("/api/teacher/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    const result = await response.json();
    setMessage(result.message ?? (response.ok ? "تم إنشاء الدعوة لمدة 7 أيام" : "تعذر إنشاء الدعوة"));
    if (response.ok) { event.currentTarget.reset(); router.refresh(); }
  }
  return <form className="inlineCreateForm" onSubmit={submit}><input name="email" type="email" required placeholder="name@domain.com" dir="ltr" /><select name="role"><option value="TEACHER_ADMIN">مدير</option><option value="TEACHER_EDITOR">محرر محتوى</option><option value="SUPPORT_STAFF">دعم</option></select><button>إرسال دعوة</button>{message ? <small>{message}</small> : null}</form>;
}

export function RevokeInvitation({ id }: { id: string }) {
  const router = useRouter();
  return <button className="linkDanger" onClick={async () => { if (!window.confirm("إلغاء هذه الدعوة؟")) return; await fetch("/api/teacher/staff/" + id, { method: "DELETE" }); router.refresh(); }}>إلغاء</button>;
}

export function StaffMemberActions({ id, role, status, locked }: { id: string; role: string; status: string; locked: boolean }) {
  const router = useRouter();
  const [nextRole, setNextRole] = useState(role);
  const [nextStatus, setNextStatus] = useState(status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE");
  const [loading, setLoading] = useState(false);
  if (locked) return <span className="ownerBadge">مالك المنصة</span>;
  async function save() {
    setLoading(true);
    const response = await fetch("/api/teacher/staff/members/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ role: nextRole, status: nextStatus }) });
    setLoading(false);
    if (!response.ok) return window.alert("تعذر تحديث العضو");
    router.refresh();
  }
  async function remove() {
    if (!window.confirm("إلغاء وصول هذا العضو؟ لن يتم حذف حسابه أو سجلاته.")) return;
    setLoading(true);
    const response = await fetch("/api/teacher/staff/members/" + id, { method: "DELETE" });
    setLoading(false);
    if (!response.ok) return window.alert("تعذر إلغاء الوصول");
    router.refresh();
  }
  return <div className="staffMemberActions"><select value={nextRole} onChange={(event) => setNextRole(event.target.value)}><option value="TEACHER_ADMIN">مدير</option><option value="TEACHER_EDITOR">محرر</option><option value="SUPPORT_STAFF">دعم</option></select><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}><option value="ACTIVE">نشط</option><option value="SUSPENDED">موقوف</option></select><button disabled={loading} onClick={save}>حفظ</button><button className="linkDanger" disabled={loading} onClick={remove}>إلغاء الوصول</button></div>;
}