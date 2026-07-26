
import { DashboardShell } from "../../dashboard-shell";
import { requireTenantMember } from "../../../lib/auth";
import { TeacherHelpCenter } from "./help-center-client";

export const metadata = {
  title: "دليل استخدام المنصة",
  description: "دليل عملي لاستخدام لوحة المدرس وإدارة الأكاديمية.",
};

export default async function TeacherHelpPage() {
  const context = await requireTenantMember(["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"]);
  const academyName = context.membership.tenant.settings?.platformName ?? context.membership.tenant.name;

  return (
    <DashboardShell
      kind="teacher"
      title="دليل استخدام المنصة"
      subtitle="إجابات وخطوات وروابط مباشرة لكل مهمة داخل أكاديميتك"
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <TeacherHelpCenter academyName={academyName} />
    </DashboardShell>
  );
}
