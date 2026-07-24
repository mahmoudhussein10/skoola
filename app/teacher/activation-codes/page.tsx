import { prisma } from "../../../lib/prisma";
import { requirePermission } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";
import { ActivationCodeForm } from "./activation-code-form";

export default async function ActivationCodesPage() {
  const context = await requirePermission("activationCodes.manage");
  const tenantId = context.membership.tenantId;
  const [codes, courses] = await Promise.all([
    prisma.activationCode.findMany({ where: { tenantId }, include: { course: { select: { title: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.course.findMany({ where: { tenantId, status: { not: "ARCHIVED" } }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 200 }),
  ]);
  return <DashboardShell kind="teacher" title="أكواد التفعيل" subtitle="أكواد أحادية الاتجاه مرتبطة بمنصتك فقط" userName={context.user.fullName} tenantSlug={context.membership.tenant.slug} supportMode={context.supportMode}><section className="saasPanel pagePanel"><ActivationCodeForm courses={courses} /></section><section className="saasPanel"><div className="panelTitle"><h3>آخر الدفعات</h3><span>{codes.length.toLocaleString("en-US")}</span></div>{codes.length ? <div className="responsiveTable"><table><thead><tr><th>الوصف</th><th>الكورس</th><th>الاستخدام</th><th>الانتهاء</th><th>الحالة</th></tr></thead><tbody>{codes.map((code) => <tr key={code.id}><td>{code.label ?? "بدون وصف"}</td><td>{code.course?.title ?? "عام"}</td><td>{code.usedCount.toLocaleString("en-US")} / {code.maxUses.toLocaleString("en-US")}</td><td>{code.expiresAt?.toLocaleDateString("ar-EG") ?? "غير محدد"}</td><td>{code.status}</td></tr>)}</tbody></table></div> : <div className="compactEmpty">لم تُنشئ أكواد تفعيل بعد.</div>}</section></DashboardShell>;
}