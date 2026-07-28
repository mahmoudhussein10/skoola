import { prisma } from "../../../lib/prisma";
import { requireTenantMember } from "../../../lib/auth";
import { tenantStaffRoles } from "../../../lib/permissions";
import { DashboardShell } from "../../dashboard-shell";

export default async function OnboardingPage() {
  const context = await requireTenantMember(tenantStaffRoles);
  const tenantId = context.membership.tenantId;
  const [courses, lessons, students] = await Promise.all([prisma.course.count({ where: { tenantId } }), prisma.lesson.count({ where: { tenantId } }), prisma.tenantMember.count({ where: { tenantId, role: "STUDENT" } })]);
  const checklist = [
    ["إضافة الشعار والهوية", Boolean(context.membership.tenant.logoUrl), "/teacher/branding"],
    ["إنشاء أول كورس", courses > 0, "/teacher/courses"],
    ["إضافة أول درس", lessons > 0, "/teacher/content/create?mode=lesson"],
    ["انضمام أول طالب", students > 0, "/teacher/students"],
  ] as const;
  const done = checklist.filter((item) => item[1]).length;
  return <DashboardShell kind="teacher" title="تجهيز منصتك" subtitle={done.toLocaleString("en-US") + " من " + checklist.length.toLocaleString("en-US") + " خطوات مكتملة"} userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><section className="onboardingCard"><div className="onboardingProgress"><b>{Math.round(done / checklist.length * 100).toLocaleString("en-US")}%</b><span>جاهزية المنصة</span><i><em style={{ width: done / checklist.length * 100 + "%" }} /></i></div><div>{checklist.map(([label, complete, href]) => <a className={complete ? "complete" : ""} href={href} key={label}><i>{complete ? "✓" : "○"}</i><span>{label}<small>{complete ? "مكتملة" : "انتقل لإكمالها"}</small></span><b>←</b></a>)}</div></section></DashboardShell>;
}
