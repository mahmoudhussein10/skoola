import { redirect } from "next/navigation";
import { requirePublicTenant } from "../../../lib/tenant";

export async function generateMetadata({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  const tenant = await requirePublicTenant(teacherSlug);
  return { title: `التسجيل في ${tenant.name}` };
}

export default async function TeacherRegisterSlugPage({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  redirect(`/t/${teacherSlug}/register`);
}
