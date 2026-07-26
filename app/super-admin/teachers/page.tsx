import Link from "next/link";
import type { Prisma, TenantStatus } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { requireSuperAdmin } from "../../../lib/auth";
import { DashboardShell } from "../../dashboard-shell";

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireSuperAdmin();
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = params.status?.trim() ?? "ALL";
  const page = Math.max(1, Number(params.page) || 1);
  const take = 20;

  const where: Prisma.TenantWhereInput = {};
  if (statusFilter !== "ALL") {
    where.status = statusFilter as TenantStatus;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" as const } },
      { slug: { contains: q, mode: "insensitive" as const } },
      { owner: { fullName: { contains: q, mode: "insensitive" as const } } },
      { owner: { email: { contains: q, mode: "insensitive" as const } } },
      { owner: { phone: { contains: q } } },
    ];
  }

  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      include: {
        owner: { select: { fullName: true, email: true, phone: true, lastLoginAt: true } },
        billingSettings: { select: { pricePerStudent: true } },
        _count: { select: { members: true, courses: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.tenant.count({ where }),
  ]);

  return (
    <DashboardShell kind="super" title="إدارة منصات المدرسين" subtitle={total.toLocaleString("en-US") + " منصة مسجلة"} userName={user.fullName}>
      <section className="saasPanel pagePanel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
          <form className="tableSearch dashboardSearchToolbar" style={{ flex: 1, minWidth: "280px" }}>
            <input name="q" defaultValue={q} placeholder="ابحث باسم المدرس أو المنصة أو الهاتف" />
            <select name="status" defaultValue={statusFilter} style={{ padding: "0.5rem 0.75rem", borderRadius: "8px", border: "1px solid var(--border-color, #cbd5e1)" }}>
              <option value="ALL">جميع الحالات</option>
              <option value="ACTIVE">نشط (ACTIVE)</option>
              <option value="TRIAL">تجريبي (TRIAL)</option>
              <option value="SUSPENDED">موقوف (SUSPENDED)</option>
              <option value="DISABLED">معطل (DISABLED)</option>
              <option value="ARCHIVED">مؤرشف (ARCHIVED)</option>
            </select>
            <button type="submit" className="btn primary" style={{ padding: "0.5rem 1rem" }}>بحث</button>
          </form>

          <Link href="/super-admin/teachers/new" className="btn primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.65rem 1.25rem", fontWeight: 600 }}>
            <span>+</span> إنشاء منصة مدرس جديد
          </Link>
        </div>

        <div className="responsiveTable">
          <table>
            <thead>
              <tr>
                <th>المنصة والربط</th>
                <th>المدرس / المالك</th>
                <th>سعر الطالب</th>
                <th>الأعضاء / الكورسات</th>
                <th>آخر دخول</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((tenant) => (
                <tr key={tenant.id}>
                  <td>
                    <b>{tenant.name}</b>
                    <br />
                    <small dir="ltr" style={{ color: "#64748b" }}>/t/{tenant.slug}</small>
                  </td>
                  <td>
                    <b>{tenant.owner?.fullName ?? "—"}</b>
                    <br />
                    <small dir="ltr" style={{ color: "#64748b" }}>{tenant.owner?.phone ?? tenant.owner?.email ?? ""}</small>
                  </td>
                  <td>
                    {tenant.billingSettings ? `${Number(tenant.billingSettings.pricePerStudent).toLocaleString("en-US")} ج.م` : "غير محدد"}
                  </td>
                  <td>
                    <b>{tenant._count.members.toLocaleString("en-US")} طالب/عضو</b>
                    <br />
                    <small>{tenant._count.courses.toLocaleString("en-US")} كورس</small>
                  </td>
                  <td>{tenant.owner?.lastLoginAt?.toLocaleDateString("ar-EG") ?? "لم يدخل بعد"}</td>
                  <td>
                    <span className={"tenantStatus " + tenant.status.toLowerCase()}>{tenant.status}</span>
                  </td>
                  <td>
                    <Link href={"/super-admin/teachers/" + tenant.id} className="btn secondary" style={{ padding: "0.25rem 0.75rem", fontSize: "0.85rem" }}>
                      الملف الكامل ←
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!tenants.length ? <div className="compactEmpty">لا توجد منصات مدرسين مطابقة للشروط.</div> : null}

        <div className="pagination">
          <span>صفحة {page.toLocaleString("en-US")} من {Math.max(1, Math.ceil(total / take)).toLocaleString("en-US")}</span>
          {page > 1 ? <a href={`?q=${encodeURIComponent(q)}&status=${statusFilter}&page=${page - 1}`}>السابق</a> : null}
          {page * take < total ? <a href={`?q=${encodeURIComponent(q)}&status=${statusFilter}&page=${page + 1}`}>التالي</a> : null}
        </div>
      </section>
    </DashboardShell>
  );
}
