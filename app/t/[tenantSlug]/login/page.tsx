import Image from "next/image";
import { redirect } from "next/navigation";
import { LoginForm } from "../../../auth-form";
import { requirePublicTenant } from "../../../../lib/tenant";
import { getAuthContext } from "../../../../lib/auth";

export default async function TenantLoginPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const [tenant, auth] = await Promise.all([requirePublicTenant(tenantSlug), getAuthContext()]);

  if (auth) {
    const { user, membership } = auth;
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") redirect("/super-admin");
    if (user.role === "STUDENT" && membership?.tenantId === tenant.id) redirect("/dashboard");
    if (membership?.tenantId === tenant.id) redirect("/teacher");
    if (user.role.startsWith("TEACHER")) redirect("/teacher");
  }

  return <main className="authPage"><section className="authVisual"><a className="brand" href={"/t/" + tenant.slug}><b>{tenant.name.slice(0, 1)}</b><span>{tenant.name}<small>{tenant.subject ?? "منصة تعليمية"}</small></span></a><div className="authPortrait"><div className="portraitGlow" /><Image src={tenant.theme?.loginCoverUrl || "/hero.png"} alt={tenant.name} width={700} height={600} priority /></div><div className="authQuote"><b>“</b><p>{tenant.settings?.heroTitle ?? "خطوة جديدة في رحلتك التعليمية."}</p><span>{tenant.name}</span></div></section><section className="authCard"><div className="authCardInner"><span className="tag orange">مرحبًا بعودتك</span><h1>سجّل الدخول إلى {tenant.name}</h1><p>استخدم البريد أو اسم المستخدم أو رقم الهاتف.</p><LoginForm tenantSlug={tenant.slug} /></div></section></main>;
}
