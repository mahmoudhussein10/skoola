import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, GraduationCap, Search } from "lucide-react";
import { Brand } from "../ui";
import { prisma } from "../../lib/prisma";

export const metadata = { title: "اختر أكاديميتك وأنشئ حساب طالب" };
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const academies = await prisma.tenant.findMany({
    where: { status: { notIn: ["SUSPENDED", "DISABLED", "ARCHIVED"] } },
    select: { id: true, slug: true, name: true, subject: true, logoUrl: true, settings: { select: { platformName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return <main className="academyPickerPage" dir="rtl">
    <header className="academyPickerHeader"><Brand/><Link href="/login?role=student">لديك حساب؟ دخول الطالب</Link></header>
    <section className="academyPickerHero">
      <span><GraduationCap size={17}/> إنشاء حساب طالب</span>
      <h1>اختر منصة مدرسك</h1>
      <p>حساب الطالب مرتبط بأكاديمية محددة لحماية بياناتك وإظهار الكورسات والامتحانات الصحيحة فقط.</p>
    </section>
    {academies.length ? <section className="academyPickerGrid" aria-label="الأكاديميات المتاحة">
      {academies.map((academy) => { const title = academy.settings?.platformName || academy.name; return <article className="academyPickerCard" key={academy.id}>
        <div className="academyPickerLogo">{academy.logoUrl ? <Image src={academy.logoUrl} alt={`شعار ${title}`} width={64} height={64}/> : title.slice(0,1)}</div>
        <div><small>{academy.subject || "منصة تعليمية"}</small><h2>{title}</h2><p>أنشئ حسابك داخل منصة {academy.name} وابدأ التعلّم.</p></div>
        <Link href={`/t/${academy.slug}/register`}>إنشاء حساب طالب <ArrowLeft size={17}/></Link>
      </article>})}
    </section> : <section className="academyPickerEmpty"><Search size={30}/><h2>لا توجد أكاديميات متاحة للتسجيل الآن</h2><p>اطلب من مدرسك رابط منصته الخاص ثم افتحه مباشرة.</p><Link href="/">العودة للرئيسية</Link></section>}
  </main>;
}