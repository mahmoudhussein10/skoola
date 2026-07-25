import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "../../dashboard-shell";
import { requireTenantMember } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export const metadata = { title: "الإشعارات" };

export default async function TeacherNotificationsPage() {
  const context = await requireTenantMember(["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"]);
  const notifications = await prisma.notification.findMany({
    where: { tenantId: context.membership.tenantId, userId: context.user.id },
    orderBy: { createdAt: "desc" }, take: 50,
  });
  return <DashboardShell kind="teacher" title="الإشعارات" subtitle="آخر التنبيهات المرتبطة بحسابك ومنصتك" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}>
    <section className="saasPanel pagePanel">
      <div className="panelTitle"><div><span className="eyebrow"><Bell size={15}/> مركز الإشعارات</span><h2>آخر الإشعارات</h2></div><Link href="/teacher">العودة للوحة التحكم</Link></div>
      {notifications.length ? <div className="notificationList">{notifications.map((item) => <article className={item.isRead ? "read" : "unread"} key={item.id}><i><CheckCircle2 size={18}/></i><div><h3>{item.title}</h3><p>{item.message}</p><small>{item.createdAt.toLocaleString("ar-EG")}</small></div></article>)}</div> : <div className="compactEmpty"><Bell size={25}/><b>لا توجد إشعارات جديدة</b><span>ستظهر هنا التنبيهات الحقيقية فور وصولها.</span></div>}
    </section>
  </DashboardShell>;
}