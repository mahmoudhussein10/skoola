import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { hashToken } from "../../../lib/auth";
import { Brand } from "../../ui";
import { StaffAcceptanceForm } from "./staff-acceptance-form";

export default async function StaffInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await prisma.staffInvitation.findUnique({ where: { tokenHash: hashToken(token) }, include: { tenant: { select: { name: true } } } });
  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt <= new Date()) notFound();
  return <main className="simpleAuth"><section className="panel"><Brand /><span className="tag orange">دعوة فريق آمنة</span><h1>انضم إلى {invitation.tenant.name}</h1><p>الدعوة موجهة إلى <b dir="ltr">{invitation.email}</b> بدور {invitation.role}. تُستخدم مرة واحدة فقط.</p><StaffAcceptanceForm token={token} email={invitation.email} /></section></main>;
}