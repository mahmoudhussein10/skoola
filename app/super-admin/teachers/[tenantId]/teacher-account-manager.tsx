"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Edit3, Save, Trash2, X } from "lucide-react";

type TeacherAccountManagerProps = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    subject: string | null;
    owner: { fullName: string; username: string; email: string | null; phone: string } | null;
  };
};

export function TeacherAccountManager({ tenant }: TeacherAccountManagerProps) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmSlug, setConfirmSlug] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (!dialog) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [dialog]);

  async function updateTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "تعذر حفظ التعديلات");
      setDialog(null);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حفظ التعديلات");
    } finally {
      setBusy(false);
    }
  }

  async function deleteTeacher() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/super-admin/tenants/${tenant.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmSlug, confirmText }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "تعذر حذف الحساب");
      router.replace("/super-admin/teachers?deleted=1");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر حذف الحساب");
      setBusy(false);
    }
  }

  return (
    <>
      <section className="teacherAdminActions">
        <div>
          <b>إدارة حساب المدرس</b>
          <span>تعديل بيانات الحساب والمنصة أو حذفهما نهائيًا.</span>
        </div>
        <div>
          <button type="button" className="btn secondary" onClick={() => { setMessage(""); setDialog("edit"); }}><Edit3 size={17} /> تعديل البيانات</button>
          <button type="button" className="btn teacherDeleteTrigger" onClick={() => { setMessage(""); setDialog("delete"); }}><Trash2 size={17} /> حذف الحساب بالكامل</button>
        </div>
      </section>

      {dialog ? (
        <div className="teacherAdminModal" role="presentation" onClick={() => !busy && setDialog(null)}>
          <section className="teacherAdminSheet" role="dialog" aria-modal="true" aria-labelledby="teacher-admin-dialog-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <span className={dialog === "delete" ? "danger" : ""}>{dialog === "delete" ? <AlertTriangle size={21} /> : <Edit3 size={21} />}</span>
                <div><h2 id="teacher-admin-dialog-title">{dialog === "edit" ? "تعديل بيانات المدرس" : "حذف حساب المدرس نهائيًا"}</h2><p>{tenant.name} · /t/{tenant.slug}</p></div>
              </div>
              <button type="button" aria-label="إغلاق" onClick={() => setDialog(null)} disabled={busy}><X size={20} /></button>
            </header>

            {dialog === "edit" ? (
              <form className="teacherAdminForm" onSubmit={updateTeacher}>
                <div className="fieldGrid">
                  <label>اسم المدرس<input name="fullName" required minLength={2} defaultValue={tenant.owner?.fullName} /></label>
                  <label>اسم المستخدم<input name="username" required dir="ltr" pattern="[a-z0-9._-]{3,40}" defaultValue={tenant.owner?.username} /></label>
                  <label>رقم الهاتف<input name="phone" required dir="ltr" defaultValue={tenant.owner?.phone} /></label>
                  <label>البريد الإلكتروني<input name="email" type="email" dir="ltr" defaultValue={tenant.owner?.email ?? ""} /></label>
                  <label>اسم المنصة<input name="name" required minLength={2} defaultValue={tenant.name} /></label>
                  <label>رابط المنصة<input name="slug" required dir="ltr" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={tenant.slug} /></label>
                  <label className="fieldWide">المادة أو التخصص<input name="subject" defaultValue={tenant.subject ?? ""} /></label>
                </div>
                {message ? <p className="formError" role="alert">{message}</p> : null}
                <footer><button type="button" className="btn secondary" onClick={() => setDialog(null)} disabled={busy}>إلغاء</button><button type="submit" className="btn primary" disabled={busy}><Save size={17} /> {busy ? "جارٍ الحفظ..." : "حفظ التعديلات"}</button></footer>
              </form>
            ) : (
              <div className="teacherDeletePanel">
                <div className="teacherDeleteWarning"><AlertTriangle size={20} /><p><b>هذا الإجراء لا يمكن التراجع عنه.</b><span>سيُحذف حساب المدرس والمنصة وطلابها وكورساتها ودروسها وامتحاناتها ومدفوعاتها من قاعدة البيانات.</span></p></div>
                <label>اكتب رابط المنصة للتأكيد: <b dir="ltr">{tenant.slug}</b><input dir="ltr" value={confirmSlug} onChange={(event) => setConfirmSlug(event.target.value)} autoComplete="off" /></label>
                <label>اكتب عبارة <b>حذف نهائي</b><input value={confirmText} onChange={(event) => setConfirmText(event.target.value)} autoComplete="off" /></label>
                {message ? <p className="formError" role="alert">{message}</p> : null}
                <footer><button type="button" className="btn secondary" onClick={() => setDialog(null)} disabled={busy}>تراجع</button><button type="button" className="btn teacherDeleteConfirm" onClick={deleteTeacher} disabled={busy || confirmSlug !== tenant.slug || confirmText !== "حذف نهائي"}><Trash2 size={17} /> {busy ? "جارٍ الحذف..." : "حذف نهائي من قاعدة البيانات"}</button></footer>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
