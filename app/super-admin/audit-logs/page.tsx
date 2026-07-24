import { prisma } from "../../../lib/prisma";
import { requireSuperAdmin } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";

export default async function AuditLogsPage() {
  const user = await requireSuperAdmin();
  const logs = await prisma.auditLog.findMany({ include: { actor: { select: { fullName: true } }, tenant: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <DashboardShell kind="super" title="سجل التدقيق العام" subtitle="آخر 100 عملية إدارية حساسة" userName={user.fullName}><section className="saasPanel pagePanel">{logs.length ? <div className="responsiveTable"><table><thead><tr><th>الإجراء</th><th>الفاعل</th><th>المنصة</th><th>الهدف</th><th>الوقت</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{log.action}</td><td>{log.actor?.fullName ?? "النظام"}</td><td>{log.tenant?.name ?? "عام"}</td><td>{log.entityType} {log.entityId ?? ""}</td><td>{log.createdAt.toLocaleString("ar-EG")}</td></tr>)}</tbody></table></div> : <div className="compactEmpty">لا توجد عمليات مسجلة بعد.</div>}</section></DashboardShell>;
}
