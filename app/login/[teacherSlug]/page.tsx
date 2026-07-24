import { redirect } from "next/navigation";
import { requirePublicTenant } from "../../../lib/tenant";

export async function generateMetadata({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  const tenant = await requirePublicTenant(teacherSlug);
  return { title: `تسجيل الدخول — ${tenant.name}` };
}

export default async function TeacherLoginSlugPage({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  redirect(`/t/${teacherSlug}/login`);
}
