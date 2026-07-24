import { requireSuperAdmin } from "../../../../lib/auth";
import { DashboardShell } from "../../../dashboard-shell";
import { CreateTeacherClient } from "./create-teacher-client";

export default async function CreateTeacherPage() {
  const user = await requireSuperAdmin();

  return (
    <DashboardShell
      kind="super"
      title="إنشاء منصة مدرس جديد"
      subtitle="إطلاق بيئة معزولة مخصصة وتوليد بيانات الدخول آليًا"
      userName={user.fullName}
    >
      <CreateTeacherClient />
    </DashboardShell>
  );
}
