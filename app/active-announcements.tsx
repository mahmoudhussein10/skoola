import { prisma } from "../lib/prisma";

export async function ActiveAnnouncements({ tenantId, audience }: { tenantId: string; audience: "teacher" | "student" }) {
  const now = new Date();
  const candidates = await prisma.systemAnnouncement.findMany({
    where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
    orderBy: [{ severity: "desc" }, { startsAt: "desc" }],
    take: 20,
  });
  const items = candidates.filter((item) => {
    if (item.audience === "ALL_USERS") return true;
    if (item.audience === "SELECTED_TENANTS") return Array.isArray(item.tenantIds) && item.tenantIds.includes(tenantId);
    return audience === "teacher" && (item.audience === "ALL_TEACHERS" || item.audience === "TEACHERS_ONLY");
  });
  if (!items.length) return null;
  return <section className="activeAnnouncements" aria-label="إعلانات النظام">{items.map((item) => <article key={item.id} className={item.severity.toLowerCase()}><div><b>{item.title}</b><p>{item.message}</p></div>{item.dismissible ? <span title="يمكن إغلاق الإعلان لاحقًا">إعلان</span> : null}</article>)}</section>;
}