import { DashboardShell } from "../../dashboard-shell";
import { NotificationCenter, PushSettingsCard } from "../../notifications/push-client";
import { AnnouncementComposer } from "./announcement-composer";
import { requireTenantMember } from "../../../lib/auth";
import { hasPermission } from "../../../lib/permissions";
import { prisma } from "../../../lib/prisma";

export const metadata = { title: "الإشعارات" };

export default async function TeacherNotificationsPage() {
  const context = await requireTenantMember(["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"]);
  const canManage = hasPermission(context.membership.role, "notifications.manage", context.membership.permissions);
  const courses = canManage
    ? await prisma.course.findMany({
        where: { tenantId: context.membership.tenantId, status: "PUBLISHED" },
        select: { id: true, title: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return <DashboardShell kind="teacher" title="الإشعارات" subtitle="كل التنبيهات المرتبطة بحسابك وأكاديميتك" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
    {canManage ? <AnnouncementComposer courses={courses} /> : null}
    <NotificationCenter />
    <PushSettingsCard />
  </DashboardShell>;
}
