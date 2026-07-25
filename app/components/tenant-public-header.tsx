import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, LayoutDashboard, LogIn, Menu, UserPlus } from "lucide-react";

type TenantHeaderIdentity = {
  slug: string;
  name: string;
  subject?: string | null;
  logoUrl?: string | null;
  platformName?: string | null;
};

export function TenantPublicHeader({
  tenant,
  isLoggedInStudent = false,
}: {
  tenant: TenantHeaderIdentity;
  isLoggedInStudent?: boolean;
}) {
  const academyUrl = `/t/${tenant.slug}`;
  const loginUrl = `${academyUrl}/login`;
  const registerUrl = `${academyUrl}/register`;
  const brandName = tenant.platformName || tenant.name;

  const navigation = (
    <>
      <Link href={`${academyUrl}#courses`}><BookOpen size={16} /> الكورسات</Link>
      <Link href={`${academyUrl}#why`}>لماذا منصتنا؟</Link>
    </>
  );

  const actions = isLoggedInStudent ? (
    <Link className="tenantHeaderPrimary" href="/dashboard"><LayoutDashboard size={17} /> لوحتي التعليمية <ArrowLeft size={16} /></Link>
  ) : (
    <>
      <Link className="tenantHeaderLogin" href={loginUrl}><LogIn size={17} /> دخول الطالب</Link>
      <Link className="tenantHeaderPrimary" href={registerUrl}><UserPlus size={17} /> حساب جديد <ArrowLeft size={16} /></Link>
    </>
  );

  return (
    <header className="tenantPremiumHeader">
      <div className="tenantHeaderInner wrap">
        <Link className="tenantHeaderBrand" href={academyUrl} aria-label={`الصفحة الرئيسية لمنصة ${brandName}`}>
          <span className="tenantHeaderLogo">
            {tenant.logoUrl ? <Image src={tenant.logoUrl} alt={`شعار ${brandName}`} width={52} height={52} /> : brandName.slice(0, 1)}
          </span>
          <span><strong>{brandName}</strong><small>{tenant.subject || "منصة تعليمية"}</small></span>
        </Link>

        <nav className="tenantHeaderNav" aria-label="التنقل الرئيسي">{navigation}</nav>
        <div className="tenantHeaderActions">{actions}</div>

        <details className="tenantMobileMenu">
          <summary aria-label="فتح قائمة التنقل"><Menu size={22} /><span>القائمة</span></summary>
          <div className="tenantMobileMenuPanel">
            <nav>{navigation}</nav>
            <div>{actions}</div>
          </div>
        </details>
      </div>
    </header>
  );
}