import Image from "next/image";
import { redirect } from "next/navigation";
import { RegisterForm } from "../../../auth-form";
import { requirePublicTenant } from "../../../../lib/tenant";
import { getAuthContext } from "../../../../lib/auth";

export default async function TenantRegisterPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const [tenant, auth] = await Promise.all([requirePublicTenant(tenantSlug), getAuthContext()]);

  if (auth) {
    const { user, membership } = auth;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") redirect("/super-admin");
    if (user.role === "STUDENT" && membership?.tenantId === tenant.id) redirect("/dashboard");
    if (membership?.tenantId === tenant.id) redirect("/teacher");
    if (user.role.startsWith("TEACHER")) redirect("/teacher");
  }

  return <main className="authPage registerPage"><section className="authVisual"><a className="brand" href={"/t/" + tenant.slug}><b>{tenant.name.slice(0, 1)}</b><span>{tenant.name}<small>{tenant.subject ?? "منصة تعليمية"}</small></span></a><div className="authPortrait"><div className="portraitGlow" /><Image src={tenant.theme?.loginCoverUrl || "/hero.png"} alt={tenant.name} width={700} height={600} priority /></div><div className="authQuote"><b>ابدأ صح</b><p>حساب واحد يحفظ تقدمك ونتائجك داخل منصة مدرسك.</p></div></section><section className="authCard"><div className="authCardInner wide"><span className="tag orange">انضم إلى {tenant.name}</span><h1>أنشئ حساب الطالب</h1><p>أدخل بيانات صحيحة لتفعيل المتابعة وتقارير التقدم.</p><RegisterForm tenantSlug={tenant.slug} /></div></section></main>;
}
