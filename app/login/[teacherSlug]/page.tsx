import { redirect } from "next/navigation";
import { AuthVisual } from "../../auth-visual";
import { LoginForm } from "../../auth-form";
import { getAuthContext, homeForRole } from "../../../lib/auth";
import { requirePublicTenant } from "../../../lib/tenant";

export async function generateMetadata({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const { teacherSlug } = await params;
  const tenant = await requirePublicTenant(teacherSlug);
  return { title: `دخول المدرس — ${tenant.name}` };
}

export default async function TeacherLoginSlugPage({ params }: { params: Promise<{ teacherSlug: string }> }) {
  const auth = await getAuthContext();
  if (auth) redirect(homeForRole(auth.user.role));

  const { teacherSlug } = await params;
  const tenant = await requirePublicTenant(teacherSlug);

  return <main className="authPage skoolaAuthPage teacherManagedLogin">
    <AuthVisual variant="default" />
    <section className="authCard"><div className="authCardInner">
      <span className="skoolaPill">بوابة إدارة {tenant.name}</span>
      <h1>دخول المدرس إلى لوحة التحكم</h1>
      <p>استخدم بيانات الحساب التي استلمتها من إدارة Skoola لإدارة أكاديميتك.</p>
      <LoginForm tenantSlug={tenant.slug} portal="teacher" />
    </div></section>
  </main>;
}