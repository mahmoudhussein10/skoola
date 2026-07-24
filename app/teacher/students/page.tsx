import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const context = await requirePermission("students.view");
  const tenantId = context.membership.tenantId;
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const page = Math.max(1, Number(params.page) || 1);
  const take = 25;
  const where = { tenantId, role: "STUDENT" as const, ...(q ? { user: { OR: [{ fullName: { contains: q, mode: "insensitive" as const } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" as const } }] } } : {}) };
  const [members, total] = await Promise.all([
    prisma.tenantMember.findMany({ where, include: { user: { include: { studentProfiles: { where: { tenantId } }, _count: { select: { enrollments: true } } } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.tenantMember.count({ where }),
  ]);
  return <DashboardShell kind="teacher" title="الطلاب" subtitle={total.toLocaleString("en-US") + " طالب داخل منصتك"} userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><section className="saasPanel pagePanel"><form className="tableSearch"><input name="q" defaultValue={q} placeholder="ابحث بالاسم أو الهاتف أو البريد" /><button>بحث</button></form><div className="responsiveTable"><table><thead><tr><th>الطالب</th><th>الهاتف</th><th>الصف</th><th>المحافظة</th><th>الاشتراكات</th><th>الحالة</th></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td>{member.user.fullName}<small>{member.user.email ?? ""}</small></td><td dir="ltr">{member.user.phone}</td><td>{member.user.studentProfiles[0]?.grade ?? "—"}</td><td>{member.user.studentProfiles[0]?.governorate ?? "—"}</td><td>{member.user._count.enrollments.toLocaleString("en-US")}</td><td>{member.status}</td></tr>)}</tbody></table></div>{!members.length ? <div className="compactEmpty">لا يوجد طلاب مطابقون.</div> : null}</section></DashboardShell>;
}
