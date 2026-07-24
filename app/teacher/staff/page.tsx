import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { RevokeInvitation, StaffInviteForm, StaffMemberActions } from "./staff-client";

export default async function StaffPage() {
  const context = await requirePermission("staff.manage");
  const tenantId = context.membership.tenantId;
  const [members, invitations] = await Promise.all([
    prisma.tenantMember.findMany({ where: { tenantId, role: { in: ["TEACHER_OWNER", "TEACHER_ADMIN", "TEACHER_EDITOR", "SUPPORT_STAFF"] } }, include: { user: { select: { fullName: true, email: true, lastLoginAt: true } } }, orderBy: { createdAt: "asc" } }),
    prisma.staffInvitation.findMany({ where: { tenantId, status: "PENDING", expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return <DashboardShell kind="teacher" title="فريق العمل" subtitle="أدوار وصلاحيات مستقلة داخل منصتك" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><section className="saasPanel pagePanel"><h3>دعوة عضو جديد</h3><StaffInviteForm /></section><section className="saasPanel"><div className="panelTitle"><h3>الأعضاء الحاليون</h3></div><div className="responsiveTable"><table><thead><tr><th>الاسم</th><th>البريد</th><th>الدور</th><th>آخر دخول</th><th>الحالة</th><th>الإجراءات</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.user.fullName}</td><td>{member.user.email}</td><td>{member.role}</td><td>{member.user.lastLoginAt?.toLocaleDateString("ar-EG") ?? "—"}</td><td>{member.status}</td><td><StaffMemberActions id={member.id} role={member.role} status={member.status} locked={member.role === "TEACHER_OWNER" || member.userId === context.user.id} /></td></tr>)}</tbody></table></div></section><section className="saasPanel"><div className="panelTitle"><h3>دعوات معلقة</h3></div>{invitations.length ? invitations.map((invite) => <div className="inviteRow" key={invite.id}><span>{invite.email}<small>{invite.role} · تنتهي {invite.expiresAt.toLocaleDateString("ar-EG")}</small></span><RevokeInvitation id={invite.id} /></div>) : <div className="compactEmpty">لا توجد دعوات معلقة.</div>}</section></DashboardShell>;
}
