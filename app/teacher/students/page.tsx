import Link from "next/link";
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
  const where = {
    tenantId,
    role: "STUDENT" as const,
    ...(q ? {
      user: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      },
    } : {}),
  };
  const [members, total] = await Promise.all([
    prisma.tenantMember.findMany({
      where,
      include: {
        user: {
          include: {
            studentProfiles: { where: { tenantId }, take: 1 },
            _count: { select: { enrollments: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * take,
      take,
    }),
    prisma.tenantMember.count({ where }),
  ]);

  return (
    <DashboardShell
      kind="teacher"
      title="الطلاب"
      subtitle={`${total.toLocaleString("en-US")} طالب داخل منصتك`}
      userName={context.user.fullName}
      tenantSlug={context.membership.tenant.slug}
      supportMode={context.supportMode}
    >
      <section className="saasPanel pagePanel studentsDirectoryPage">
        <form className="tableSearch">
          <input name="q" defaultValue={q} placeholder="ابحث بالاسم أو الهاتف أو البريد" aria-label="البحث عن طالب" />
          <button>بحث</button>
        </form>
        <div className="responsiveTable studentsDirectoryTable">
          <table>
            <thead><tr><th>الطالب</th><th>هاتف الطالب</th><th>هاتف ولي الأمر</th><th>الصف</th><th>المحافظة</th><th>الاشتراكات</th><th>الحالة</th><th>التفاصيل</th></tr></thead>
            <tbody>
              {members.map((member) => {
                const profile = member.user.studentProfiles[0];
                return (
                  <tr key={member.id}>
                    <td><Link className="studentTableName" href={`/teacher/students/${member.user.id}`}>{member.user.fullName}<small>{member.user.email ?? ""}</small></Link></td>
                    <td><a className="studentPhoneLink" dir="ltr" href={`tel:${member.user.phone}`}>{member.user.phone}</a></td>
                    <td>{profile?.parentPhone ? <a className="parentPhoneLink" dir="ltr" href={`tel:${profile.parentPhone}`}>{profile.parentPhone}</a> : <span className="missingParentPhone">غير مسجل</span>}</td>
                    <td>{profile?.grade ?? "—"}</td>
                    <td>{profile?.governorate ?? "—"}</td>
                    <td>{member.user._count.enrollments.toLocaleString("en-US")}</td>
                    <td><span className={`tenantStatus ${member.status.toLowerCase()}`}>{member.status}</span></td>
                    <td><Link className="btn text studentDetailsLink" href={`/teacher/students/${member.user.id}`}>فتح الملف</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!members.length ? <div className="compactEmpty">لا يوجد طلاب مطابقون.</div> : null}
      </section>
    </DashboardShell>
  );
}
