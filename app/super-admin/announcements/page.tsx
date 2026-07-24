import { prisma } from "../../../lib/prisma";
import { requireSuperAdmin } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { AnnouncementForm, AnnouncementToggle } from "./announcement-client";

export default async function AnnouncementsPage() {
  const user = await requireSuperAdmin();
  const [announcements, tenants] = await Promise.all([
    prisma.systemAnnouncement.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.tenant.findMany({ where: { status: { not: "ARCHIVED" } }, select: { id: true, name: true, slug: true }, orderBy: { name: "asc" }, take: 200 }),
  ]);
  return <DashboardShell kind="super" title="إعلانات النظام" subtitle="رسائل محددة المدة والفئة المستهدفة" userName={user.fullName}>
    <section className="saasPanel pagePanel"><AnnouncementForm tenants={tenants} /></section>
    <section className="saasPanel"><div className="panelTitle"><h3>آخر الإعلانات</h3><span>{announcements.length.toLocaleString("en-US")}</span></div>
      {announcements.length ? <div className="announcementList">{announcements.map((item) => <article key={item.id} className={"announcementItem " + item.severity.toLowerCase()}><div><span>{item.severity}</span><h3>{item.title}</h3><p>{item.message}</p><small>{item.audience} · يبدأ {item.startsAt.toLocaleString("ar-EG")}{item.endsAt ? " · ينتهي " + item.endsAt.toLocaleString("ar-EG") : ""}</small></div><AnnouncementToggle id={item.id} active={item.active} /></article>)}</div> : <div className="compactEmpty">لا توجد إعلانات بعد.</div>}
    </section>
  </DashboardShell>;
}