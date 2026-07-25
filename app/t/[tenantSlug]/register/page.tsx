import Image from "next/image";
import type { CSSProperties } from "react";
import { GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { RegisterForm } from "../../../auth-form";
import { TenantPublicHeader } from "../../../components/tenant-public-header";
import { requirePublicTenant } from "../../../../lib/tenant";

export default async function TenantRegisterPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await requirePublicTenant(tenantSlug);

  const teacherImage = tenant.theme?.teacherPortraitUrl || tenant.theme?.loginCoverUrl || tenant.theme?.heroImageUrl || null;
  const style = {
    "--tenant-primary": tenant.theme?.primaryColor || "#2563eb",
    "--tenant-accent": tenant.theme?.accentColor || "#7c3aed",
    "--tenant-text": tenant.theme?.textColor || "#0f172a",
  } as CSSProperties;

  return <div className="tenantStudentAuthPage tenantStudentRegisterPage" style={style}>
    <TenantPublicHeader tenant={{ slug: tenant.slug, name: tenant.name, subject: tenant.subject, logoUrl: tenant.logoUrl, platformName: tenant.settings?.platformName }} />
    <main className="tenantStudentAuthStage">
      <section className="tenantAuthTeacherVisual">
        <div className="tenantAuthImageGlow" />
        <div className={`tenantAuthImageFrame${teacherImage ? "" : " empty"}`}>{teacherImage ? <Image src={teacherImage} alt={`المدرس في منصة ${tenant.name}`} width={900} height={1050} priority /> : <div className="tenantAuthEmptyVisual"><span><GraduationCap size={54} /></span><small>ابدأ رحلتك التعليمية</small><strong>{tenant.settings?.platformName || tenant.name}</strong><p>أنشئ حسابك واحفظ دروسك وتقدمك ونتائجك بأمان</p></div>}</div>
        <div className="tenantAuthVisualBrand"><Sparkles size={17} /><span><small>انضم إلى</small><strong>{tenant.name}</strong></span></div>
        <div className="tenantAuthVisualQuote"><GraduationCap size={23} /><div><b>ابدأ رحلتك بخطوة بسيطة</b><p>حساب واحد يحفظ دروسك وتقدمك وامتحاناتك ونتائجك بأمان.</p></div></div>
      </section>
      <section className="tenantAuthFormSide">
        <div className="tenantAuthFormCard tenantAuthRegisterCard tenantReveal">
          <span className="tenantAuthKicker"><ShieldCheck size={16} /> تسجيل طالب جديد</span>
          <h1>أنشئ حسابك وابدأ التعلّم</h1>
          <p>بياناتك ستُربط تلقائيًا بمنصة <b>{tenant.settings?.platformName || tenant.name}</b>.</p>
          <RegisterForm tenantSlug={tenant.slug} />
        </div>
      </section>
    </main>
  </div>;
}