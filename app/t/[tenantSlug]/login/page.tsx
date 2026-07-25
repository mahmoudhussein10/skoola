import Image from "next/image";
import type { CSSProperties } from "react";
import { BookOpenCheck, ShieldCheck, Sparkles } from "lucide-react";
import { LoginForm } from "../../../auth-form";
import { TenantPublicHeader } from "../../../components/tenant-public-header";
import { requirePublicTenant } from "../../../../lib/tenant";

export default async function TenantLoginPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await requirePublicTenant(tenantSlug);

  const teacherImage = tenant.theme?.teacherPortraitUrl || tenant.theme?.loginCoverUrl || tenant.theme?.heroImageUrl || "/hero.png";
  const style = {
    "--tenant-primary": tenant.theme?.primaryColor || "#2563eb",
    "--tenant-accent": tenant.theme?.accentColor || "#7c3aed",
    "--tenant-text": tenant.theme?.textColor || "#0f172a",
  } as CSSProperties;

  return <div className="tenantStudentAuthPage" style={style}>
    <TenantPublicHeader tenant={{ slug: tenant.slug, name: tenant.name, subject: tenant.subject, logoUrl: tenant.logoUrl, platformName: tenant.settings?.platformName }} />
    <main className="tenantStudentAuthStage">
      <section className="tenantAuthTeacherVisual">
        <div className="tenantAuthImageGlow" />
        <div className="tenantAuthImageFrame"><Image src={teacherImage} alt={`المدرس في منصة ${tenant.name}`} width={900} height={1050} priority /></div>
        <div className="tenantAuthVisualBrand"><Sparkles size={17} /><span><small>تعلّم مع</small><strong>{tenant.name}</strong></span></div>
        <div className="tenantAuthVisualQuote"><BookOpenCheck size={22} /><div><b>مكان واحد لكل رحلتك التعليمية</b><p>{tenant.settings?.heroTitle || "دروس منظمة، متابعة واضحة، ونتائج محفوظة داخل حسابك."}</p></div></div>
      </section>
      <section className="tenantAuthFormSide">
        <div className="tenantAuthFormCard tenantReveal">
          <span className="tenantAuthKicker"><ShieldCheck size={16} /> دخول آمن للطلاب</span>
          <h1>مرحبًا بعودتك 👋</h1>
          <p>سجّل دخولك إلى <b>{tenant.settings?.platformName || tenant.name}</b> وواصل التعلّم من حيث توقفت.</p>
          <LoginForm tenantSlug={tenant.slug} />
        </div>
      </section>
    </main>
  </div>;
}